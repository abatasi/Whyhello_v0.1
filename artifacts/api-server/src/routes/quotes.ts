import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contactsTable,
  companiesTable,
  contactInsightsTable,
  colleagueInsightsTable,
  counterpartInsightsTable,
  companyInsightsTable,
  industryInsightsTable,
  roleInsightsTable,
  insightQuotesTable,
  dnaProfilesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

export const quotesRouter: IRouter = Router({ mergeParams: true });

function getUserId(req: Parameters<Parameters<typeof quotesRouter.get>[1]>[0]): string | null {
  const user = (req as unknown as { user?: { id?: string } }).user;
  return user?.id ?? null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Currently quotables are drawn exclusively from LinkedIn posts authored by the contact.
// When description (post body) is populated and substantial, extract quotes from the body text.
// Expand to other authored media types once LinkedIn extraction is validated.
const LINKEDIN_TYPES = new Set(["linkedin", "linkedin_post"]);

interface SignalRow {
  signalType: string;
  signalId: number;
  title: string;
  source: string;
  description: string | null;
  publishedDate: string | null;
  mediaType: string | null;
  /** True when this signal is a LinkedIn post authored by the contact */
  isLinkedIn: boolean;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { return JSON.parse(v); } catch { /* fall through */ }
  }
  return [];
}

async function buildHqSummary(userId: string | null): Promise<string> {
  if (!userId) return "No HQ profile configured.";
  try {
    const [row] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId)).limit(1);
    if (!row?.data) return "No HQ profile configured.";
    const d = JSON.parse(row.data);
    const lines: string[] = [];
    const co = d.company ?? {};
    if (co.name) lines.push(`Company: ${co.name}`);
    if (co.valueWedge) lines.push(`Value wedge: ${co.valueWedge}`);
    if (co.positioning) lines.push(`Positioning: ${co.positioning}`);
    const diffs = toStringArray(co.differentiators);
    if (diffs.length) lines.push(`Differentiators: ${diffs.join("; ")}`);
    const pillars = toStringArray(co.pillars).filter(Boolean);
    if (pillars.length) lines.push(`Pillars: ${pillars.join(" | ")}`);
    (d.products ?? []).slice(0, 2).forEach((p: Record<string, unknown>) => {
      if (p.name) lines.push(`Product: ${p.name}${p.tagline ? ` — ${p.tagline}` : ""}${p.outcomes ? `. Outcomes: ${p.outcomes}` : ""}`);
    });
    return lines.join("\n") || "No HQ profile configured.";
  } catch {
    return "No HQ profile configured.";
  }
}

// ── GET /relevance (existing scores) ──────────────────────────────────────

quotesRouter.get("/quotes", async (req, res) => {
  try {
    const contactId = parseInt((req.params as { contactId: string }).contactId, 10);
    if (!contactId) return res.status(400).json({ error: "Invalid contact ID" });

    const rows = await db
      .select()
      .from(insightQuotesTable)
      .where(eq(insightQuotesTable.contactId, contactId))
      .orderBy(insightQuotesTable.computedAt);

    const result = rows.map(r => ({
      ...r,
      matchedHqSignals: r.matchedHqSignals ? JSON.parse(r.matchedHqSignals) : [],
      computedAt: r.computedAt.toISOString(),
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /quotes/extract ────────────────────────────────────────────────────

quotesRouter.post("/quotes/extract", async (req, res) => {
  try {
    const contactId = parseInt((req.params as { contactId: string }).contactId, 10);
    if (!contactId) return res.status(400).json({ error: "Invalid contact ID" });

    const userId = getUserId(req);

    // Load contact + signals
    const [[contact], personal, colleague, counterpart] = await Promise.all([
      db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1),
      db.select().from(contactInsightsTable).where(and(
        eq(contactInsightsTable.contactId, contactId),
        eq(contactInsightsTable.category, "personal"),
      )),
      db.select().from(colleagueInsightsTable).where(eq(colleagueInsightsTable.contactId, contactId)),
      db.select().from(counterpartInsightsTable).where(eq(counterpartInsightsTable.contactId, contactId)),
    ]);

    if (!contact) return res.status(404).json({ error: "Contact not found" });

    // Also load company, industry, role signals
    const [industry, role] = await Promise.all([
      contact.industryId
        ? db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, contact.industryId))
        : Promise.resolve([]),
      contact.roleId
        ? db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contact.roleId))
        : Promise.resolve([]),
    ]);

    let companyIns: typeof companyInsightsTable.$inferSelect[] = [];
    if (contact.companyId) {
      companyIns = await db.select().from(companyInsightsTable).where(eq(companyInsightsTable.companyId, contact.companyId));
    }

    const toRow = (signalType: string, i: { id: number; title: string; source: string; description?: string | null; publishedDate?: string | null; mediaType?: string | null }): SignalRow => {
      const mt = i.mediaType ?? null;
      const isLinkedIn = !!mt && LINKEDIN_TYPES.has(mt);
      return { signalType, signalId: i.id, title: i.title, source: i.source, description: i.description ?? null, publishedDate: i.publishedDate ?? null, mediaType: mt, isLinkedIn };
    };

    // Quotables are sourced exclusively from the contact's LinkedIn posts.
    // The description field holds the post body text. Skip posts where it is absent or 'N/A'.
    const allSignals: SignalRow[] = personal.map(i => toRow("personal", i));

    const scannable = allSignals.filter(s =>
      s.isLinkedIn &&
      !!(s.description && s.description.trim().length > 40 && s.description.trim() !== "N/A")
    );

    if (scannable.length === 0) {
      return res.json([]);
    }

    const contactName = `${contact.firstName} ${contact.lastName}`.trim();
    const hqSummary = await buildHqSummary(userId);

    const signalBlocks = scannable.map((s, i) =>
      `[${i + 1}] signalId=${s.signalId}${s.publishedDate && s.publishedDate !== "N/A" ? ` published="${s.publishedDate}"` : ""}
  LinkedIn post body: ${s.description}`
    ).join("\n\n");

    const systemPrompt = `You are a B2B sales intelligence analyst. Your job is to extract attributable quotes from a contact's own LinkedIn posts and craft a one-sentence bridge connecting each to the seller's HQ messaging.

All signals below are LinkedIn posts written and published by ${contactName}. The post body is the source of quotes — do not use the post title. Extract statements from the body text that are genuine, quotable expressions of perspective, opinion, or insight. Short transitional sentences ("Here's the link", "I agree") do not qualify.

CONTACT: ${contactName}${contact.jobTitle ? `, ${contact.jobTitle}` : ""}

SELLER HQ PROFILE (use this to craft the HQ bridge):
${hqSummary}

EXTRACTION RULES:
1. The contact is the sole author of every post — attribution is always "${contactName}".
2. Extract 1–2 of the strongest quotable sentences per post. Prefer direct, opinionated statements over generic summaries.
3. Quote the contact's own words verbatim or near-verbatim. Do not paraphrase.
4. For each quote, write a "hqBridge" sentence (max 25 words) connecting what they said to one concrete aspect of the seller's HQ profile. Name specific products, pillars, or differentiators.
5. In "matchedHqSignals" list the specific HQ items referenced.
6. If a post yields no quotable statement, omit it — do not fabricate.
7. Maximum 8 quotes total. Quality over quantity.

OUTPUT: A JSON array — no markdown fences, no extra text. Empty array [] if nothing qualifies.

[
  {
    "signalType": "personal",
    "signalId": <integer from the block header>,
    "quote": "<verbatim or near-verbatim sentence from the post body>",
    "attribution": "${contactName}",
    "attributionRole": ${contact.jobTitle ? `"${contact.jobTitle}"` : "null"},
    "hqBridge": "<one sentence connecting this quote to the seller's HQ messaging>",
    "matchedHqSignals": ["<specific HQ item>", ...]
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract attributable quotes from these signals:\n\n${signalBlocks}` },
      ],
      stream: false,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let parsed: Array<{
      signalType: string; signalId: number; quote: string;
      attribution: string; attributionRole: string | null;
      hqBridge: string | null; matchedHqSignals: string[];
    }> = [];
    try { parsed = JSON.parse(raw); } catch { parsed = []; }

    if (!Array.isArray(parsed) || parsed.length === 0) return res.json([]);

    // Upsert — delete existing then insert fresh
    await db.delete(insightQuotesTable).where(eq(insightQuotesTable.contactId, contactId));

    const inserted = await db.insert(insightQuotesTable).values(
      parsed.map(q => ({
        contactId,
        signalType: q.signalType,
        signalId: q.signalId,
        quote: q.quote,
        attribution: q.attribution,
        attributionRole: q.attributionRole ?? null,
        hqBridge: q.hqBridge ?? null,
        matchedHqSignals: JSON.stringify(q.matchedHqSignals ?? []),
      }))
    ).returning();

    const result = inserted.map(r => ({
      ...r,
      matchedHqSignals: r.matchedHqSignals ? JSON.parse(r.matchedHqSignals) : [],
      computedAt: r.computedAt.toISOString(),
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default quotesRouter;
