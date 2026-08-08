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

/**
 * Convert any URL found in HTML to an absolute URL.
 * - Already absolute → unchanged
 * - Protocol-relative //domain/path → https://domain/path
 * - Root-relative /path → origin + /path
 * - Relative path → basePath + path
 * - data:, javascript:, #, mailto: → unchanged
 */
function absify(url: string, origin: string, basePath: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("blob:")
  ) return url;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return url;
  if (trimmed.startsWith("//")) return "https:" + trimmed;
  if (trimmed.startsWith("/")) return origin + trimmed;
  return basePath + trimmed;
}

function rewriteUrls(html: string, origin: string, basePath: string): string {
  const abs = (u: string) => absify(u, origin, basePath);

  // Rewrite href, src, action, poster, data-src on HTML tags
  html = html.replace(
    /(\b(?:href|src|action|poster|data-src|data-lazy-src|data-original)\s*=\s*)(["'])([^"'#][^"']*?|)\2/gi,
    (_, attr, q, url) => attr + q + abs(url) + q
  );

  // srcset="url 2x, url2 3x"
  html = html.replace(
    /(\bsrcset\s*=\s*)(["'])([^"']*)\2/gi,
    (_, attr, q, srcset) => {
      const rewritten = srcset.split(",").map((part: string) => {
        const trimmed = part.trim();
        const space = trimmed.search(/\s/);
        if (space === -1) return abs(trimmed);
        return abs(trimmed.slice(0, space)) + trimmed.slice(space);
      }).join(", ");
      return attr + q + rewritten + q;
    }
  );

  // Inline style url('/path') and url(/path)
  html = html.replace(
    /\burl\(\s*(["']?)([^)"'\s]+)\1\s*\)/gi,
    (_, q, url) => `url(${q}${abs(url)}${q})`
  );

  return html;
}

/**
 * Injected into every proxied page. Runs synchronously before paint:
 * 1. Hides the document until DOMContentLoaded so partially-parsed HTML
 *    (e.g. long body-tag attribute strings) never flashes as visible text.
 * 2. Applies CSS zoom so wide desktop layouts scale to fit the iframe width.
 * 3. Patches window.location so JS URL construction uses the real origin.
 */
function buildInjection(targetUrl: string, origin: string): string {
  return `<style data-proxy-inject="1">html{opacity:0!important}</style><script data-proxy-inject="1">
(function(){
  /* ── 1. Reveal page only after DOM is parsed and initial styles applied ── */
  function reveal() { document.documentElement.style.opacity = ''; }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal);
  } else {
    reveal();
  }
  /* Safety net: always reveal after 3 s even if DOMContentLoaded never fires */
  setTimeout(reveal, 3000);

  /* ── 2. Zoom desktop layouts to fit the iframe width ── */
  var TARGET_W = 1280;
  var zoomStyle = document.createElement('style');
  zoomStyle.id = '_proxy_zoom';
  document.currentScript.parentNode.insertBefore(zoomStyle, document.currentScript.nextSibling);
  function applyZoom() {
    var w = document.documentElement.clientWidth || window.innerWidth;
    if (w > 0 && w < TARGET_W) {
      zoomStyle.textContent = 'html { zoom: ' + (w / TARGET_W).toFixed(5) + ' !important; }';
    } else {
      zoomStyle.textContent = '';
    }
  }
  applyZoom();
  window.addEventListener('resize', applyZoom);

  /* ── 3. Patch location so JS URL construction resolves against the real origin ── */
  try {
    var _realOrigin = ${JSON.stringify(origin)};
    var _realHref   = ${JSON.stringify(targetUrl)};
    var _realUrl    = new URL(_realHref);
    Object.defineProperty(window, '_proxyOrigin', { value: _realOrigin, writable: false });

    /* Override fetch so root-relative /path requests hit the real origin */
    var _nativeFetch = window.fetch;
    window.fetch = function(input, init) {
      if (typeof input === 'string' && input.startsWith('/') && !input.startsWith('//')) {
        input = _realOrigin + input;
      }
      return _nativeFetch.call(this, input, init);
    };

    /* Override XMLHttpRequest.open for the same reason */
    var _nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
        url = _realOrigin + url;
      }
      return _nativeOpen.apply(this, arguments);
    };
  } catch(e) { /* non-critical, ignore */ }
})();
</script>`;
}

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
        Referer: parsed.origin + "/",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = upstream.headers.get("content-type") ?? "text/html";

    // Forward non-HTML resources (css, js, images, fonts) untouched but strip blocking headers
    if (!contentType.includes("text/html")) {
      upstream.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (BLOCKED_HEADERS.has(k)) return;
        if (k === "transfer-encoding") return;
        try { res.setHeader(key, value); } catch { /* skip */ }
      });
      res.status(upstream.status);
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));
      return;
    }

    let html = await upstream.text();

    const origin   = `${parsed.protocol}//${parsed.host}`;
    const basePath = parsed.href.substring(0, parsed.href.lastIndexOf("/") + 1);

    // 1. Rewrite all static resource URLs to absolute
    html = rewriteUrls(html, origin, basePath);

    // 2. Remove existing <base> tags to avoid conflicts
    html = html.replace(/<base[^>]*>/gi, "");

    // 3. Insert our own <base> tag + zoom + fetch-patch injection right after <head>
    const injection =
      `<base href="${basePath}" target="_self">` +
      buildInjection(targetUrl, origin);

    if (/<head[\s>]/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1${injection}`);
    } else {
      html = injection + html;
    }

    // 4. Strip meta refresh
    html = html.replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, "");

    // Forward upstream headers, stripping the blocking ones
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (BLOCKED_HEADERS.has(k)) return;
      if (k === "transfer-encoding") return;
      try { res.setHeader(key, value); } catch { /* skip */ }
    });

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("x-frame-options", "SAMEORIGIN");
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
