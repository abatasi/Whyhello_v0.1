import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface MetaResult {
  ogImage: string | null;
  favicon: string | null;
}

// Simple in-process cache — keyed by URL, TTL 6 hours
const cache = new Map<string, { result: MetaResult; expiresAt: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;

async function fetchMeta(targetUrl: string): Promise<MetaResult> {
  const cached = cache.get(targetUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { ogImage: null, favicon: null };
  }

  // Favicon via Google's reliable service
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;

  let ogImage: string | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Whyhello-Meta/1.0; +https://whyhello.com)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();

      // og:image
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch?.[1]) {
        // Make absolute
        try {
          ogImage = new URL(ogMatch[1], targetUrl).href;
        } catch {
          ogImage = ogMatch[1];
        }
      }

      // Fallback: twitter:image
      if (!ogImage) {
        const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
          ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
        if (twMatch?.[1]) {
          try { ogImage = new URL(twMatch[1], targetUrl).href; } catch { ogImage = twMatch[1]; }
        }
      }
    }
  } catch {
    // Network / timeout — return what we have
  }

  const result: MetaResult = { ogImage, favicon };
  cache.set(targetUrl, { result, expiresAt: Date.now() + TTL_MS });
  return result;
}

router.get("/", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.query["url"]) ? req.query["url"][0] : req.query["url"];
  const url = typeof raw === "string" ? raw.trim() : "";

  if (!url) {
    res.status(400).json({ error: "url param required" });
    return;
  }

  try {
    const meta = await fetchMeta(url);
    res.setHeader("Cache-Control", "public, max-age=21600"); // 6 h browser cache
    res.json(meta);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
