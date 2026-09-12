import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  contactsTable,
  contactInsightsTable,
  insightQuotesTable,
  dnaProfilesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getAuth } from "@clerk/express";

export const quotesRouter: IRouter = Router({ mergeParams: true });

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const LINKEDIN_TYPES = new Set(["linkedin", "linkedin_post"]);

interface SignalRow {
  signalType: string;
  signalId: number;
  title: string;
  url: string | null;
  mediaType: string | null;
  publishedDate: string | null;
  /** Post body text fetched live from the LinkedIn URL */
  postBody: string | null;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { return JSON.parse(v); } catch { /* fall through */ }
  }
  return [];
}

/**
 * Fetch a LinkedIn post's body text from its public page.
 * LinkedIn exposes the full post text in the og:description meta tag and in
 * the JSON-LD articleBody field — both accessible without authentication.
 * Returns null if the fetch fails or no content is found.
 */
async function fetchLinkedInPostBody(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 1. Try JSON-LD articleBody (most complete — not truncated)
    const ldMatch = html.match(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (ldMatch?.[1]) {
      return ldMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    }

    // 2. Fallback: og:description meta tag
    const ogMatch =
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
    if (ogMatch?.[1]) {
      return ogMatch[1].replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
    }

    return null;
  } catch {
    return null;
  }
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

/**
 * A LinkedIn post can contain a testimonial, transcript, or statement from
 * another person. Those words may be present in the post body verbatim, but
 * they are not the contact's own perspective and must not be attributed to
 * the contact.
 */
function isInsideQuotedPassage(text: string, start: number): boolean {
  const before = text.slice(0, start);
  const curlyOpens = (before.match(/[“„]/g) ?? []).length;
  const curlyCloses = (before.match(/”/g) ?? []).length;
  if (curlyOpens > curlyCloses) return true;

  // Handle straight-quote passages as well. Apostrophes are excluded.
  const straightQuotes = (before.match(/"/g) ?? []).length;
  return straightQuotes % 2 === 1;
}

function isValidExtractedQuote(quote: string, signal: SignalRow | undefined): boolean {
  const trimmedQuote = quote.trim();
  if (!trimmedQuote || !signal?.postBody) return false;

  const start = signal.postBody.indexOf(trimmedQuote);
  if (start < 0) return false;

  return !isInsideQuotedPassage(signal.postBody, start);
}

// ── GET /quotes ─────────────────────────────────────────────────────────────

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

    const [[contact], personalSignals] = await Promise.all([
      db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1),
      db.select().from(contactInsightsTable).where(and(
        eq(contactInsightsTable.contactId, contactId),
        eq(contactInsightsTable.category, "personal"),
      )),
    ]);

    if (!contact) return res.status(404).json({ error: "Contact not found" });

    // Filter to LinkedIn posts that have a URL to fetch from
    const linkedInSignals = personalSignals.filter(s => {
      const mt = s.mediaType ?? "";
      return LINKEDIN_TYPES.has(mt) && s.url && s.url.trim().length > 0 && s.url.trim() !== "N/A";
    });

    if (linkedInSignals.length === 0) {
      return res.json([]);
    }

    // Fetch post bodies from LinkedIn public pages in parallel
    const withBodies: SignalRow[] = await Promise.all(
      linkedInSignals.map(async s => {
        const postBody = await fetchLinkedInPostBody(s.url!);
        return {
          signalType: "personal",
          signalId: s.id,
          title: s.title,
          url: s.url ?? null,
          mediaType: s.mediaType ?? null,
          publishedDate: s.publishedDate ?? null,
          postBody,
        };
      })
    );

    // Only keep signals where we successfully retrieved the post body
    const scannable = withBodies.filter(
      s => s.postBody !== null && s.postBody.trim().length > 40
    );

    if (scannable.length === 0) {
      return res.json([]);
    }

    const contactName = `${contact.firstName} ${contact.lastName}`.trim();
    const hqSummary = await buildHqSummary(userId);

    const signalBlocks = scannable.map((s, i) =>
      `[${i + 1}] signalId=${s.signalId}${s.publishedDate && s.publishedDate !== "N/A" ? ` published="${s.publishedDate}"` : ""}
  Post body: ${s.postBody}`
    ).join("\n\n");

    const systemPrompt = `You are a B2B sales intelligence analyst extracting verbatim quotes from a contact's LinkedIn posts.

CONTACT: ${contactName}${contact.jobTitle ? `, ${contact.jobTitle}` : ""}

Each signal below contains a "Post body" — the exact text ${contactName} published on LinkedIn. Your task is to find sentences in that body that are quotable: substantive statements of perspective, market observation, or insight that could be used in a sales conversation.

SELLER HQ PROFILE (for crafting HQ bridges):
${hqSummary}

STRICT EXTRACTION RULES:
1. The "quote" field MUST be copied character-for-character from the "Post body" text. Do not rephrase, summarize, condense, or alter a single word. If you cannot find a complete verbatim sentence worth quoting, omit that post entirely.
2. Extract at most 1 quote per post. That quote may be one sentence or two consecutive sentences, following this decision rule:
   a. Identify the single most substantive sentence — the one with the most specific insight, observation, or named detail.
   b. Look at the sentence immediately before it. If that preceding sentence is a strong thematic lead-in that frames or contextualises the substantive sentence (e.g. a broad claim that the next sentence then unpacks with specifics), include both consecutive sentences as the quote, joined exactly as they appear in the post body.
   c. If the preceding sentence is a filler, a call-to-action, a generic opener with no thematic content ("Here's my latest post", "Excited to share"), or unrelated to the substantive sentence, include the substantive sentence only.
   d. Never include more than two sentences. Never skip sentences to join non-adjacent ones.
3. Short filler phrases ("Here's the link", "Full video:", "Check this out") are not quotes — skip them.
4. If the post body is entirely a description of someone else speaking (e.g. "John Smith joins MoneyTalk to discuss X"), the framing sentence written by ${contactName} — even if it describes the topic — is still a valid quote from ${contactName} as long as it expresses a market view or insight.
5. Attribution is always "${contactName}" — they authored every post.
6. For each quote, write a "hqBridge" sentence (max 25 words) connecting what they said to one specific aspect of the seller's HQ profile. Name specific products, pillars, or differentiators.
7. List referenced HQ items in "matchedHqSignals".
8. Maximum 8 quotes total. Omit rather than fabricate.

⚠️ VERBATIM CHECK: Before including a quote, confirm every word appears in that exact sequence in the Post body. If it does not, do not include it.

OUTPUT: A JSON array only — no markdown fences, no preamble. Empty array [] if nothing qualifies.

[
  {
    "signalType": "personal",
    "signalId": <integer from the block header>,
    "quote": "<exact verbatim sentence copied from Post body>",
    "attribution": "${contactName}",
    "attributionRole": ${contact.jobTitle ? `"${contact.jobTitle}"` : "null"},
    "hqBridge": "<one sentence connecting this to the seller's HQ messaging>",
    "matchedHqSignals": ["<specific HQ item>", ...]
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract attributable quotes from these LinkedIn posts:\n\n${signalBlocks}` },
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

    const signalById = new Map(scannable.map(signal => [signal.signalId, signal]));
    const validParsed = Array.isArray(parsed)
      ? parsed.filter(q => {
          if (!q || q.signalType !== "personal" || !Number.isInteger(q.signalId)) return false;
          return isValidExtractedQuote(q.quote ?? "", signalById.get(q.signalId));
        })
      : [];

    // Upsert — delete existing then insert fresh
    await db.delete(insightQuotesTable).where(eq(insightQuotesTable.contactId, contactId));

    if (validParsed.length === 0) return res.json([]);

    const inserted = await db.insert(insightQuotesTable).values(
      validParsed.map(q => ({
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
