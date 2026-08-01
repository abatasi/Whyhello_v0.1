import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contactInsightsTable,
  contactsTable,
  companiesTable,
  insightRelevanceScoresTable,
} from "@workspace/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

/**
 * GET /contacts/:contactId/colleague-insights
 *
 * Returns up to 10 personal insights drawn from contacts who work at the same
 * company as the given contact.
 *
 * Sorting: ranked by relevance score (signalType='colleague') descending.
 * Diversity bias: uses round-robin selection across colleague buckets so that
 * no single colleague monopolises the list, even if they hold the majority of
 * high-scoring insights.
 */
router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) {
      res.status(400).json({ error: "Invalid contact ID" });
      return;
    }

    // ── 1. Resolve company ────────────────────────────────────────────────
    const [contact] = await db
      .select({ companyId: contactsTable.companyId })
      .from(contactsTable)
      .where(eq(contactsTable.id, contactId));

    if (!contact?.companyId) {
      res.json([]);
      return;
    }

    // ── 2. Find colleagues (same company, different contact) ──────────────
    const colleagues = await db
      .select({
        id: contactsTable.id,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        jobTitle: contactsTable.jobTitle,
        companyId: contactsTable.companyId,
      })
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.companyId, contact.companyId),
          ne(contactsTable.id, contactId)
        )
      );

    if (colleagues.length === 0) {
      res.json([]);
      return;
    }

    const colleagueIds = colleagues.map((c) => c.id);

    // ── 3. Pull their personal insights ──────────────────────────────────
    const insights = await db
      .select()
      .from(contactInsightsTable)
      .where(
        and(
          inArray(contactInsightsTable.contactId, colleagueIds),
          eq(contactInsightsTable.category, "personal")
        )
      );

    if (insights.length === 0) {
      res.json([]);
      return;
    }

    // ── 4. Load relevance scores ───────────────────────────────────────────
    // Colleague insights are personal insights from other contacts. Their
    // scores are stored under each colleague's own contactId with
    // signalType='personal' — NOT under the target contact with
    // signalType='colleague'. Query by colleague contactIds instead.
    const insightIds = insights.map((i) => i.id);
    const scores = await db
      .select({
        signalId: insightRelevanceScoresTable.signalId,
        score: insightRelevanceScoresTable.score,
      })
      .from(insightRelevanceScoresTable)
      .where(
        and(
          inArray(insightRelevanceScoresTable.contactId, colleagueIds),
          eq(insightRelevanceScoresTable.signalType, "personal"),
          inArray(insightRelevanceScoresTable.signalId, insightIds)
        )
      );

    const scoreMap = new Map<number, number>(scores.map((s) => [s.signalId, s.score]));

    // ── 5. Group insights by colleague, sort each group by score desc ─────
    const buckets = new Map<number, typeof insights>();
    for (const insight of insights) {
      if (!buckets.has(insight.contactId)) buckets.set(insight.contactId, []);
      buckets.get(insight.contactId)!.push(insight);
    }
    for (const items of buckets.values()) {
      items.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
    }

    // Sort colleague buckets by their best insight's score so the most-relevant
    // colleagues get their first pick before less-relevant ones do.
    const orderedBuckets = Array.from(buckets.values()).sort(
      (a, b) => (scoreMap.get(b[0]?.id ?? -1) ?? 0) - (scoreMap.get(a[0]?.id ?? -1) ?? 0)
    );

    // ── 6. Diversity-biased round-robin selection (up to 10) ──────────────
    // Each round picks one insight per colleague in score order, ensuring no
    // single colleague dominates even when they have many high-scoring items.
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

    // ── 8. Build colleague metadata lookup (name, title, company) ─────────
    const uniqueCompanyIds = [...new Set(colleagues.map((c) => c.companyId).filter(Boolean))] as number[];
    const companies = uniqueCompanyIds.length > 0
      ? await db
          .select({ id: companiesTable.id, name: companiesTable.name })
          .from(companiesTable)
          .where(inArray(companiesTable.id, uniqueCompanyIds))
      : [];
    const companyNameMap = new Map(companies.map((c) => [c.id, c.name]));
    const colleagueMetaMap = new Map(
      colleagues.map((c) => [
        c.id,
        {
          name: [c.firstName, c.lastName].filter(Boolean).join(" "),
          jobTitle: c.jobTitle ?? null,
          companyName: c.companyId ? (companyNameMap.get(c.companyId) ?? null) : null,
        },
      ])
    );

    // ── 9. Shape response to match ColleagueInsight API contract ──────────
    const result = selected.map((i) => ({
      id: i.id,
      contactId,           // the contact whose profile this is (API compatibility)
      title: i.title,
      url: i.url,
      source: i.source,
      mediaType: i.mediaType,
      description: i.description,
      publishedDate: i.publishedDate,
      sourceContact: colleagueMetaMap.get(i.contactId) ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
