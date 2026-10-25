import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { contactsTable, companiesTable, contactInsightsTable, contactMetaScoresTable, listsTable, rolesTable, dnaProfilesTable } from "@workspace/db/schema";
import { GetContactParams } from "@workspace/api-zod";
import { eq, ilike, and, inArray, or, sql, SQL, asc, desc } from "drizzle-orm";
import { matchingBuyingCenterSeats, parseDnaProfile, selectedBuyingCenter } from "../lib/live-audience";
import { managementLevelExpression, normalizeManagementLevel } from "../lib/contact-management-levels.js";
import { departmentFilterCondition } from "../lib/department-taxonomy";
import { locationFilterCondition } from "../lib/location-filters.js";
import { buildLookalikeRanking, getLookalikeReference, LookalikeInputError } from "../lib/contact-lookalikes.js";
import { contactTextSearchCondition } from "../lib/contact-text-search.js";

const router: IRouter = Router();

function splitParam(v: unknown): string[] {
  if (!v || typeof v !== "string") return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

router.get("/", async (req, res) => {
  try {
    const raw = req.query as Record<string, string>;
    const auth = getAuth(req);
    const uid = (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId;
    const page = Math.max(1, parseInt(raw.page ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(raw.limit ?? "20") || 20));
    const offset = (page - 1) * limit;
    const segment = raw.segment ?? "all";
    if (!["all", "netNew", "enriched"].includes(segment)) {
      res.status(400).json({ error: "Invalid segment" });
      return;
    }

    const industries = splitParam(raw.industry);
    const departments = splitParam(raw.department);
    const seniorities = splitParam(raw.seniority).map(normalizeManagementLevel);
    const companySizes = splitParam(raw.companySize);
    const locations = splitParam(raw.location);

    const conditions: SQL[] = [];
    let lookalike: ReturnType<typeof buildLookalikeRanking> | undefined;
    if (raw.lookalikeContactId !== undefined) {
      if (!/^[1-9]\d*$/.test(raw.lookalikeContactId) || !Number.isSafeInteger(Number(raw.lookalikeContactId)) || Number(raw.lookalikeContactId) > 2147483647) {
        res.status(400).json({ error: "Choose a valid reference contact." });
        return;
      }
      lookalike = buildLookalikeRanking(await getLookalikeReference(Number(raw.lookalikeContactId)));
      conditions.push(lookalike.condition);
    }

    const textSearch = contactTextSearchCondition(raw.search, true);
    if (textSearch) conditions.push(textSearch);
    if (raw.jobTitle) {
      conditions.push(ilike(contactsTable.jobTitle, `%${raw.jobTitle}%`));
    }
    if (departments.length > 0) {
      conditions.push((await departmentFilterCondition(departments))!);
    }
    if (seniorities.length > 0) {
      conditions.push(inArray(managementLevelExpression(), seniorities));
    }
    if (industries.length === 1) {
      conditions.push(eq(companiesTable.industry, industries[0]));
    } else if (industries.length > 1) {
      conditions.push(inArray(companiesTable.industry, industries));
    }
    if (companySizes.length === 1) {
      conditions.push(eq(companiesTable.size, companySizes[0]));
    } else if (companySizes.length > 1) {
      conditions.push(inArray(companiesTable.size, companySizes));
    }
    const contactLocation = locationFilterCondition(contactsTable.location, contactsTable.country, locations, splitParam(raw.excludedLocation));
    const headOfficeLocation = locationFilterCondition(companiesTable.location, companiesTable.country, splitParam(raw.headOfficeLocation), splitParam(raw.excludedHeadOfficeLocation));
    if (contactLocation) conditions.push(contactLocation);
    if (headOfficeLocation) conditions.push(headOfficeLocation);
    if (raw.country) {
      conditions.push(eq(contactsTable.country, raw.country));
    }
    if (raw.companyId) {
      conditions.push(eq(contactsTable.companyId, parseInt(raw.companyId)));
    }
    if (raw.listId) {
      const listIdVal = parseInt(raw.listId);
      if (!isNaN(listIdVal)) {
        // listId filter requires auth — lists are private resources
        if (!uid) {
          res.status(401).json({ error: "Authentication required to filter by list" });
          return;
        }
        // Verify list ownership (NULL user_id = legacy shared list, accessible to any auth'd user)
        const [list] = await db.select({ id: listsTable.id })
          .from(listsTable)
          .where(and(
            eq(listsTable.id, listIdVal),
            or(eq(listsTable.userId, uid), sql`${listsTable.userId} IS NULL`),
          ))
          .limit(1);
        if (!list) {
          res.status(403).json({ error: "Access denied to this list" });
          return;
        }
        conditions.push(
          sql`${contactsTable.id} IN (SELECT contact_id FROM list_contacts WHERE list_id = ${listIdVal})`
        );
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const revealed = uid
      ? sql`EXISTS (SELECT 1 FROM contact_reveals cr
          WHERE cr.contact_id = contacts.id AND cr.user_id = ${uid})`
      : sql`false`;
    const rowWhere = segment === "all"
      ? where
      : and(where, segment === "enriched" ? revealed : sql`NOT (${revealed})`);

    const sortDir = raw.sortOrder === "desc" ? "DESC" : "ASC";
    const insightCountExpr = sql`(SELECT count(*)::int FROM contact_insights WHERE contact_id = ${contactsTable.id})`;

    const orderByClause: SQL[] = [];
    if (lookalike) orderByClause.push(sql`${lookalike.score} DESC`);
    switch (raw.sortBy) {
      case "name":
        orderByClause.push(sql`${contactsTable.firstName} ${sql.raw(sortDir)} NULLS LAST`);
        orderByClause.push(sql`${contactsTable.lastName} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "email":
        orderByClause.push(sql`${contactsTable.email} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "mobile":
        orderByClause.push(sql`${contactsTable.phone} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "jobTitle":
        orderByClause.push(sql`${contactsTable.jobTitle} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "companyName":
        orderByClause.push(sql`${companiesTable.name} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "location":
        orderByClause.push(sql`${contactsTable.location} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "department":
        orderByClause.push(sql`${contactsTable.department} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "seniority":
        orderByClause.push(sql`${contactsTable.seniority} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "insightCount":
        orderByClause.push(sql`${insightCountExpr} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "relevanceScore":
        orderByClause.push(sql`${contactMetaScoresTable.metaScore} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      default:
        orderByClause.push(sql`${contactsTable.firstName} ASC NULLS LAST`);
        orderByClause.push(sql`${contactsTable.lastName} ASC NULLS LAST`);
    }
    orderByClause.push(asc(contactsTable.id));

    const [rows, [{ count, saved, enriched }]] = await Promise.all([
      db
        .select({
          id: contactsTable.id,
          firstName: contactsTable.firstName,
          lastName: contactsTable.lastName,
          jobTitle: contactsTable.jobTitle,
          department: contactsTable.department,
          seniority: contactsTable.seniority,
          email: contactsTable.email,
          phone: contactsTable.phone,
          location: contactsTable.location,
          country: contactsTable.country,
          linkedinUrl: contactsTable.linkedinUrl,
          companyId: contactsTable.companyId,
          companyName: companiesTable.name,
          companyIndustry: companiesTable.industry,
          companySize: companiesTable.size,
          insightCount: sql<number>`(SELECT count(*)::int FROM contact_insights WHERE contact_id = ${contactsTable.id})`,
          relevanceScore: contactMetaScoresTable.metaScore,
          lookalikeScore: lookalike?.score ?? sql<null>`null`,
          lookalikeReasons: lookalike?.reasons ?? sql<string[]>`ARRAY[]::text[]`,
        })
        .from(contactsTable)
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
        .leftJoin(contactMetaScoresTable, eq(contactsTable.id, contactMetaScoresTable.contactId))
        .where(rowWhere)
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(offset),
      db
        .select({
          count: sql<number>`count(*)::int`,
          enriched: sql<number>`count(*) FILTER (WHERE ${revealed})::int`,
          saved: uid
            ? sql<number>`count(*) FILTER (WHERE
                EXISTS (SELECT 1 FROM contact_reveals cr
                  WHERE cr.contact_id = contacts.id AND cr.user_id = ${uid})
                AND EXISTS (SELECT 1 FROM list_contacts lc
                  JOIN lists l ON l.id = lc.list_id
                  WHERE lc.contact_id = contacts.id
                    AND l.type = 'contacts'
                    AND (l.user_id = ${uid} OR l.user_id IS NULL))
              )::int`
            : sql<number>`0::int`,
        })
        .from(contactsTable)
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
        .where(where),
    ]);
    const total = segment === "enriched" ? enriched : segment === "netNew" ? count - enriched : count;

    res.json({
      data: rows,
      total,
      counts: { total: count, netNew: count - enriched, enriched },
      saved,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    if (err instanceof LookalikeInputError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = GetContactParams.parse(req.params);
    const auth = getAuth(req);
    const uid = (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId;

    const rows = await db
      .select({
        id: contactsTable.id,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        jobTitle: contactsTable.jobTitle,
        department: contactsTable.department,
        seniority: contactsTable.seniority,
        email: contactsTable.email,
        phone: contactsTable.phone,
        location: contactsTable.location,
        country: contactsTable.country,
        linkedinUrl: contactsTable.linkedinUrl,
        twitterHandle: contactsTable.twitterHandle,
        bio: contactsTable.bio,
        companyId: companiesTable.id,
        companyName: companiesTable.name,
        companyIndustry: companiesTable.industry,
        companySize: companiesTable.size,
        companyLocation: companiesTable.location,
        companyCountry: companiesTable.country,
        companyWebsite: companiesTable.website,
        companyDescription: companiesTable.description,
        companyEmployeeCount: companiesTable.employeeCount,
        companyFoundedYear: companiesTable.foundedYear,
        roleName: rolesTable.name,
      })
      .from(contactsTable)
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .leftJoin(rolesTable, eq(contactsTable.roleId, rolesTable.id))
      .where(eq(contactsTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const row = rows[0];
    let liveBuyingCenterName: string | null = null;
    let liveBuyingCenterSeats: string[] = [];
    if (uid) {
      const [profileRow] = await db
        .select({ data: dnaProfilesTable.data })
        .from(dnaProfilesTable)
        .where(eq(dnaProfilesTable.userId, uid))
        .limit(1);
      const buyingCenter = selectedBuyingCenter(profileRow ? parseDnaProfile(profileRow.data) : null);
      if (buyingCenter) {
        liveBuyingCenterName = typeof buyingCenter.name === "string" ? buyingCenter.name : null;
        liveBuyingCenterSeats = matchingBuyingCenterSeats(buyingCenter, {
          roleName: row.roleName,
          department: row.department,
          seniority: row.seniority,
        });
      }
    }
    const contact = {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      jobTitle: row.jobTitle,
      department: row.department,
      seniority: row.seniority,
      email: row.email,
      phone: row.phone,
      location: row.location,
      country: row.country,
      linkedinUrl: row.linkedinUrl,
      twitterHandle: row.twitterHandle,
      bio: row.bio,
      liveBuyingCenterName,
      liveBuyingCenterSeats,
      company: row.companyId
        ? {
            id: row.companyId,
            name: row.companyName!,
            industry: row.companyIndustry,
            size: row.companySize,
            location: row.companyLocation,
            country: row.companyCountry,
            website: row.companyWebsite,
            description: row.companyDescription,
            employeeCount: row.companyEmployeeCount,
            foundedYear: row.companyFoundedYear,
          }
        : undefined,
    };

    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
