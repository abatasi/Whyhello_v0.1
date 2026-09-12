import { Router, type IRouter, type Request } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { contactsTable, dnaProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

function buildHqContext(profileData: unknown): string {
  if (!profileData || typeof profileData !== "object") return "No HQ profile is configured.";

  const profile = profileData as {
    company?: {
      name?: string;
      valueWedge?: string;
      positioning?: string;
      differentiators?: string;
      pillars?: unknown;
    };
    products?: Array<{
      name?: string;
      tagline?: string;
      outcomes?: string;
      persona?: string;
    }>;
    marketPosition?: {
      customerFocus?: string;
      primaryAdvantage?: string;
      typicalBuyingPriority?: string;
    };
    targetMarkets?: Array<{
      industries?: string[];
      companySizes?: string[];
      locations?: string[];
    }>;
  };
  const company = profile.company ?? {};
  const lines: string[] = [];
  const asText = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join(", ").trim();
    return "";
  };
  const add = (label: string, value: unknown) => {
    const text = asText(value);
    if (text) lines.push(`${label}: ${text}`);
  };

  add("Company", company.name);
  add("Core value wedge", company.valueWedge);
  add("Positioning", company.positioning);
  add("Differentiators", company.differentiators);

  const pillars = Array.isArray(company.pillars)
    ? company.pillars.map((pillar) => {
        if (typeof pillar === "string") return pillar.trim();
        if (pillar && typeof pillar === "object") {
          const value = pillar as { name?: unknown; description?: unknown };
          return [asText(value.name), asText(value.description)].filter(Boolean).join(": ");
        }
        return "";
      }).filter(Boolean)
    : [];
  if (pillars.length) lines.push(`Messaging pillars: ${pillars.join(" | ")}`);

  for (const product of (profile.products ?? []).slice(0, 3)) {
    const details = [asText(product.tagline), asText(product.outcomes), asText(product.persona)].filter(Boolean).join(" — ");
    if (product.name || details) lines.push(`Product${product.name ? `: ${product.name}` : ""}${details ? ` — ${details}` : ""}`);
  }

  add("Customer focus", profile.marketPosition?.customerFocus);
  add("Primary advantage", profile.marketPosition?.primaryAdvantage);
  add("Typical buying priority", profile.marketPosition?.typicalBuyingPriority);

  const markets = (profile.targetMarkets ?? []).slice(0, 3).map((market) =>
    [
      ...(market.industries ?? []),
      ...(market.companySizes ?? []),
      ...(market.locations ?? []),
    ].filter(Boolean).join(", ")
  ).filter(Boolean);
  if (markets.length) lines.push(`Target markets: ${markets.join(" | ")}`);

  return lines.join("\n") || "No HQ profile is configured.";
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
  title: string,
  url: string,
  contact: { firstName: string; lastName: string; linkedinUrl: string | null },
): boolean {
  const contactSlug = linkedinProfileSlug(contact.linkedinUrl)
    ?? `${contact.firstName}-${contact.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const authorSlug = linkedinAuthorSlug(url);
  if (authorSlug && (authorSlug === contactSlug || authorSlug.startsWith(`${contactSlug}-`))) return true;

  const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  return normalizedTitle === fullName
    || normalizedTitle.startsWith(`${fullName}'s post`)
    || normalizedTitle.startsWith(`${fullName} -`);
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function tryFetchContactComments(
  url: string,
  contact: { firstName: string; lastName: string },
): Promise<string[]> {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Whyhello-Bot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const fullName = normalizedName(`${contact.firstName} ${contact.lastName}`);
    const comments: string[] = [];

    for (const match of html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis,
    )) {
      try {
        const data = JSON.parse(match[1]);
        const records = Array.isArray(data) ? data : [data];
        for (const record of records) {
          if (!record || typeof record !== "object" || !Array.isArray(record.comment)) continue;
          for (const comment of record.comment) {
            if (!comment || typeof comment !== "object") continue;
            const author = typeof comment.author === "string"
              ? comment.author
              : typeof comment.author?.name === "string" ? comment.author.name : "";
            if (normalizedName(author) !== fullName || typeof comment.text !== "string") continue;
            comments.push(comment.text.trim());
          }
        }
      } catch {
        // Ignore malformed JSON-LD blocks and continue with other blocks.
      }
    }

    return [...new Set(comments)].slice(0, 3);
  } catch {
    return [];
  }
}

async function tryDetectLinkedInReshare(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Whyhello-Bot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) return false;
    return /feed-reshare-content__commentary/i.test(await resp.text());
  } catch {
    return false;
  }
}

async function tryFetchPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Whyhello-Bot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const html = await resp.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}

router.post("/", async (req, res) => {
  try {
    const { url, title, source, description, mediaType, contactId } = req.body as {
      url?: string;
      title?: string;
      source?: string;
      description?: string;
      mediaType?: string;
      contactId?: number;
    };

    if (!url || !title) {
      res.status(400).json({ error: "url and title are required" });
      return;
    }

    const pageText = await tryFetchPageText(url);
    const contact = contactId
      ? (await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1))[0]
      : undefined;
    const isLinkedInSource = mediaType === "linkedin" || mediaType === "linkedin_post";
    const isContactAuthored = !!contact && isContactAuthoredLinkedInSignal(title, url, contact);
    const isLinkedInReshare = isLinkedInSource && isContactAuthored
      ? await tryDetectLinkedInReshare(url)
      : false;
    const isLinkedInEngagement = !!contact
      && isLinkedInSource
      && (!isContactAuthored || isLinkedInReshare);
    const contactComments = isLinkedInEngagement
      ? await tryFetchContactComments(url, contact!)
      : [];
    const userId = getUserId(req);
    let hqContext = "No HQ profile is configured.";
    if (userId) {
      const [dnaRow] = await db
        .select()
        .from(dnaProfilesTable)
        .where(eq(dnaProfilesTable.userId, userId))
        .limit(1);
      if (dnaRow?.data) {
        try {
          hqContext = buildHqContext(JSON.parse(dnaRow.data));
        } catch {
          hqContext = "No HQ profile is configured.";
        }
      }
    }

    const engagementBlock = isLinkedInEngagement
      ? `\nSIGNAL PROXIMITY:\n${isLinkedInReshare
        ? `This is a LinkedIn reshare/share by ${contact?.firstName} ${contact?.lastName} containing third-party content. The contact's commentary may show interest, but the underlying content is not their stated position.`
        : `This is a third-party LinkedIn post, not a post authored by ${contact?.firstName} ${contact?.lastName}. The contact may have engaged with it.`}\n${contactComments.length > 0
        ? `The contact's own comments visible in the source are:\n${contactComments.map((comment) => `- ${comment}`).join("\n")}`
        : "No contact-authored comment was visible in the fetched source."}\nTreat the post author's content as background only. Assess the contact's own comment, if present, for substantive business meaning. A short social response such as congratulations, well done, happy anniversary, or welcome is not an actionable contact insight.`
      : "";

    const contextBlock = pageText
      ? `Full page content (excerpt):\n${pageText}${engagementBlock}`
      : `Available metadata:\nTitle: ${title}\nSource: ${source ?? "Unknown"}\nType: ${mediaType ?? "article"}\nDescription: ${description ?? "Not available"}\nURL: ${url}${engagementBlock}`;

    const prompt = `You are a B2B intelligence analyst embedded in a relationship intelligence platform called Whyhello. Analyze the following content for a seller preparing to engage with a contact associated with it.

SELLER'S HQ PROFILE:
${hqContext}

Produce:
1. A concise 2–3 sentence summary of what this piece covers and the most relevant implication for the seller's target market, value proposition, products, or messaging pillars.
2. Exactly 4 contextualized takeaway bullets. Each bullet must connect a concrete point from the content to a specific HQ detail above and explain how the seller should use that connection in a conversation. Prioritize named products, the value wedge, differentiators, pillars, customer focus, and buying priorities.

Do not give generic recommendations such as "follow up," "monitor this trend," or "tailor your message." If this is a third-party engagement with a short social comment, explicitly say that it is weak or non-actionable contact evidence and do not present the post as the contact's own viewpoint. If the content does not connect to an HQ detail, say that clearly and identify the closest credible angle without inventing a connection. Never invent products, claims, customer results, or market priorities.

${contextBlock}

Respond in this exact JSON format (no markdown, no preamble):
{
  "summary": "2-3 sentence summary here",
  "keyInsights": [
    "HQ-contextualized takeaway 1",
    "HQ-contextualized takeaway 2",
    "HQ-contextualized takeaway 3",
    "HQ-contextualized takeaway 4"
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: { summary: string; keyInsights: string[] };
    try {
      result = JSON.parse(raw);
      if (!result.summary) result.summary = "Summary unavailable.";
      if (!Array.isArray(result.keyInsights)) result.keyInsights = [];
    } catch {
      result = { summary: "Could not generate summary.", keyInsights: [] };
    }

    res.json(result);
  } catch (err) {
    console.error("Insight summarize error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
