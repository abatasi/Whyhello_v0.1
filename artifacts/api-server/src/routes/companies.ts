import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, companiesTable } from "@workspace/db/schema";
import { ListCompaniesQueryParams, GetCompanyParams } from "@workspace/api-zod";
import { eq, ilike, and, sql, SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const query = ListCompaniesQueryParams.parse(req.query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (query.search) {
      const s = `%${query.search}%`;
      conditions.push(
        sql`(${companiesTable.name} ilike ${s} OR ${companiesTable.description} ilike ${s})`
      );
    }
    if (query.industry) {
      conditions.push(eq(companiesTable.industry, query.industry));
    }
    if (query.size) {
      conditions.push(eq(companiesTable.size, query.size));
    }
    if (query.location) {
      conditions.push(ilike(companiesTable.location, `%${query.location}%`));
    }
    if (query.country) {
      conditions.push(eq(companiesTable.country, query.country));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(companiesTable)
        .where(where)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(companiesTable)
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
