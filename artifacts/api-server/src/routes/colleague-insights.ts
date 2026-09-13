import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contactInsightsTable,
  contactsTable,
  companiesTable,
  insightQuotesTable,
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
 * Selection priority: insights with a quotable from the source colleague first,
 * then non-quotable insights if more slots are available.
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

    // ── 4. Load relevance scores (signalType='colleague') ─────────────────
    // Scores are computed by the relevance/score route, which fetches dynamic
    // colleague insights and stores them under the target contactId with
    // signalType='colleague'. The UI looks up `colleague-${id}` from the map,
    // so we must query by the target contactId + signalType='colleague'.
    const insightIds = insights.map((i) => i.id);
    const quotables = await db
      .select({
        signalId: insightQuotesTable.signalId,
        quote: insightQuotesTable.quote,
        attribution: insightQuotesTable.attribution,
        attributionRole: insightQuotesTable.attributionRole,
        hqBridge: insightQuotesTable.hqBridge,
      })
      .from(insightQuotesTable)
      .where(
        and(
          inArray(insightQuotesTable.contactId, colleagueIds),
          eq(insightQuotesTable.signalType, "personal"),
          inArray(insightQuotesTable.signalId, insightIds),
        )
      );
    const quotableBySignal = new Map(quotables.map((q) => [q.signalId, q]));
    const hasQuotable = (insight: typeof insights[number]) => quotableBySignal.has(insight.id);

    const scores = await db
      .select({
        signalId: insightRelevanceScoresTable.signalId,
        score: insightRelevanceScoresTable.score,
      })
      .from(insightRelevanceScoresTable)
      .where(
        and(
          eq(insightRelevanceScoresTable.contactId, contactId),
          eq(insightRelevanceScoresTable.signalType, "colleague"),
          inArray(insightRelevanceScoresTable.signalId, insightIds)
        )
      );

    const scoreMap = new Map<number, number>(scores.map((s) => [s.signalId, s.score]));

    const selectDiverse = (candidates: typeof insights, limit: number): typeof insights => {
      const buckets = new Map<number, typeof insights>();
      for (const insight of candidates) {
        if (!buckets.has(insight.contactId)) buckets.set(insight.contactId, []);
        buckets.get(insight.contactId)!.push(insight);
      }
      for (const items of buckets.values()) {
        items.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
      }

      const orderedBuckets = Array.from(buckets.values()).sort(
        (a, b) => (scoreMap.get(b[0]?.id ?? -1) ?? 0) - (scoreMap.get(a[0]?.id ?? -1) ?? 0)
      );
      const selected: typeof insights = [];
      let round = 0;
      while (selected.length < limit) {
        let anyAdded = false;
        for (const bucket of orderedBuckets) {
          if (selected.length >= limit) break;
          if (round < bucket.length) {
            selected.push(bucket[round]);
            anyAdded = true;
          }
        }
        if (!anyAdded) break;
        round++;
      }
      return selected;
    };

    // Always exhaust the quotable tier first; use non-quotables only to fill
    // remaining slots when there are fewer than ten usable quotes.
    const quotableInsights = insights.filter(hasQuotable);
    const nonQuotableInsights = insights.filter((insight) => !hasQuotable(insight));
    const selected = [
      ...selectDiverse(quotableInsights, 10),
      ...selectDiverse(nonQuotableInsights, Math.max(0, 10 - quotableInsights.length)),
    ];

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
          id: c.id,
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
      quotable: quotableBySignal.get(i.id) ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
