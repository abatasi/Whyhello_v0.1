import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, companiesTable, rolesTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { MANAGEMENT_LEVELS, managementLevelExpression } from "../lib/contact-management-levels.js";

const COMPANY_SIZE_ORDER = ["11-50", "51-200", "201-500", "500-1000", "1000+"];

function sortCompanySizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ai = COMPANY_SIZE_ORDER.indexOf(a);
    const bi = COMPANY_SIZE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const router: IRouter = Router();

router.get("/options", async (_req, res) => {
  try {
    const managementLevel = managementLevelExpression();
    const [industries, departments, roleNames, seniorities, companySizes, countries, locations, managementLevelCounts] =
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
          .selectDistinct({ value: rolesTable.name })
          .from(rolesTable)
          .where(sql`${rolesTable.name} is not null`)
          .orderBy(rolesTable.name),
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
        db
          .select({ value: managementLevel, count: sql<number>`count(*)::int` })
          .from(contactsTable)
          .where(sql`${managementLevel} is not null`)
          .groupBy(managementLevel),
      ]);

    const STATIC_DEPARTMENTS = ["Investment Advisor"];
    const dbDepartments = departments.map((r) => r.value).filter(Boolean) as string[];
    const dbRoleNames = roleNames.map((r) => r.value).filter(Boolean) as string[];
    const mergedDepartments = [...new Set([...dbDepartments, ...dbRoleNames, ...STATIC_DEPARTMENTS])].sort((a, b) =>
      a.localeCompare(b)
    );

    res.json({
      industries: industries.map((r) => r.value).filter(Boolean),
      departments: mergedDepartments,
      seniorities: seniorities.map((r) => r.value).filter(Boolean),
      managementLevels: MANAGEMENT_LEVELS.map((value) => ({
        value,
        count: managementLevelCounts.find((entry) => entry.value === value)?.count ?? 0,
      })),
      companySizes: sortCompanySizes(companySizes.map((r) => r.value).filter(Boolean) as string[]),
      countries: countries.map((r) => r.value).filter(Boolean),
      locations: locations.map((r) => r.value).filter(Boolean),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
