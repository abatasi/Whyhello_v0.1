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
 * GET /contacts/:contactId/counterpart-insights
 *
 * Returns up to 10 personal insights drawn from professional counterparts —
 * contacts who share the same role (role_id) but work at a different company.
 *
 * Two groups:
 *   Group 1 — same role + same industry + different company  (closest peers)
 *   Group 2 — same role + different industry + different company  (cross-sector peers)
 *
 * Selection: quotable insights first, then non-quotable fill-ins, each using
 * diversity-biased round-robin across contact buckets. Group 1 buckets are
 * listed first so they get priority pick. Each insight is tagged with
 * counterpartGroup (1 or 2) and sourceContact metadata.
 */
router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) {
      res.status(400).json({ error: "Invalid contact ID" });
      return;
    }

    // ── 1. Resolve role + industry + company for the given contact ────────
    const [contact] = await db
      .select({
        roleId:     contactsTable.roleId,
        industryId: contactsTable.industryId,
        companyId:  contactsTable.companyId,
      })
      .from(contactsTable)
      .where(eq(contactsTable.id, contactId));

    if (!contact?.roleId) {
      res.json([]);
      return;
    }

    // ── 2. Find all contacts: same role, different company ────────────────
    const allCounterparts = await db
      .select({
        id:         contactsTable.id,
        firstName:  contactsTable.firstName,
        lastName:   contactsTable.lastName,
        jobTitle:   contactsTable.jobTitle,
        industryId: contactsTable.industryId,
        companyId:  contactsTable.companyId,
      })
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.roleId, contact.roleId),
          ne(contactsTable.id, contactId),
          ...(contact.companyId ? [ne(contactsTable.companyId, contact.companyId)] : [])
        )
      );

    if (allCounterparts.length === 0) {
      res.json([]);
      return;
    }

    // ── 3. Split into Group 1 (same industry) and Group 2 (diff industry) ─
    const group1Ids = new Set(
      allCounterparts
        .filter(c => contact.industryId != null && c.industryId === contact.industryId)
        .map(c => c.id)
    );
    const group2Ids = new Set(
      allCounterparts
        .filter(c => !group1Ids.has(c.id))
        .map(c => c.id)
    );

    const allCounterpartIds = allCounterparts.map(c => c.id);

    // ── 4. Pull their personal insights ──────────────────────────────────
    const insights = await db
      .select()
      .from(contactInsightsTable)
      .where(
        and(
          inArray(contactInsightsTable.contactId, allCounterpartIds),
          eq(contactInsightsTable.category, "personal")
        )
      );

    if (insights.length === 0) {
      res.json([]);
      return;
    }

    // ── 5. Load relevance scores ───────────────────────────────────────────
    const insightIds = insights.map(i => i.id);
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
          inArray(insightQuotesTable.contactId, allCounterpartIds),
          eq(insightQuotesTable.signalType, "personal"),
          inArray(insightQuotesTable.signalId, insightIds),
        )
      );
    const quotableBySignal = new Map(quotables.map((q) => [q.signalId, q]));
    const hasQuotable = (insight: typeof insights[number]) => quotableBySignal.has(insight.id);
    const scores = await db
      .select({
        signalId: insightRelevanceScoresTable.signalId,
        score:    insightRelevanceScoresTable.score,
      })
      .from(insightRelevanceScoresTable)
      .where(
        and(
          eq(insightRelevanceScoresTable.contactId, contactId),
          eq(insightRelevanceScoresTable.signalType, "counterpart"),
          inArray(insightRelevanceScoresTable.signalId, insightIds)
        )
      );

    const scoreMap = new Map<number, number>(scores.map(s => [s.signalId, s.score]));

    const selectDiverse = (candidates: typeof insights, limit: number): typeof insights => {
      const buckets = new Map<number, typeof insights>();
      for (const insight of candidates) {
        if (!buckets.has(insight.contactId)) buckets.set(insight.contactId, []);
        buckets.get(insight.contactId)!.push(insight);
      }
      for (const items of buckets.values()) {
        items.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
      }

      const sortBucketsByScore = (ids: Set<number>) =>
        Array.from(buckets.entries())
          .filter(([cid]) => ids.has(cid))
          .sort(([, a], [, b]) => (scoreMap.get(b[0]?.id ?? -1) ?? 0) - (scoreMap.get(a[0]?.id ?? -1) ?? 0))
          .map(([, items]) => items);
      const orderedBuckets = [
        ...sortBucketsByScore(group1Ids),
        ...sortBucketsByScore(group2Ids),
      ];

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

    const selected: typeof insights = [];
    const take = (candidates: typeof insights) => {
      if (selected.length >= 10) return;
      selected.push(...selectDiverse(candidates, 10 - selected.length));
    };
    const group1Insights = insights.filter((insight) => group1Ids.has(insight.contactId));
    const group2Insights = insights.filter((insight) => group2Ids.has(insight.contactId));
    // Preserve Group 1 priority, then apply Quotable-first selection within
    // each group before allowing the next group to fill remaining slots.
    take(group1Insights.filter(hasQuotable));
    take(group1Insights.filter((insight) => !hasQuotable(insight)));
    take(group2Insights.filter(hasQuotable));
    take(group2Insights.filter((insight) => !hasQuotable(insight)));

    // ── 10. Build counterpart metadata lookup ─────────────────────────────
    const uniqueCompanyIds = [
      ...new Set(allCounterparts.map(c => c.companyId).filter(Boolean)),
    ] as number[];
    const companies = uniqueCompanyIds.length > 0
      ? await db
          .select({ id: companiesTable.id, name: companiesTable.name })
          .from(companiesTable)
          .where(inArray(companiesTable.id, uniqueCompanyIds))
      : [];
    const companyNameMap = new Map(companies.map(c => [c.id, c.name]));
    const counterpartMetaMap = new Map(
      allCounterparts.map(c => [
        c.id,
        {
          id:          c.id,
          name:        [c.firstName, c.lastName].filter(Boolean).join(" "),
          jobTitle:    c.jobTitle ?? null,
          companyName: c.companyId ? (companyNameMap.get(c.companyId) ?? null) : null,
        },
      ])
    );

    // ── 11. Shape response ─────────────────────────────────────────────────
    const result = selected.map(i => ({
      id:             i.id,
      contactId,
      title:          i.title,
      url:            i.url,
      source:         i.source,
      mediaType:      i.mediaType,
      description:    i.description,
      publishedDate:  i.publishedDate,
      counterpartGroup: group1Ids.has(i.contactId) ? 1 : 2,
       sourceContact:  counterpartMetaMap.get(i.contactId) ?? null,
       quotable:       quotableBySignal.get(i.id) ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
