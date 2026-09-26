import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { contactsTable, companiesTable, listsTable } from "@workspace/db/schema";
import { GetCompanyParams } from "@workspace/api-zod";
import { eq, ilike, and, inArray, or, sql, SQL } from "drizzle-orm";
import { companyInsightsTable } from "@workspace/db/schema";

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
    const sizes = splitParam(raw.size);
    const locations = splitParam(raw.location);

    const conditions: SQL[] = [];

    if (raw.search) {
      const s = `%${raw.search}%`;
      conditions.push(
        sql`(${companiesTable.name} ilike ${s} OR ${companiesTable.description} ilike ${s})`
      );
    }
    if (industries.length === 1) {
      conditions.push(eq(companiesTable.industry, industries[0]));
    } else if (industries.length > 1) {
      conditions.push(inArray(companiesTable.industry, industries));
    }
    if (sizes.length === 1) {
      conditions.push(eq(companiesTable.size, sizes[0]));
    } else if (sizes.length > 1) {
      conditions.push(inArray(companiesTable.size, sizes));
    }
    if (locations.length === 1) {
      conditions.push(ilike(companiesTable.location, `%${locations[0]}%`));
    } else if (locations.length > 1) {
      conditions.push(or(...locations.map((l) => ilike(companiesTable.location, `%${l}%`)))!);
    }
    if (raw.country) {
      conditions.push(eq(companiesTable.country, raw.country));
    }
    if (raw.listId) {
      const listIdVal = parseInt(raw.listId);
      if (!isNaN(listIdVal)) {
        // listId filter requires auth — lists are private resources
        const auth = getAuth(req);
        const uid = (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId;
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
          sql`${companiesTable.id} IN (SELECT company_id FROM list_companies WHERE list_id = ${listIdVal})`
        );
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortDir = raw.sortOrder === "desc" ? "DESC" : "ASC";
    const orderByClause: SQL[] = [];
    switch (raw.sortBy) {
      case "name":
        orderByClause.push(sql`${companiesTable.name} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "industry":
        orderByClause.push(sql`${companiesTable.industry} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "website":
        orderByClause.push(sql`${companiesTable.website} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "location":
        orderByClause.push(sql`${companiesTable.location} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "size":
        orderByClause.push(sql`${companiesTable.size} ${sql.raw(sortDir)} NULLS LAST`);
        break;
      case "insightCount":
        orderByClause.push(sql`(SELECT count(*)::int FROM company_insights WHERE company_id = ${companiesTable.id}) ${sql.raw(sortDir)}`);
        break;
      default:
        orderByClause.push(sql`${companiesTable.name} ASC NULLS LAST`);
    }

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        id: companiesTable.id,
        name: companiesTable.name,
        industry: companiesTable.industry,
        size: companiesTable.size,
        location: companiesTable.location,
        country: companiesTable.country,
        website: companiesTable.website,
        description: companiesTable.description,
        employeeCount: companiesTable.employeeCount,
        foundedYear: companiesTable.foundedYear,
        insightCount: sql<number>`(SELECT COUNT(*)::int FROM company_insights WHERE company_insights.company_id = companies.id)`,
      }).from(companiesTable).where(where).orderBy(...orderByClause).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(companiesTable).where(where),
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
    const { id } = GetCompanyParams.parse(req.params);

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, id))
      .limit(1);

    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    const contacts = await db
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
      })
      .from(contactsTable)
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .where(eq(contactsTable.companyId, id));

    res.json({ ...company, contacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
