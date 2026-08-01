import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contactInsightsTable,
  contactsTable,
  insightRelevanceScoresTable,
} from "@workspace/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

/**
 * GET /contacts/:contactId/counterpart-insights
 *
 * Returns up to 10 personal insights drawn from contacts who work in the same
 * industry as the given contact but at a different company — i.e. their
 * professional counterparts in the market.
 *
 * Sorting: ranked by relevance score (signalType='counterpart') descending.
 * Diversity bias: round-robin across counterpart buckets so no single
 * counterpart dominates the list.
 */
router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) {
      res.status(400).json({ error: "Invalid contact ID" });
      return;
    }

    // ── 1. Resolve industry + company for the given contact ───────────────
    const [contact] = await db
      .select({
        industryId: contactsTable.industryId,
        companyId: contactsTable.companyId,
      })
      .from(contactsTable)
      .where(eq(contactsTable.id, contactId));

    if (!contact?.industryId) {
      res.json([]);
      return;
    }

    // ── 2. Find counterparts (same industry, different company) ───────────
    const counterparts = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.industryId, contact.industryId),
          ne(contactsTable.id, contactId),
          // Exclude colleagues (same company) — those live in Colleague Insights
          ...(contact.companyId
            ? [ne(contactsTable.companyId, contact.companyId)]
            : [])
        )
      );

    if (counterparts.length === 0) {
      res.json([]);
      return;
    }

    const counterpartIds = counterparts.map((c) => c.id);

    // ── 3. Pull their personal insights ──────────────────────────────────
    const insights = await db
      .select()
      .from(contactInsightsTable)
      .where(
        and(
          inArray(contactInsightsTable.contactId, counterpartIds),
          eq(contactInsightsTable.category, "personal")
        )
      );

    if (insights.length === 0) {
      res.json([]);
      return;
    }

    // ── 4. Load relevance scores (signalType='counterpart') ───────────────
    const insightIds = insights.map((i) => i.id);
    const scores = await db
      .select({
        signalId: insightRelevanceScoresTable.signalId,
        score: insightRelevanceScoresTable.score,
      })
      .from(insightRelevanceScoresTable)
      .where(
        and(
          eq(insightRelevanceScoresTable.contactId, contactId),
          eq(insightRelevanceScoresTable.signalType, "counterpart"),
          inArray(insightRelevanceScoresTable.signalId, insightIds)
        )
      );

    const scoreMap = new Map<number, number>(scores.map((s) => [s.signalId, s.score]));

    // ── 5. Group insights by counterpart, sort each group by score desc ───
    const buckets = new Map<number, typeof insights>();
    for (const insight of insights) {
      if (!buckets.has(insight.contactId)) buckets.set(insight.contactId, []);
      buckets.get(insight.contactId)!.push(insight);
    }
    for (const items of buckets.values()) {
      items.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
    }

    // Sort counterpart buckets by their best insight's score
    const orderedBuckets = Array.from(buckets.values()).sort(
      (a, b) => (scoreMap.get(b[0]?.id ?? -1) ?? 0) - (scoreMap.get(a[0]?.id ?? -1) ?? 0)
    );

    // ── 6. Diversity-biased round-robin selection (up to 10) ──────────────
    const selected: typeof insights = [];
    let round = 0;
    while (selected.length < 10) {
      let anyAdded = false;
      for (const bucket of orderedBuckets) {
        if (selected.length >= 10) break;
        if (round < bucket.length) {
          selected.push(bucket[round]);
          anyAdded = true;
        }
      }
      if (!anyAdded) break;
      round++;
    }

    // ── 7. Final sort by relevance score desc ─────────────────────────────
    selected.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));

    // ── 8. Shape response to match CounterpartInsight API contract ─────────
    const result = selected.map((i) => ({
      id: i.id,
      contactId,           // the contact whose profile this is (API compatibility)
      title: i.title,
      url: i.url,
      source: i.source,
      mediaType: i.mediaType,
      description: i.description,
      publishedDate: i.publishedDate,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
