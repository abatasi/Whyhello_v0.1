import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, companiesTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/options", async (_req, res) => {
  try {
    const [industries, departments, seniorities, companySizes, countries, locations] =
      await Promise.all([
        db
          .selectDistinct({ value: companiesTable.industry })
          .from(companiesTable)
          .where(sql`${companiesTable.industry} is not null`)
          .orderBy(companiesTable.industry),
        db
          .selectDistinct({ value: contactsTable.department })
          .from(contactsTable)
          .where(sql`${contactsTable.department} is not null`)
          .orderBy(contactsTable.department),
        db
          .selectDistinct({ value: contactsTable.seniority })
          .from(contactsTable)
          .where(sql`${contactsTable.seniority} is not null`)
          .orderBy(contactsTable.seniority),
        db
          .selectDistinct({ value: companiesTable.size })
          .from(companiesTable)
          .where(sql`${companiesTable.size} is not null`)
          .orderBy(companiesTable.size),
        db
          .selectDistinct({ value: contactsTable.country })
          .from(contactsTable)
          .where(sql`${contactsTable.country} is not null`)
          .orderBy(contactsTable.country),
        db
          .selectDistinct({ value: contactsTable.location })
          .from(contactsTable)
          .where(sql`${contactsTable.location} is not null`)
          .orderBy(contactsTable.location),
      ]);

    res.json({
      industries: industries.map((r) => r.value).filter(Boolean),
      departments: departments.map((r) => r.value).filter(Boolean),
      seniorities: seniorities.map((r) => r.value).filter(Boolean),
      companySizes: companySizes.map((r) => r.value).filter(Boolean),
      countries: countries.map((r) => r.value).filter(Boolean),
      locations: locations.map((r) => r.value).filter(Boolean),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
