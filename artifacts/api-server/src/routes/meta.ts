import { Router, type IRouter } from "express";

const router: IRouter = Router();

export interface MetaResult {
  ogImage: string | null;
  favicon: string | null;
  /** Publisher name extracted from og:site_name, meta[name=publisher], or hostname */
  source: string | null;
  /** ISO-like date string from article:published_time or similar meta tags */
  publishedDate: string | null;
}

// Simple in-process cache — keyed by URL, TTL 6 hours
const cache = new Map<string, { result: MetaResult; expiresAt: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;

/** Extract a meta tag's content regardless of attribute order. */
function metaContent(html: string, ...selectors: string[]): string | null {
  for (const sel of selectors) {
    // Match both attribute orderings: property/name then content, or content then property/name
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${sel}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${sel}["']`,
      "i",
    );
    const m = html.match(re1) ?? html.match(re2);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Derive a human-readable publisher name from a hostname.
 * e.g. "www.techcrunch.com" → "TechCrunch" is not possible without a lookup,
 * so we just title-case the apex domain without TLD as a best-effort.
 */
function hostnameToSource(hostname: string): string {
  const apex = hostname.replace(/^www\./, "").split(".")[0];
  return apex.charAt(0).toUpperCase() + apex.slice(1);
}

/**
 * Normalise a published-date string to "Mon YYYY" display format.
 * Accepts ISO datetimes (2024-03-15T10:00:00Z), ISO dates (2024-03-15),
 * and loose strings ("March 2024", "Mar 2024", "2024").
 * Returns the raw string unchanged when it cannot be parsed.
 */
function normaliseDate(raw: string): string {
  // Try ISO date/datetime
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return raw;
}

async function fetchMeta(targetUrl: string): Promise<MetaResult> {
  const cached = cache.get(targetUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { ogImage: null, favicon: null, source: null, publishedDate: null };
  }

  // Favicon via Google's reliable service
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;

  let ogImage: string | null = null;
  let source: string | null = null;
  let publishedDate: string | null = null;

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

      // ── og:image ─────────────────────────────────────────────────────────
      const ogMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch?.[1]) {
        try { ogImage = new URL(ogMatch[1], targetUrl).href; } catch { ogImage = ogMatch[1]; }
      }
      // Fallback: twitter:image
      if (!ogImage) {
        const twMatch =
          html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
        if (twMatch?.[1]) {
          try { ogImage = new URL(twMatch[1], targetUrl).href; } catch { ogImage = twMatch[1]; }
        }
      }

      // ── Publisher / source ────────────────────────────────────────────────
      // Priority: og:site_name > publisher meta > twitter:site > hostname apex
      const siteName = metaContent(html, "og:site_name", "publisher", "twitter:site");
      if (siteName) {
        // Strip @ prefix common in twitter:site
        source = siteName.startsWith("@") ? siteName.slice(1) : siteName;
      } else {
        source = hostnameToSource(parsed.hostname);
      }

      // ── Published date ────────────────────────────────────────────────────
      // Priority: article:published_time > datePublished > pubdate > date > DC.date
      const rawDate = metaContent(
        html,
        "article:published_time",
        "datePublished",
        "pubdate",
        "date",
        "DC.date",
        "DC.Date",
        "article:modified_time", // fallback
      );
      if (rawDate) {
        publishedDate = normaliseDate(rawDate);
      } else {
        // Try <time datetime="..."> as last resort
        const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
        if (timeMatch?.[1]) publishedDate = normaliseDate(timeMatch[1]);
      }
    }
  } catch {
    // Network / timeout — use hostname-derived source as best-effort
    if (!source) source = hostnameToSource(parsed.hostname);
  }

  const result: MetaResult = { ogImage, favicon, source, publishedDate };
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
