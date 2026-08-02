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

// Media types where the contact themselves is the author
const AUTHORED_MEDIA_TYPES = new Set(["linkedin", "linkedin_post", "blog_post", "blog", "newsletter", "podcast"]);

interface SignalRow {
  signalType: string;
  signalId: number;
  title: string;
  source: string;
  description: string | null;
  publishedDate: string | null;
  mediaType: string | null;
  /** True when the contact is the author of this content (linkedin posts, blog posts, etc.) */
  isAuthored: boolean;
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

    const toRow = (signalType: string, i: { id: number; title: string; source: string; description?: string | null; publishedDate?: string | null; mediaType?: string | null }, authoredWhenPersonal = false): SignalRow => {
      const mt = i.mediaType ?? null;
      const isAuthored = authoredWhenPersonal && !!mt && AUTHORED_MEDIA_TYPES.has(mt);
      return { signalType, signalId: i.id, title: i.title, source: i.source, description: i.description ?? null, publishedDate: i.publishedDate ?? null, mediaType: mt, isAuthored };
    };

    const signals: SignalRow[] = [
      ...personal.map(i => toRow("personal", i, /* authoredWhenPersonal= */ true)),
      ...colleague.map(i => toRow("colleague", i)),
      ...counterpart.map(i => toRow("counterpart", i)),
      ...companyIns.map(i => toRow("company", i)),
      ...industry.map(i => toRow("industry", i)),
      ...role.map(i => toRow("role", i)),
    ];

    // Authored content (linkedin posts, blog posts, etc.) is scannable via title alone.
    // Third-party coverage requires a description of at least 40 chars.
    const scannable = signals.filter(s => {
      if (s.isAuthored) return s.title.trim().length > 15;
      return !!(s.description && s.description.trim().length > 40 && s.description.trim() !== "N/A");
    });
    if (scannable.length === 0) {
      return res.json([]);
    }

    const contactName = `${contact.firstName} ${contact.lastName}`.trim();
    const hqSummary = await buildHqSummary(userId);

    const signalBlocks = scannable.map((s, i) => {
      const header = s.isAuthored
        ? `[${i + 1}] signalType="${s.signalType}" signalId=${s.signalId} mediaType="${s.mediaType}" — AUTHORED BY CONTACT`
        : `[${i + 1}] signalType="${s.signalType}" signalId=${s.signalId} source="${s.source}"`;
      const body = s.isAuthored
        ? `  Authored statement (contact's own published words): ${s.title}${s.publishedDate && s.publishedDate !== "N/A" ? `\n  Published: ${s.publishedDate}` : ""}`
        : `  Title: ${s.title}\n  Content: ${s.description}`;
      return `${header}\n${body}`;
    }).join("\n\n");

    const systemPrompt = `You are a B2B sales intelligence analyst. Your job is to extract attributable quotes from signal content and craft a one-sentence bridge connecting each to the seller's HQ messaging.

There are two kinds of signals you will see:

A) AUTHORED BY CONTACT — marked "AUTHORED BY CONTACT" in the header. The contact themselves wrote or published this content. The "Authored statement" line IS what they said. Quote it verbatim. Attribution is always ${contactName}.

B) THIRD-PARTY COVERAGE — articles, posts, or analysis written by someone else. Extract only directly attributed speech (someone explicitly quoted by name). Do not paraphrase or invent quotes.

CONTACT BEING RESEARCHED: ${contactName}${contact.jobTitle ? `, ${contact.jobTitle}` : ""}

SELLER HQ PROFILE (inside-out context — use this to craft the HQ bridge):
${hqSummary}

EXTRACTION RULES:
1. For AUTHORED BY CONTACT signals: use the authored statement as the quote. Attribution = ${contactName}. These are highest priority.
2. For THIRD-PARTY COVERAGE: only extract if someone is explicitly quoted by name. Reject paraphrases, summaries, and generic headlines.
3. For each quote, write a short "hqBridge" sentence (max 25 words) connecting what they said to one concrete aspect of the seller's HQ profile. Name specific products, pillars, or differentiators — not generic categories.
4. In "matchedHqSignals" list the specific HQ items referenced.
5. If a signal yields no valid quote, omit it — do not fabricate.
6. Maximum 8 quotes. Quality over quantity.

OUTPUT: A JSON array — no markdown fences, no extra text. Empty array [] if nothing qualifies.

[
  {
    "signalType": "personal" | "colleague" | "counterpart" | "company" | "industry" | "role",
    "signalId": <integer from the block header>,
    "quote": "<the verbatim or near-verbatim quote>",
    "attribution": "<full name of the person quoted>",
    "attributionRole": "<their job title or role, if known — else null>",
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
