import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, companiesTable, contactInsightsTable } from "@workspace/db/schema";
import { GetContactParams } from "@workspace/api-zod";
import { eq, ilike, and, inArray, or, sql, SQL, asc, desc } from "drizzle-orm";

const router: IRouter = Router();

function splitParam(v: unknown): string[] {
  if (!v || typeof v !== "string") return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

router.get("/", async (req, res) => {
  try {
    const raw = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(raw.page ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(raw.limit ?? "20") || 20));
    const offset = (page - 1) * limit;

    const industries = splitParam(raw.industry);
    const departments = splitParam(raw.department);
    const seniorities = splitParam(raw.seniority);
    const companySizes = splitParam(raw.companySize);
    const locations = splitParam(raw.location);

    const conditions: SQL[] = [];

    if (raw.search) {
      const s = `%${raw.search}%`;
      conditions.push(
        sql`(${contactsTable.firstName} ilike ${s} OR ${contactsTable.lastName} ilike ${s} OR ${contactsTable.email} ilike ${s} OR ${contactsTable.jobTitle} ilike ${s} OR ${companiesTable.name} ilike ${s})`
      );
    }
    if (raw.jobTitle) {
      conditions.push(ilike(contactsTable.jobTitle, `%${raw.jobTitle}%`));
    }
    if (departments.length === 1) {
      conditions.push(eq(contactsTable.department, departments[0]));
    } else if (departments.length > 1) {
      conditions.push(inArray(contactsTable.department, departments));
    }
    if (seniorities.length === 1) {
      conditions.push(eq(contactsTable.seniority, seniorities[0]));
    } else if (seniorities.length > 1) {
      conditions.push(inArray(contactsTable.seniority, seniorities));
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
    if (locations.length === 1) {
      conditions.push(ilike(contactsTable.location, `%${locations[0]}%`));
    } else if (locations.length > 1) {
      conditions.push(or(...locations.map((l) => ilike(contactsTable.location, `%${l}%`)))!);
    }
    if (raw.country) {
      conditions.push(eq(contactsTable.country, raw.country));
    }
    if (raw.companyId) {
      conditions.push(eq(contactsTable.companyId, parseInt(raw.companyId)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortDir = raw.sortOrder === "desc" ? "DESC" : "ASC";
    const insightCountExpr = sql`(SELECT count(*)::int FROM contact_insights WHERE contact_id = ${contactsTable.id})`;

    const orderByClause: SQL[] = [];
    switch (raw.sortBy) {
      case "name":
        orderByClause.push(sql`${contactsTable.firstName} ${sql.raw(sortDir)} NULLS LAST`);
        orderByClause.push(sql`${contactsTable.lastName} ${sql.raw(sortDir)} NULLS LAST`);
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
      default:
        orderByClause.push(sql`${contactsTable.firstName} ASC NULLS LAST`);
        orderByClause.push(sql`${contactsTable.lastName} ASC NULLS LAST`);
    }

    const [rows, [{ count }]] = await Promise.all([
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
        })
        .from(contactsTable)
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
        .where(where)
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contactsTable)
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
        .where(where),
    ]);

    res.json({
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = GetContactParams.parse(req.params);

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
      })
      .from(contactsTable)
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .where(eq(contactsTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const row = rows[0];
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
