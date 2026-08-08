import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactInsightsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) {
      res.status(400).json({ error: "Invalid contact ID" });
      return;
    }
    const insights = await db
      .select()
      .from(contactInsightsTable)
      .where(and(
        eq(contactInsightsTable.contactId, contactId),
        eq(contactInsightsTable.category, "personal"),
      ))
      .orderBy(contactInsightsTable.mediaType);
    res.json(insights);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /contacts/:contactId/insights/:insightId — enrich source and/or publishedDate */
router.patch("/:insightId", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const insightId = parseInt(req.params.insightId);
    if (isNaN(contactId) || isNaN(insightId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { source, publishedDate } = req.body as {
      source?: string | null;
      publishedDate?: string | null;
    };

    const patch: Partial<typeof contactInsightsTable.$inferInsert> = {};
    if (source !== undefined) patch.source = source ?? undefined;
    if (publishedDate !== undefined) patch.publishedDate = publishedDate;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    await db
      .update(contactInsightsTable)
      .set(patch)
      .where(
        and(
          eq(contactInsightsTable.id, insightId),
          eq(contactInsightsTable.contactId, contactId),
        ),
      );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
