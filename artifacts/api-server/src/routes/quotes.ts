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
  /** Comments authored by the contact and exposed by the public LinkedIn page */
  comments: Array<{ author: string; text: string }>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function linkedinAuthorSlug(url: string | null): string | null {
  const match = url?.match(/linkedin\.com\/posts\/([^_/?#]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function linkedinProfileSlug(url: string | null): string | null {
  const match = url?.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase().replace(/\/$/, "") ?? null;
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

function isContactAuthoredSignal(
  signal: SignalRow,
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
  const empty = { postBody: null, comments: [] };
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
    if (!res.ok) return empty;
    const html = await res.text();

    // LinkedIn's JSON-LD includes the full post body and, when available,
    // public comments with their authors.
    const jsonLdBlocks = [...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis,
    )];
    for (const match of jsonLdBlocks) {
      try {
        const data = JSON.parse(match[1]);
        const records = Array.isArray(data) ? data : [data];
        const posting = records.find(
          (record): record is { articleBody?: unknown; comment?: unknown } =>
            record && typeof record === "object" && "articleBody" in record,
        );
        if (posting) {
          const comments = Array.isArray(posting.comment)
            ? posting.comment.flatMap((comment: unknown) => {
                if (!comment || typeof comment !== "object") return [];
                const value = comment as {
                  text?: unknown;
                  author?: { name?: unknown } | string;
                };
                const author = typeof value.author === "string"
                  ? value.author
                  : typeof value.author?.name === "string" ? value.author.name : "";
                return typeof value.text === "string" && author
                  ? [{ author, text: value.text.trim() }]
                  : [];
              })
            : [];
          return {
            postBody: typeof posting.articleBody === "string" ? posting.articleBody.trim() : null,
            comments,
          };
        }
      } catch {
        // Fall through to the metadata parser for malformed JSON-LD.
      }
    }

    // 1. Try the JSON-LD articleBody with a tolerant fallback regex.
    const ldMatch = html.match(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (ldMatch?.[1]) {
      return {
        postBody: ldMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim(),
        comments: [],
      };
    }

    // 2. Fallback: og:description meta tag
    const ogMatch =
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
    if (ogMatch?.[1]) {
      return {
        postBody: ogMatch[1].replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim(),
        comments: [],
      };
    }

    return empty;
  } catch {
    return empty;
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
  const sourceIsContactAuthored = isContactAuthoredSignal(signal, contact);
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
      return res.json([]);
    }

    const contactName = `${contact.firstName} ${contact.lastName}`.trim();
    const hqSummary = await buildHqSummary(userId);

    const signalBlocks = scannable.map((s, i) =>
      `[${i + 1}] signalId=${s.signalId}${s.publishedDate && s.publishedDate !== "N/A" ? ` published="${s.publishedDate}"` : ""}
  Source title: ${s.title}
  Source URL: ${s.url}
  Source classification: ${isContactAuthoredSignal(s, contact) ? "contact-authored LinkedIn post" : s.comments.length > 0 ? "third-party LinkedIn post with a visible comment by the contact" : "third-party LinkedIn post the contact may have engaged with"}
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
2. Extract at most 1 quote per post. That quote may be one sentence or two consecutive sentences, following this decision rule:
   a. Identify the single most substantive sentence — the one with the most specific insight, observation, or named detail.
   b. Look at the sentence immediately before it. If that preceding sentence is a strong thematic lead-in that frames or contextualises the substantive sentence (e.g. a broad claim that the next sentence then unpacks with specifics), include both consecutive sentences as the quote, joined exactly as they appear in the post body.
   c. If the preceding sentence is a filler, a call-to-action, a generic opener with no thematic content ("Here's my latest post", "Excited to share"), or unrelated to the substantive sentence, include the substantive sentence only.
   d. Never include more than two sentences. Never skip sentences to join non-adjacent ones.
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
});

export default quotesRouter;
