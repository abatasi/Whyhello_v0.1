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
} from "@workspace/db/schema";
import { eq, and, inArray, ne, gt, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getAuth } from "@clerk/express";

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
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

    // 4. Build flat signal list for the prompt
    type SignalRow = {
      signalType: string;
      signalId: number;
      title: string;
      description: string | null;
      quotable: QuotableInfo | undefined;
    };
    const signals: SignalRow[] = [
      ...personal.map((s) => ({ signalType: "personal", signalId: s.id, title: s.title, description: s.description, quotable: quoteMap.get(`personal-${s.id}`) })),
      ...company.map((s) => ({ signalType: "company", signalId: s.id, title: s.title, description: s.description, quotable: quoteMap.get(`company-${s.id}`) })),
      ...industry.map((s) => ({ signalType: "industry", signalId: s.id, title: s.title, description: s.description, quotable: quoteMap.get(`industry-${s.id}`) })),
      ...role.map((s) => ({ signalType: "role", signalId: s.id, title: s.title, description: s.description, quotable: quoteMap.get(`role-${s.id}`) })),
      ...colleague.map((s) => ({ signalType: "colleague", signalId: s.id, title: s.title, description: s.description, quotable: quoteMap.get(`colleague-${s.id}`) })),
      ...counterpart.map((s) => ({ signalType: "counterpart", signalId: s.id, title: s.title, description: s.description, quotable: quoteMap.get(`counterpart-${s.id}`) })),
    ];

    // Set of signal keys that have an extracted quotable — used for post-processing boost
    const quotableKeys = new Set(signals.filter((s) => s.quotable).map((s) => `${s.signalType}-${s.signalId}`));

    if (signals.length === 0) {
      res.json([]);
      return;
    }

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
        let block = `[${i + 1}] type="${s.signalType}" id=${s.signalId}\n  Title: ${s.title}\n  Description: ${s.description ?? "(none)"}`;
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
- 80-100: Direct, strong connection — signal explicitly surfaces a problem, goal, or context the seller directly addresses
- 60-79: Clear connection — signal meaningfully relates to the seller's value proposition, product, or ideal customer profile
- 40-59: Moderate connection — some overlap, but indirect or partial
- 20-39: Weak connection — only tangential overlap
- 0-19: No meaningful connection to the seller's offering

IMPORTANT — FOR ⭐ QUOTABLE SIGNALS: The verbatim quote text is the primary signal content. Use it (not just the title) when assessing HQ alignment. The HQ Bridge note, if present, describes the connection between the quote and the seller profile — use it to validate or sharpen your assessment. Score based purely on HQ alignment; a separate bonus is applied by the system after your scores are returned.

For each signal:
- Write a 1–2 sentence description explaining WHAT in the HQ profile this signal connects to and WHY that linkage matters for outreach relevance. For ⭐ QUOTABLE signals, reference what the quote itself says.
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
    const QUOTABLE_BOOST_OTHER = 20;  // third-party quote
    const QUOTABLE_HQ_FLOOR = 20;

    const contactFullName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.toLowerCase().trim();
    const isSelfAttributed = (q: QuotableInfo): boolean =>
      q.attribution.toLowerCase().includes(contactFullName) ||
      (contactFullName.length > 0 && contactFullName.split(" ").every((part) => q.attribution.toLowerCase().includes(part)));

    const scored: ScoredSignal[] = rawScored.map((s) => {
      const hqScore = Math.max(0, Math.min(100, s.score));
      const key = `${s.signalType}-${s.signalId}`;
      const sig = signals.find((x) => `${x.signalType}-${x.signalId}` === key);
      const quotable = sig?.quotable;
      if (!quotable || hqScore < QUOTABLE_HQ_FLOOR) return { ...s, score: hqScore };
      const boost = isSelfAttributed(quotable) ? QUOTABLE_BOOST_SELF : QUOTABLE_BOOST_OTHER;
      return { ...s, score: Math.min(100, hqScore + boost) };
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

    // 9. Return the scored list
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
