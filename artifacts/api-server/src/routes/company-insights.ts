import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companyInsightsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) {
      res.status(400).json({ error: "Invalid company ID" });
      return;
    }
    const insights = await db
      .select()
      .from(companyInsightsTable)
      .where(eq(companyInsightsTable.companyId, companyId))
      .orderBy(companyInsightsTable.mediaType);
    res.json(insights);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /companies/:companyId/insights/:insightId — enrich source and/or publishedDate */
router.patch("/:insightId", async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const insightId = parseInt(req.params.insightId);
    if (isNaN(companyId) || isNaN(insightId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { source, publishedDate } = req.body as {
      source?: string | null;
      publishedDate?: string | null;
    };

    const patch: Partial<typeof companyInsightsTable.$inferInsert> = {};
    if (source !== undefined) patch.source = source ?? undefined;
    if (publishedDate !== undefined) patch.publishedDate = publishedDate;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    await db
      .update(companyInsightsTable)
      .set(patch)
      .where(
        and(
          eq(companyInsightsTable.id, insightId),
          eq(companyInsightsTable.companyId, companyId),
        ),
      );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
