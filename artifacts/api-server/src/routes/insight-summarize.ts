import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

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

    const contextBlock = pageText
      ? `Full page content (excerpt):\n${pageText}`
      : `Available metadata:\nTitle: ${title}\nSource: ${source ?? "Unknown"}\nType: ${mediaType ?? "article"}\nDescription: ${description ?? "Not available"}\nURL: ${url}`;

    const prompt = `You are a B2B intelligence analyst embedded in a relationship intelligence platform called Whyhello. Analyze the following content and produce:

1. A concise 2–3 sentence summary of what this piece covers and why it is relevant for a sales or business development professional engaging with a contact from this company or industry.
2. Exactly 4 insight bullets — each one a concrete, actionable takeaway that a salesperson could use when preparing for a conversation with a contact associated with this content.

${contextBlock}

Respond in this exact JSON format (no markdown, no preamble):
{
  "summary": "2-3 sentence summary here",
  "keyInsights": [
    "Insight 1",
    "Insight 2",
    "Insight 3",
    "Insight 4"
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
