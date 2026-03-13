import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, companiesTable } from "@workspace/db/schema";
import { ListContactsQueryParams, GetContactParams } from "@workspace/api-zod";
import { eq, ilike, and, sql, SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const query = ListContactsQueryParams.parse(req.query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (query.search) {
      const s = `%${query.search}%`;
      conditions.push(
        sql`(${contactsTable.firstName} ilike ${s} OR ${contactsTable.lastName} ilike ${s} OR ${contactsTable.email} ilike ${s} OR ${contactsTable.jobTitle} ilike ${s} OR ${companiesTable.name} ilike ${s})`
      );
    }
    if (query.jobTitle) {
      conditions.push(ilike(contactsTable.jobTitle, `%${query.jobTitle}%`));
    }
    if (query.department) {
      conditions.push(eq(contactsTable.department, query.department));
    }
    if (query.seniority) {
      conditions.push(eq(contactsTable.seniority, query.seniority));
    }
    if (query.industry) {
      conditions.push(eq(companiesTable.industry, query.industry));
    }
    if (query.companySize) {
      conditions.push(eq(companiesTable.size, query.companySize));
    }
    if (query.location) {
      conditions.push(ilike(contactsTable.location, `%${query.location}%`));
    }
    if (query.country) {
      conditions.push(eq(contactsTable.country, query.country));
    }
    if (query.companyId) {
      conditions.push(eq(contactsTable.companyId, query.companyId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

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
        })
        .from(contactsTable)
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
        .where(where)
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
