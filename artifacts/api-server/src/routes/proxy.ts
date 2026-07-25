import { Router, type IRouter } from "express";

const router: IRouter = Router();

const BLOCKED_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
]);

router.get("/", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.query["url"]) ? req.query["url"][0] : req.query["url"];
  const targetUrl = typeof raw === "string" ? raw : "";

  if (!targetUrl) {
    res.status(400).json({ error: "url query param is required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad protocol");
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = upstream.headers.get("content-type") ?? "text/html";

    // Forward non-HTML resources (images, css, fonts, js) untouched
    if (!contentType.includes("text/html")) {
      res.status(upstream.status);
      res.setHeader("content-type", contentType);
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));
      return;
    }

    let html = await upstream.text();

    // Inject a <base> tag so relative URLs resolve against the original origin
    const base = `${parsed.protocol}//${parsed.host}`;
    const basePath = parsed.href.substring(0, parsed.href.lastIndexOf("/") + 1);
    const baseTag = `<base href="${basePath}" target="_self">`;

    if (/<head[\s>]/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}`);
    } else {
      html = baseTag + html;
    }

    // Remove or rewrite meta/http-equiv refresh that could break nav
    html = html.replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, "");

    // Forward response, stripping the blocking headers
    upstream.headers.forEach((value, key) => {
      if (BLOCKED_HEADERS.has(key.toLowerCase())) return;
      if (key.toLowerCase() === "transfer-encoding") return;
      try { res.setHeader(key, value); } catch { /* skip bad header names */ }
    });

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("x-frame-options", "SAMEORIGIN"); // allow our own iframe
    res.status(upstream.status).send(html);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("timeout")) {
      res.status(504).json({ error: "Request timed out" });
    } else {
      res.status(502).json({ error: "Could not fetch page" });
    }
  }
});

export default router;
