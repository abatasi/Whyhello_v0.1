import { Router, type IRouter, type Request } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { dnaProfilesTable } from "@workspace/db/schema";
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
    const { url, title, source, description, mediaType } = req.body as {
      url?: string;
      title?: string;
      source?: string;
      description?: string;
      mediaType?: string;
    };

    if (!url || !title) {
      res.status(400).json({ error: "url and title are required" });
      return;
    }

    const pageText = await tryFetchPageText(url);
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

    const contextBlock = pageText
      ? `Full page content (excerpt):\n${pageText}`
      : `Available metadata:\nTitle: ${title}\nSource: ${source ?? "Unknown"}\nType: ${mediaType ?? "article"}\nDescription: ${description ?? "Not available"}\nURL: ${url}`;

    const prompt = `You are a B2B intelligence analyst embedded in a relationship intelligence platform called Whyhello. Analyze the following content for a seller preparing to engage with a contact associated with it.

SELLER'S HQ PROFILE:
${hqContext}

Produce:
1. A concise 2–3 sentence summary of what this piece covers and the most relevant implication for the seller's target market, value proposition, products, or messaging pillars.
2. Exactly 4 contextualized takeaway bullets. Each bullet must connect a concrete point from the content to a specific HQ detail above and explain how the seller should use that connection in a conversation. Prioritize named products, the value wedge, differentiators, pillars, customer focus, and buying priorities.

Do not give generic recommendations such as "follow up," "monitor this trend," or "tailor your message." If the content does not connect to an HQ detail, say that clearly and identify the closest credible angle without inventing a connection. Never invent products, claims, customer results, or market priorities.

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
