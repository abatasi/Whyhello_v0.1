import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companiesTable, contactMetaScoresTable, contactsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

function scoreCategory(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Potential";
  return "Low Fit";
}

router.get("/top-leads", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(String(req.query.limit ?? "10"), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(10, Math.max(1, requestedLimit)) : 10;
    const rows = await db
      .select({
        id: contactsTable.id,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        email: contactsTable.email,
        jobTitle: contactsTable.jobTitle,
        companyName: companiesTable.name,
        location: contactsTable.location,
        score: contactMetaScoresTable.metaScore,
      })
      .from(contactMetaScoresTable)
      .innerJoin(contactsTable, eq(contactMetaScoresTable.contactId, contactsTable.id))
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .orderBy(desc(contactMetaScoresTable.metaScore), desc(contactsTable.id))
      .limit(limit);

    res.json(rows.map((row) => ({ ...row, scoreCategory: scoreCategory(row.score) })));
  } catch (error) {
    console.error("Top leads GET error:", error);
    res.status(500).json({ error: "Failed to load top leads" });
  }
});

export default router;