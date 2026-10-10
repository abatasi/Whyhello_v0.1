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
import { inspectLinkedInSource } from "../lib/linkedin-source";
import { isContactAuthoredLinkedInSignal } from "../lib/linkedin-authorship";
import { cachedContactIndex, indexingUserId, readContactIndex } from "../lib/contact-index-cache";

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
  /** Comments authored by the contact and exposed by the public LinkedIn page */
  comments: Array<{ author: string; text: string }>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isCommentByContact(
  author: string,
  contact: { firstName: string; lastName: string },
): boolean {
  return normalizedName(author) === normalizedName(`${contact.firstName} ${contact.lastName}`);
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
async function fetchLinkedInPostData(url: string): Promise<{
  postBody: string | null;
  comments: Array<{ author: string; text: string }>;
}> {
  const source = await inspectLinkedInSource(url);
  return {
    postBody: source.postBody,
    comments: source.comments,
  };
}

async function buildHqSummary(userId: string | null, snapshot?: Record<string, any>): Promise<string> {
  if (!userId) return "No HQ profile configured.";
  try {
    const [row] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId)).limit(1);
    if (!row?.data) return "No HQ profile configured.";
    const d = snapshot ?? JSON.parse(row.data);
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

function isExplicitlyAttributedToContact(
  text: string,
  start: number,
  end: number,
  contact: { firstName: string; lastName: string },
): boolean {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  if (!fullName) return false;

  const windowStart = Math.max(0, start - 240);
  const windowEnd = Math.min(text.length, end + 240);
  const context = text.slice(windowStart, windowEnd);
  const name = escapeRegExp(fullName);
  const attribution = "(?:said|says|told|wrote|writes|commented|comments|posted|shared|quoted|comment by|from)";

  return new RegExp(`${name}.{0,100}${attribution}`, "i").test(context)
    || new RegExp(`${attribution}.{0,100}${name}`, "i").test(context);
}

function isClearlyLabeledContactComment(
  text: string,
  start: number,
  end: number,
  contact: { firstName: string; lastName: string },
): boolean {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  if (!fullName) return false;

  const windowStart = Math.max(0, start - 160);
  const windowEnd = Math.min(text.length, end + 160);
  const context = text.slice(windowStart, windowEnd);
  const name = escapeRegExp(fullName);
  const commentLabel = "(?:comment|commented|reply|response|wrote|posted|shared)";

  return new RegExp(`${commentLabel}.{0,80}${name}`, "i").test(context)
    || new RegExp(`${name}.{0,80}${commentLabel}\\s*[:\\-]`, "i").test(context);
}

function isValidExtractedQuote(
  quote: string,
  signal: SignalRow | undefined,
  contact: { firstName: string; lastName: string; linkedinUrl: string | null },
): boolean {
  const trimmedQuote = quote.trim();
  if (!trimmedQuote || !signal?.postBody) return false;

  const start = signal.postBody.indexOf(trimmedQuote);
  if (signal.comments.some(comment => comment.text.includes(trimmedQuote))) return true;
  if (start < 0) return false;

  const end = start + trimmedQuote.length;
   const sourceIsContactAuthored = isContactAuthoredLinkedInSignal(signal, contact);
  const insideQuotedPassage = isInsideQuotedPassage(signal.postBody, start);

  // On the contact's own post, only the author's unquoted words qualify.
  if (sourceIsContactAuthored) return !insideQuotedPassage;

  // On an engaged-with third-party post, require explicit evidence that the
  // passage belongs to the contact (a comment block or direct quotation).
  return (insideQuotedPassage && isExplicitlyAttributedToContact(signal.postBody, start, end, contact))
    || isClearlyLabeledContactComment(signal.postBody, start, end, contact);
}

// ── GET /quotes ─────────────────────────────────────────────────────────────

quotesRouter.get("/quotes", async (req, res) => {
  try {
    const contactId = parseInt((req.params as { contactId: string }).contactId, 10);
    if (!contactId) return res.status(400).json({ error: "Invalid contact ID" });
    const userId = indexingUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const snapshot = await readContactIndex(userId, contactId, "quotes");
    if (snapshot) return res.json(snapshot.results);

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

quotesRouter.post("/quotes/extract", cachedContactIndex("quotes", async (req, res) => {
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
        const source = await fetchLinkedInPostData(s.url!);
        return {
          signalType: "personal",
          signalId: s.id,
          title: s.title,
          url: s.url ?? null,
          mediaType: s.mediaType ?? null,
          publishedDate: s.publishedDate ?? null,
          postBody: source.postBody,
          comments: source.comments.filter(comment => isCommentByContact(comment.author, contact)),
        };
      })
    );

    // Only keep signals where we successfully retrieved the post body
    const scannable = withBodies.filter(
      s => s.postBody !== null && s.postBody.trim().length > 40
    );

    if (scannable.length === 0) {
      if (withBodies.some(signal => signal.postBody === null)) {
        return res.status(503).json({ error: "Quote sources could not be loaded. The previous indexing is unchanged." });
      }
      return res.json([]);
    }

    const contactName = `${contact.firstName} ${contact.lastName}`.trim();
    const hqSummary = await buildHqSummary(userId, res.locals.contactIndexHqProfile);

    const signalBlocks = scannable.map((s, i) =>
      `[${i + 1}] signalId=${s.signalId}${s.publishedDate && s.publishedDate !== "N/A" ? ` published="${s.publishedDate}"` : ""}
  Source title: ${s.title}
  Source URL: ${s.url}
  Source classification: ${isContactAuthoredLinkedInSignal(s, contact) ? "contact-authored LinkedIn post" : s.comments.length > 0 ? "third-party LinkedIn post with a visible comment by the contact" : "third-party LinkedIn post the contact may have engaged with"}
  Post body: ${s.postBody}
  ${s.comments.length > 0 ? `Contact comments visible in source:\n${s.comments.map(comment => `  Comment by ${comment.author}: ${comment.text}`).join("\n")}` : "No contact-authored comment is visible in the fetched source."}`
    ).join("\n\n");

    const systemPrompt = `You are a B2B sales intelligence analyst extracting verbatim quotes attributable to a specific contact from LinkedIn activity.

CONTACT: ${contactName}${contact.jobTitle ? `, ${contact.jobTitle}` : ""}

Each signal below contains a post body, but not every post was authored by ${contactName}. The source classification is evidence about who authored the post:
- For a "contact-authored LinkedIn post", only use ${contactName}'s own unquoted words. Do not extract a testimonial, transcript, or quotation from another person embedded in that post.
- For a "third-party LinkedIn post with a visible comment by the contact", you may use only the exact text in the labeled "Contact comments visible in source" section, or a direct quotation explicitly attributed to ${contactName}.
- For a "third-party LinkedIn post the contact may have engaged with", do not use the third party's prose, even if it discusses the contact or contains a testimonial. Only use a passage that is explicitly identified as ${contactName}'s own comment or as a direct quotation of ${contactName}. If that evidence is not present in the fetched source, omit the signal.

The goal is attribution, not merely finding an interesting sentence. A sentence that appears verbatim in a post is not automatically a quote from ${contactName}.

SELLER HQ PROFILE (for crafting HQ bridges):
${hqSummary}

STRICT EXTRACTION RULES:
1. The "quote" field MUST be copied character-for-character from either the "Post body" or the labeled contact comment text. Do not rephrase, summarize, condense, or alter a single word. If you cannot find a complete verbatim sentence worth quoting, omit that post entirely.
2. Extract at most 1 quote per post. Prefer a coherent contiguous context window of 2–4 consecutive sentences, not an isolated sentence:
   a. Start with the strongest substantive sentence — the one with the most specific insight, observation, or named detail.
   b. Expand backward to include a meaningful lead-in when it frames or contextualises that sentence.
   c. Expand forward through the immediate implication, question, practical invitation, or call-to-action when it is part of the same thought. Do not stop after the first sentence if the next sentences make the premise usable in a composed message.
   d. A short CTA such as "We can help" or "Visit us at ..." may be included when it immediately follows the insight and remains part of the same contiguous passage. Do not include unrelated later sections, hashtags-only lines, or boilerplate sign-offs.
   e. Use one sentence only when surrounding sentences are genuinely unrelated or filler. Never skip sentences to join non-adjacent ones, and never exceed four consecutive sentences or 320 characters.
3. Short filler phrases ("Here's the link", "Full video:", "Check this out") are not quotes — skip them.
4. Never attribute a third party's words to ${contactName}. This includes company posts, testimonials, podcast transcripts, quoted interviews, and posts the contact only liked or engaged with.
5. In a third-party post, a quote is eligible only when the text explicitly names ${contactName} as the speaker/author, or a clearly labeled comment block identifies ${contactName}'s comment.
6. Attribution is "${contactName}" only when the source classification and surrounding text support that attribution.
7. For each quote, write a "hqBridge" sentence (max 25 words) connecting what they said to one specific aspect of the seller's HQ profile. Name specific products, pillars, or differentiators.
8. List referenced HQ items in "matchedHqSignals".
9. Maximum 8 quotes total. Omit rather than fabricate.

⚠️ VERBATIM CHECK: Before including a quote, confirm every word appears in that exact sequence in the Post body. If it does not, do not include it.

OUTPUT: A JSON array only — no markdown fences, no preamble. Empty array [] if nothing qualifies.

[
  {
    "signalType": "personal",
    "signalId": <integer from the block header>,
    "quote": "<exact verbatim contiguous excerpt of 2–4 sentences copied from Post body>",
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

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return res.status(502).json({ error: "Quote indexing returned no result. The previous indexing is unchanged." });
    let parsed: Array<{
      signalType: string; signalId: number; quote: string;
      attribution: string; attributionRole: string | null;
      hqBridge: string | null; matchedHqSignals: string[];
    }> = [];
    try { parsed = JSON.parse(raw); } catch {
      return res.status(502).json({ error: "Quote indexing returned an invalid result. The previous indexing is unchanged." });
    }
    if (!Array.isArray(parsed)) return res.status(502).json({ error: "Quote indexing returned an invalid result. The previous indexing is unchanged." });

    const signalById = new Map(scannable.map(signal => [signal.signalId, signal]));
    const validParsed = Array.isArray(parsed)
      ? parsed.filter(q => {
          if (!q || q.signalType !== "personal" || !Number.isInteger(q.signalId)) return false;
          return isValidExtractedQuote(q.quote ?? "", signalById.get(q.signalId), contact);
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
}));

export default quotesRouter;
