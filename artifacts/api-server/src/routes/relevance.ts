import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  contactsTable,
  contactInsightsTable,
  companyInsightsTable,
  industryInsightsTable,
  roleInsightsTable,
  counterpartInsightsTable,
  dnaProfilesTable,
  insightRelevanceScoresTable,
  insightQuotesTable,
  contactMetaScoresTable,
} from "@workspace/db/schema";
import { eq, and, inArray, ne, gt, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getAuth } from "@clerk/express";
import { inspectLinkedInSource, type LinkedInSourceData } from "../lib/linkedin-source";

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

const LINKEDIN_MEDIA_TYPES = new Set(["linkedin", "linkedin_post"]);
const VIDEO_MEDIA_TYPES = new Set(["video", "youtube", "youtube_video"]);
const RELEVANCE_REFRESH_WINDOW_MS = 10 * 60 * 1000;
const FRESHNESS_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const FRESHNESS_ANNUAL_DECAY = 0.2;
const FRESHNESS_FLOOR = 0.2;
const ORDINARY_SCORE_FLOOR = 10;
const EXTRAORDINARY_SCORE_THRESHOLD = 10;
const FEATURED_VIDEO_SCORE_FLOOR = 85;

function parseInsightDate(value: string | null | undefined): Date | null {
  const normalized = value?.trim();
  if (!normalized || /^(n\/?a|unknown|null|undefined)$/i.test(normalized)) return null;

  const yearOnly = normalized.match(/^(\d{4})$/);
  if (yearOnly) return new Date(Date.UTC(Number(yearOnly[1]), 0, 1));

  const yearMonth = normalized.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) return new Date(Date.UTC(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1));

  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

/**
 * Insights remain fully fresh for their first year. Each year after that
 * reduces their score by 20 percentage points, with a small residual value
 * retained for old but potentially useful context.
 */
function freshnessMultiplier(publishedDate: string | null | undefined, now = Date.now()): number {
  const date = parseInsightDate(publishedDate);
  if (!date) return 1;

  const ageYears = Math.max(0, now - date.getTime()) / FRESHNESS_YEAR_MS;
  if (ageYears <= 1) return 1;

  return Math.max(FRESHNESS_FLOOR, 1 - ((ageYears - 1) * FRESHNESS_ANNUAL_DECAY));
}

function linkedinAuthorSlug(url: string | null): string | null {
  const match = url?.match(/linkedin\.com\/posts\/([^_/?#]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function linkedinProfileSlug(url: string | null): string | null {
  const match = url?.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase().replace(/\/$/, "") ?? null;
}

function isContactAuthoredLinkedInSignal(
  signal: { title: string; url: string | null },
  contact: { firstName: string; lastName: string; linkedinUrl: string | null },
): boolean {
  const contactSlug = linkedinProfileSlug(contact.linkedinUrl)
    ?? `${contact.firstName}-${contact.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const authorSlug = linkedinAuthorSlug(signal.url);
  if (authorSlug && (authorSlug === contactSlug || authorSlug.startsWith(`${contactSlug}-`))) return true;

  const title = signal.title.toLowerCase();
  const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
  return title === fullName
    || title.startsWith(`${fullName}'s post`)
    || title.startsWith(`${fullName} -`);
}

const router: IRouter = Router({ mergeParams: true });

// ── GET /api/contacts/:contactId/insights/relevance ──────────────────────────
// Returns stored relevance scores for all signals for this contact.

router.get("/relevance", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    const rows = await db
      .select()
      .from(insightRelevanceScoresTable)
      .where(eq(insightRelevanceScoresTable.contactId, contactId));

    const scores = rows.map((r) => ({
      signalType: r.signalType,
      signalId: r.signalId,
      score: r.score,
      description: r.description,
      matchedHqSignals: r.matchedHqSignals ? (JSON.parse(r.matchedHqSignals) as string[]) : [],
      computedAt: r.computedAt,
    }));

    res.json(scores);
  } catch (err) {
    console.error("Relevance GET error:", err);
    res.status(500).json({ error: "Failed to load relevance scores" });
  }
});

// ── POST /api/contacts/:contactId/insights/relevance/score ───────────────────
// Fetches all outside-in signals + HQ inside-out profile, scores every signal
// with AI, persists results, and returns the scored list.

router.post("/relevance/score", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }

  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const forceRefresh = req.body?.force === true;

    // 1. Load contact (to get companyId / industryId / roleId)
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.id, contactId))
      .limit(1);
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    // 2. Fetch all outside-in signals in parallel
    // Colleague insights: dynamic — personal insights from contacts at the same company.
    // Counterpart insights: dynamic — personal insights from contacts in the same industry at other companies.
    const colleagueContactsPromise = contact.companyId
      ? db.select({ id: contactsTable.id })
          .from(contactsTable)
          .where(and(eq(contactsTable.companyId, contact.companyId), ne(contactsTable.id, contactId)))
      : Promise.resolve([]);

    // Counterparts: same role_id, different company (Group 1: same industry; Group 2: different industry)
    const counterpartContactsPromise = contact.roleId
      ? db.select({ id: contactsTable.id })
          .from(contactsTable)
          .where(and(
            eq(contactsTable.roleId, contact.roleId),
            ne(contactsTable.id, contactId),
            ...(contact.companyId ? [ne(contactsTable.companyId, contact.companyId)] : [])
          ))
      : Promise.resolve([]);

    const [personal, company, industry, role, colleagueContacts, counterpartContacts, quotes] = await Promise.all([
      db.select().from(contactInsightsTable)
        .where(and(eq(contactInsightsTable.contactId, contactId), eq(contactInsightsTable.category, "personal"))),
      contact.companyId
        ? db.select().from(companyInsightsTable).where(eq(companyInsightsTable.companyId, contact.companyId))
        : Promise.resolve([]),
      contact.industryId
        ? db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, contact.industryId))
        : Promise.resolve([]),
      contact.roleId
        ? db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contact.roleId))
        : Promise.resolve([]),
      colleagueContactsPromise,
      counterpartContactsPromise,
      // Fetch extracted quotables for this contact — used to enrich signal blocks and apply bonus
      db.select().from(insightQuotesTable).where(eq(insightQuotesTable.contactId, contactId)),
    ]);

    const colleagueIds = colleagueContacts.map((c) => c.id);
    const counterpartIds = counterpartContacts.map((c) => c.id);
    const sourceContactIds = [...new Set([...colleagueIds, ...counterpartIds])];
    const sourceQuotes = sourceContactIds.length > 0
      ? await db
          .select()
          .from(insightQuotesTable)
          .where(inArray(insightQuotesTable.contactId, sourceContactIds))
      : [];

    // Cap colleague/counterpart signals so the AI prompt stays manageable.
    // Round-robin across contacts so no single contact dominates the sample.
    const MAX_COLLEAGUE_SIGNALS = 25;
    const MAX_COUNTERPART_SIGNALS = 25;

    async function fetchCappedInsights(contactIds: number[], max: number) {
      if (contactIds.length === 0) return [];
      const all = await db.select().from(contactInsightsTable)
        .where(and(inArray(contactInsightsTable.contactId, contactIds), eq(contactInsightsTable.category, "personal")));
      if (all.length <= max) return all;
      // Round-robin: group by contactId, pick one from each in turn
      const buckets = new Map<number, typeof all>();
      for (const row of all) {
        if (!buckets.has(row.contactId)) buckets.set(row.contactId, []);
        buckets.get(row.contactId)!.push(row);
      }
      for (const bucket of buckets.values()) {
        bucket.sort((a, b) => {
          const bHasQuote = sourceQuotes.some((q) => q.contactId === b.contactId && q.signalType === "personal" && q.signalId === b.id);
          const aHasQuote = sourceQuotes.some((q) => q.contactId === a.contactId && q.signalType === "personal" && q.signalId === a.id);
          return Number(bHasQuote) - Number(aHasQuote);
        });
      }
      const result: typeof all = [];
      let round = 0;
      const bucketList = Array.from(buckets.values());
      while (result.length < max) {
        let added = false;
        for (const bucket of bucketList) {
          if (result.length >= max) break;
          if (round < bucket.length) { result.push(bucket[round]); added = true; }
        }
        if (!added) break;
        round++;
      }
      return result;
    }

    const [colleague, counterpart] = await Promise.all([
      fetchCappedInsights(colleagueIds, MAX_COLLEAGUE_SIGNALS),
      fetchCappedInsights(counterpartIds, MAX_COUNTERPART_SIGNALS),
    ]);

    // 3. Build quotable lookup: "signalType-signalId" → quote row
    type QuotableInfo = { quote: string; attribution: string; attributionRole: string | null; hqBridge: string | null };
    const quoteMap = new Map<string, QuotableInfo>();
    for (const q of quotes) {
      quoteMap.set(`${q.signalType}-${q.signalId}`, {
        quote: q.quote,
        attribution: q.attribution,
        attributionRole: q.attributionRole ?? null,
        hqBridge: q.hqBridge ?? null,
      });
    }
     for (const q of sourceQuotes) {
       const signalType = colleagueIds.includes(q.contactId)
         ? "colleague"
         : counterpartIds.includes(q.contactId)
           ? "counterpart"
           : null;
       if (!signalType) continue;
       quoteMap.set(`${signalType}-${q.signalId}`, {
         quote: q.quote,
         attribution: q.attribution,
         attributionRole: q.attributionRole ?? null,
         hqBridge: q.hqBridge ?? null,
       });
     }

    // 4. Build flat signal list for the prompt
    type SignalRow = {
      signalType: string;
      signalId: number;
      title: string;
      url: string | null;
      mediaType: string | null;
      description: string | null;
      publishedDate: string | null;
      quotable: QuotableInfo | undefined;
    };
    const signals: SignalRow[] = [
      ...personal.map((s) => ({ signalType: "personal", signalId: s.id, title: s.title, url: s.url, mediaType: s.mediaType, description: s.description, publishedDate: s.publishedDate, quotable: quoteMap.get(`personal-${s.id}`) })),
      ...company.map((s) => ({ signalType: "company", signalId: s.id, title: s.title, url: null, mediaType: null, description: s.description, publishedDate: s.publishedDate, quotable: quoteMap.get(`company-${s.id}`) })),
      ...industry.map((s) => ({ signalType: "industry", signalId: s.id, title: s.title, url: null, mediaType: null, description: s.description, publishedDate: s.publishedDate, quotable: quoteMap.get(`industry-${s.id}`) })),
      ...role.map((s) => ({ signalType: "role", signalId: s.id, title: s.title, url: null, mediaType: null, description: s.description, publishedDate: s.publishedDate, quotable: quoteMap.get(`role-${s.id}`) })),
      ...colleague.map((s) => ({ signalType: "colleague", signalId: s.id, title: s.title, url: s.url, mediaType: s.mediaType, description: s.description, publishedDate: s.publishedDate, quotable: quoteMap.get(`colleague-${s.id}`) })),
      ...counterpart.map((s) => ({ signalType: "counterpart", signalId: s.id, title: s.title, url: s.url, mediaType: s.mediaType, description: s.description, publishedDate: s.publishedDate, quotable: quoteMap.get(`counterpart-${s.id}`) })),
    ];

    // Keep relevance refreshes to one run per contact every ten minutes.
    // This server-side guard protects against duplicate tabs and callers that
    // bypass the client-side freshness check.
    const existingScores = await db
      .select()
      .from(insightRelevanceScoresTable)
      .where(eq(insightRelevanceScoresTable.contactId, contactId));
    const latestComputedAt = existingScores.reduce((latest, score) => {
      const timestamp = new Date(score.computedAt).getTime();
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);
    if (
      !forceRefresh
      &&
      latestComputedAt > 0
      && Date.now() - latestComputedAt < RELEVANCE_REFRESH_WINDOW_MS
    ) {
      res.json(existingScores.map((score) => ({
        signalType: score.signalType,
        signalId: score.signalId,
        score: score.score,
        description: score.description,
        matchedHqSignals: score.matchedHqSignals ? (JSON.parse(score.matchedHqSignals) as string[]) : [],
        computedAt: score.computedAt,
      })));
      return;
    }

    // Set of signal keys that have an extracted quotable — used for post-processing boost
    const quotableKeys = new Set(signals.filter((s) => s.quotable).map((s) => `${s.signalType}-${s.signalId}`));

    if (signals.length === 0) {
      res.json([]);
      return;
    }

    // Inspect public LinkedIn content so the model can score the underlying
    // source itself. A reshare is not inherently weaker than an original post;
    // its value depends on what was actually shared.
    const linkedInSources = new Map<string, LinkedInSourceData>();
    await Promise.all(
      signals
        .filter((signal) =>
          signal.signalType === "personal"
          && LINKEDIN_MEDIA_TYPES.has(signal.mediaType ?? "")
        )
        .map(async (signal) => {
          if (!signal.url) return;
          linkedInSources.set(`${signal.signalType}-${signal.signalId}`, await inspectLinkedInSource(signal.url));
        }),
    );

    // 5. Load HQ profile
    const [dnaRow] = await db
      .select()
      .from(dnaProfilesTable)
      .where(eq(dnaProfilesTable.userId, userId));

    const hqProfile = dnaRow ? (JSON.parse(dnaRow.data) as Record<string, unknown>) : {};
    const hqSummary = buildHqSummary(hqProfile);

    // 6. Build prompt and call AI
    // Signals with an extracted Quotable include the verbatim quote text so the AI can
    // assess HQ alignment using the actual spoken/written content, not just the title.
    const signalsList = signals
      .map((s, i) => {
        let block = `[${i + 1}] type="${s.signalType}" id=${s.signalId}\n  Media format: ${s.mediaType ?? "unknown"}\n  Title: ${s.title}\n  Description: ${s.description ?? "(none)"}`;
        if (VIDEO_MEDIA_TYPES.has(s.mediaType ?? "")) {
          block += `\n  Video source: ${s.url ?? "(no URL)"}`;
        }
        if (s.signalType === "personal" && LINKEDIN_MEDIA_TYPES.has(s.mediaType ?? "")) {
          const signalKey = `${s.signalType}-${s.signalId}`;
          const source = linkedInSources.get(signalKey);
          block += `\n  Relationship to contact: ${source?.isReshare
            ? "contact-authored LinkedIn reshare/share; evaluate the underlying shared content for its own HQ relevance and actionability. The fact that it was reshared is not a relevance penalty, and the shared author's viewpoint is not automatically the contact's viewpoint"
            : isContactAuthoredLinkedInSignal(s, contact)
              ? "contact-authored LinkedIn post"
              : "third-party LinkedIn post the contact may have engaged with; do not treat the post author's words as the contact's insight"}`;
          if (source?.postBody) block += `\n  Contact post caption/body: ${source.postBody}`;
          if (source?.sharedContent) block += `\n  Underlying shared content: ${source.sharedContent}`;
        }
        if (s.quotable) {
          block += `\n  ⭐ QUOTABLE: "${s.quotable.quote}"`;
          block += `\n     — ${s.quotable.attribution}${s.quotable.attributionRole ? `, ${s.quotable.attributionRole}` : ""}`;
          if (s.quotable.hqBridge) block += `\n     HQ Bridge note: ${s.quotable.hqBridge}`;
        }
        return block;
      })
      .join("\n\n");

    const prompt = `You are a B2B sales intelligence engine. Score each outside-in signal (news, posts, content) for how relevant it is to the seller's specific value proposition and capabilities as defined in their HQ profile.

SELLER'S HQ PROFILE (inside-out signals):
${hqSummary || "(No HQ profile configured — score based on general B2B relevance to a wealth management or financial advisory seller.)"}

OUTSIDE-IN SIGNALS TO SCORE:
${signalsList}

SCORING RUBRIC (0–100):
- 96-100: Exceptional and rare — reserve for a direct quote or statement from this contact that unmistakably maps to multiple named HQ items and creates an immediately usable outreach angle
- 90-95: Very strong connection — direct, specific, and highly usable, but not exceptional
- 80-89: Strong connection — signal explicitly surfaces a problem, goal, or context the seller directly addresses
- 60-79: Clear connection — signal meaningfully relates to the seller's value proposition, product, or ideal customer profile
- 40-59: Moderate connection — some overlap, but indirect or partial
- 20-39: Weak connection — only tangential overlap
- 0-19: No meaningful connection to the seller's offering

VIDEO FORMAT:
- Any Personal Insight with a video format is safely attributable to the contact. Treat it as memorable first-hand personal evidence and score the contact's perspective, claims, and priorities—not merely the video's topic.
- Apply an 85-point minimum to Personal video signals before freshness adjustments, even when the title or description does not repeat the contact's name.
- Videos in Company, Industry, Role, Colleague, or Counterpart Insights are not assumed to feature the contact directly. Score them under their normal category and HQ-alignment rules without a direct-attribution boost.

PERSONAL LINKEDIN PROXIMITY:
- A contact-authored LinkedIn post is direct personal evidence.
- A LinkedIn post authored by someone else is an engagement signal, not the contact's insight. Without a substantive comment or an explicit direct quote of the contact, keep it in the 0-55 range even when the post topic overlaps with the HQ.
- A third-party post with a substantive, attributable comment or direct quote from the contact may score higher, but must remain below an otherwise comparable contact-authored post.

Scores above 95 must be rare. Do not use 96-100 for an ordinary strong match, a generic topic overlap, or a third-party quote. When in doubt, score 90-95.

IMPORTANT — FOR ⭐ QUOTABLE SIGNALS: Use the complete source as the primary signal content, including the underlying shared content when it is available. A quotable is useful only when the content itself is relevant and actionable for this HQ profile. Do not let a generic, celebratory, inspirational, or otherwise non-actionable quote inflate the signal's HQ alignment. The HQ Bridge note, if present, may sharpen your assessment but cannot create a connection that the source does not contain. A separate bonus is applied only after the content score is returned.

For each signal:
- Write a 1–2 sentence description explaining WHAT in the HQ profile this signal connects to and WHY that linkage matters for outreach relevance. Evaluate the insight as a whole piece of content — its topic, angle, and what it signals about the contact's context. Frame it as "This post...", "This article...", "This announcement..." — never frame the description around the quote text.
- In "matchedHqSignals", list the SPECIFIC named items from the HQ profile that this signal touches — use the actual product names, exact differentiator phrases, pillar names, or customer profile types as they appear in the profile above. Do NOT return generic category labels like "value proposition" or "product". Return the real names and phrases (e.g. "Wealth Optimization Platform", "UHNW Family Office focus", "fee-only fiduciary model").

Return ONLY a valid JSON array — no preamble, no code fences, no explanation:
[{ "signalType": "...", "signalId": ..., "score": ..., "description": "...", "matchedHqSignals": ["<specific named HQ item>", "<another specific item>"] }]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) { res.status(500).json({ error: "AI returned unparseable response" }); return; }

    type ScoredSignal = {
      signalType: string;
      signalId: number;
      score: number;
      description: string;
      matchedHqSignals: string[];
    };
    const rawScored: ScoredSignal[] = JSON.parse(match[0]);

    // 7. Apply deterministic Quotable Bonus for signals with an extracted quote
    //    that scored ≥ 20 on HQ alignment — a quote that connects to nothing gets no lift.
    //
    //    Tiered boost by attribution proximity:
    //      +35 — quote attributed directly to this contact (their own words)
    //      +20 — quote attributed to someone else (colleague, peer, exec)
    //
    //    Self-attribution is detected by checking if the stored attribution string
    //    contains the contact's full name (case-insensitive).
    const QUOTABLE_BOOST_SELF = 35;   // contact's own words
    const QUOTABLE_BOOST_SELF_WEAK_CONTENT = 10; // relevant enough to discuss, but not strongly actionable
    const QUOTABLE_BOOST_OTHER = 20;  // third-party quote
    const QUOTABLE_HQ_FLOOR = 20;
    const QUOTABLE_STRONG_CONTENT_FLOOR = 60;
    const ORDINARY_SCORE_CEILING = 95;
    const EXCEPTIONAL_SCORE_FLOOR = 96;
    const ENGAGEMENT_SCORE_MULTIPLIER = 0.65;
    const ENGAGEMENT_WITH_CONTACT_EVIDENCE_MULTIPLIER = 0.8;
    const ENGAGEMENT_SCORE_CEILING = 55;
    const ENGAGEMENT_WITH_CONTACT_EVIDENCE_CEILING = 75;

    const contactFullName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.toLowerCase().trim();
    const isSelfAttributed = (q: QuotableInfo): boolean =>
      contactFullName.length > 0 && (
        q.attribution.toLowerCase().includes(contactFullName) ||
        contactFullName.split(" ").every((part) => q.attribution.toLowerCase().includes(part))
      );

    const scored: ScoredSignal[] = rawScored.map((s) => {
      const hqScore = Math.round(Math.max(0, Math.min(100, s.score)));
      // Scores below 10 are reserved for the model's explicit extraordinary
      // negative-evidence judgment. Ordinary weak, stale, or indirect signals
      // remain visible but are never allowed below the 10-point floor.
      const extraordinaryLowScore = hqScore < EXTRAORDINARY_SCORE_THRESHOLD;
      const applyScoreFloor = (score: number): number =>
        extraordinaryLowScore ? score : Math.max(ORDINARY_SCORE_FLOOR, score);
      const key = `${s.signalType}-${s.signalId}`;
      const sig = signals.find((x) => `${x.signalType}-${x.signalId}` === key);
      const quotable = sig?.quotable;
      const isPersonalVideo = !!sig
        && sig.signalType === "personal"
        && VIDEO_MEDIA_TYPES.has(sig.mediaType ?? "");
      const sourcePublishedDate = sig?.signalType === "personal"
        && LINKEDIN_MEDIA_TYPES.has(sig.mediaType ?? "")
        ? linkedInSources.get(key)?.publishedDate ?? sig.publishedDate
        : sig?.publishedDate;
      const isLinkedInEngagement = !!sig
        && sig.signalType === "personal"
        && LINKEDIN_MEDIA_TYPES.has(sig.mediaType ?? "")
        && !isContactAuthoredLinkedInSignal(sig, contact);
      const selfAttributedQuote = !!quotable && isSelfAttributed(quotable);
      const engagementCeiling = selfAttributedQuote
        ? ENGAGEMENT_WITH_CONTACT_EVIDENCE_CEILING
        : ENGAGEMENT_SCORE_CEILING;
      const engagementMultiplier = selfAttributedQuote
        ? ENGAGEMENT_WITH_CONTACT_EVIDENCE_MULTIPLIER
        : ENGAGEMENT_SCORE_MULTIPLIER;
      const proximityAdjustedScore = isLinkedInEngagement
        ? Math.min(engagementCeiling, Math.round(hqScore * engagementMultiplier))
        : hqScore;
      const formatAdjustedScore = isPersonalVideo
        ? Math.max(proximityAdjustedScore, FEATURED_VIDEO_SCORE_FLOOR)
        : proximityAdjustedScore;

      if (!quotable || hqScore < QUOTABLE_HQ_FLOOR) {
        const scoredBeforeFloor = Math.min(
          ORDINARY_SCORE_CEILING,
          Math.round(formatAdjustedScore * freshnessMultiplier(sourcePublishedDate)),
        );
        return {
          ...s,
          score: applyScoreFloor(scoredBeforeFloor),
        };
      }
      const boost = selfAttributedQuote && !isLinkedInEngagement
        ? hqScore >= QUOTABLE_STRONG_CONTENT_FLOOR
          ? QUOTABLE_BOOST_SELF
          : QUOTABLE_BOOST_SELF_WEAK_CONTENT
        : QUOTABLE_BOOST_OTHER;
      const boostedScore = Math.min(
        isLinkedInEngagement ? engagementCeiling : ORDINARY_SCORE_CEILING,
        formatAdjustedScore + boost,
      );
      // A 96–100 score is reserved for an unusually strong, self-attributed
      // quote that the AI itself judged exceptional. The bonus must not turn
      // an ordinary strong signal into a top-of-scale score.
      const exceptionalDirectQuote =
        selfAttributedQuote &&
        !isLinkedInEngagement &&
        hqScore >= EXCEPTIONAL_SCORE_FLOOR &&
        (s.matchedHqSignals?.length ?? 0) >= 2;
      const scoredBeforeFreshness = exceptionalDirectQuote ? hqScore : boostedScore;
      return {
        ...s,
        score: applyScoreFloor(
          Math.round(scoredBeforeFreshness * freshnessMultiplier(sourcePublishedDate)),
        ),
      };
    });

    // 8. Persist — delete old scores for this contact, insert new ones
    await db
      .delete(insightRelevanceScoresTable)
      .where(eq(insightRelevanceScoresTable.contactId, contactId));

    if (scored.length > 0) {
      await db.insert(insightRelevanceScoresTable).values(
        scored.map((s) => ({
          contactId,
          signalType: s.signalType,
          signalId: s.signalId,
          score: s.score,
          description: s.description,
          matchedHqSignals: JSON.stringify(s.matchedHqSignals ?? []),
          computedAt: new Date(),
        }))
      );
    }

    // 9. Compute and upsert the contact-level Meta Score.
    //    metaScore = round(mean(personalBest, companyBest, industryBest, roleBest))
    //    Categories without any scored signals default to 0.
    const bestByCategory = { personal: 0, company: 0, industry: 0, role: 0 };
    for (const s of scored) {
      const cat = s.signalType as keyof typeof bestByCategory;
      if (cat in bestByCategory) {
        bestByCategory[cat] = Math.max(bestByCategory[cat], s.score);
      }
    }
    const metaScore = Math.round(
      (bestByCategory.personal + bestByCategory.company + bestByCategory.industry + bestByCategory.role) / 4
    );
    const now = new Date();
    await db
      .insert(contactMetaScoresTable)
      .values({
        contactId,
        metaScore,
        personalBest: bestByCategory.personal,
        companyBest: bestByCategory.company,
        industryBest: bestByCategory.industry,
        roleBest: bestByCategory.role,
        signalCount: scored.length,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: contactMetaScoresTable.contactId,
        set: {
          metaScore,
          personalBest: bestByCategory.personal,
          companyBest: bestByCategory.company,
          industryBest: bestByCategory.industry,
          roleBest: bestByCategory.role,
          signalCount: scored.length,
          computedAt: now,
        },
      });

    // 10. Return the scored list
    res.json(
      scored.map((s) => ({
        signalType: s.signalType,
        signalId: s.signalId,
        score: s.score,
        description: s.description,
        matchedHqSignals: s.matchedHqSignals ?? [],
        computedAt: new Date(),
      }))
    );
  } catch (err) {
    console.error("Relevance score error:", err);
    res.status(500).json({ error: "Failed to score relevance" });
  }
});

// ── GET /api/contacts/:contactId/insights/relevance/meta ─────────────────────
// Returns the stored meta (aggregate) score for this contact, or null if scoring
// has never been run for them.

router.get("/relevance/meta", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    const [row] = await db
      .select()
      .from(contactMetaScoresTable)
      .where(eq(contactMetaScoresTable.contactId, contactId))
      .limit(1);

    if (!row) { res.json(null); return; }

    res.json({
      metaScore: row.metaScore,
      personalBest: row.personalBest,
      companyBest: row.companyBest,
      industryBest: row.industryBest,
      roleBest: row.roleBest,
      signalCount: row.signalCount,
      computedAt: row.computedAt,
    });
  } catch (err) {
    console.error("Meta score GET error:", err);
    res.status(500).json({ error: "Failed to load meta score" });
  }
});

// ── GET /api/contacts/:contactId/insights/relevance/top-contact ───────────────
// Returns the most relevant OTHER contact (highest avg relevance score), so the
// "Are you lost?" toast can link the user somewhere more useful.

router.get("/relevance/top-contact", async (req, res) => {
  try {
    const currentContactId = parseInt(req.params.contactId);
    if (isNaN(currentContactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    // Aggregate scores per contact, excluding the current one, requiring avg > 50
    const rows = await db
      .select({
        contactId: insightRelevanceScoresTable.contactId,
        avgScore: sql<number>`round(avg(${insightRelevanceScoresTable.score}))`.as("avg_score"),
        maxScore: sql<number>`max(${insightRelevanceScoresTable.score})`.as("max_score"),
      })
      .from(insightRelevanceScoresTable)
      .where(ne(insightRelevanceScoresTable.contactId, currentContactId))
      .groupBy(insightRelevanceScoresTable.contactId)
      .orderBy(sql`avg_score desc`)
      .limit(1);

    if (rows.length === 0) { res.json(null); return; }

    const top = rows[0];
    const [contact] = await db
      .select({
        id: contactsTable.id,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        title: contactsTable.title,
      })
      .from(contactsTable)
      .where(eq(contactsTable.id, top.contactId))
      .limit(1);

    if (!contact) { res.json(null); return; }

    res.json({
      contactId: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title ?? null,
      avgScore: top.avgScore,
      maxScore: top.maxScore,
    });
  } catch (err) {
    console.error("Top contact error:", err);
    res.status(500).json({ error: "Failed to find top contact" });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildHqSummary(profile: Record<string, unknown>): string {
  const lines: string[] = [];

  function toStringArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
    if (typeof val === "string" && val) return [val];
    return [];
  }
  function toObjArray(val: unknown): Record<string, unknown>[] {
    if (Array.isArray(val)) return val.filter((x): x is Record<string, unknown> => x !== null && typeof x === "object");
    return [];
  }

  const company = (profile.company ?? {}) as Record<string, unknown>;
  if (company.name) lines.push(`Seller: ${company.name}`);
  if (company.valueWedge) lines.push(`Core value proposition: ${company.valueWedge}`);
  if (company.positioning) lines.push(`Positioning: ${company.positioning}`);
  const diffs = toStringArray(company.differentiators);
  if (diffs.length) lines.push(`Key differentiators: ${diffs.join(" | ")}`);
  const pillars = toObjArray(company.pillars);
  if (pillars.length) {
    lines.push(`Messaging pillars: ${pillars.map((p) => `${p.name}: ${p.description ?? ""}`).join("; ")}`);
  }

  const products = toObjArray(profile.products);
  if (products.length) {
    lines.push("");
    lines.push("Products / Services:");
    for (const p of products) {
      lines.push(`  ${p.name}${p.tagline ? ": " + p.tagline : ""}`);
      const outcomes = toStringArray(p.outcomes);
      if (outcomes.length) lines.push(`    Outcomes: ${outcomes.slice(0, 4).join(", ")}`);
      const ebs = toObjArray(p.economicBenefits);
      if (ebs.length) {
        const ebText = ebs
          .map((eb) => `${eb.description}${eb.amount ? ` (${eb.amount} ${eb.unit} ${eb.frequency})` : ""}`)
          .join("; ");
        lines.push(`    Economic benefits: ${ebText}`);
      }
    }
  }

  const customers = toObjArray(profile.customers);
  if (customers.length) {
    lines.push("");
    lines.push("Proof points:");
    for (const c of customers.slice(0, 4)) {
      if (c.customerProfile) {
        lines.push(`  - ${c.customerProfile}${c.results ? ". Result: " + c.results : ""}`);
      }
    }
  }

  return lines.join("\n");
}

export default router;
