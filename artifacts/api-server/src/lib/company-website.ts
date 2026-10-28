import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";

export class CompanyWebsiteError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedV4.addSubnet(address, prefix);
const publicV6 = new BlockList();
publicV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blockedV6.addSubnet(address, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) return !blockedV4.check(address, "ipv4");
  return isIP(address) === 6 && publicV6.check(address, "ipv6") && !blockedV6.check(address, "ipv6");
}

export function normalizeCompanyUrl(input: string): URL {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`); }
  catch { throw new CompanyWebsiteError("Enter a valid company website URL.", 400); }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
      !host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      (isIP(host) && !isPublicAddress(host))) {
    throw new CompanyWebsiteError("Use a public company website with no credentials or custom port.", 400);
  }
  url.hash = "";
  return url;
}

export async function fetchCompanyPage(input: string, signal: AbortSignal, redirects = 0): Promise<{ url: string; html: string }> {
  const url = normalizeCompanyUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // Resolve once, validate every result, and pin the connection to that lookup.
  // Validating DNS then using ordinary fetch would permit DNS rebinding.
  const addresses = await lookup(host, { all: true });
  if (signal.aborted) throw new CompanyWebsiteError("The website took too long to respond.");
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
    throw new CompanyWebsiteError("The website must resolve only to public internet addresses.", 400);
  }
  const address = addresses.find(a => a.family === 4) ?? addresses[0];
  const response = await new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      family: address.family,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: { "User-Agent": "Whyhello-Company-Profile/1.0", Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
    }, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, location: res.headers.location, html: "" });
        return;
      }
      if (status !== 200 || !/text\/html|application\/xhtml\+xml/i.test(res.headers["content-type"] ?? "")) {
        res.resume();
        reject(new CompanyWebsiteError("The website did not return a readable public HTML page. Try its main website URL."));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 1_000_000) {
          request.destroy(new CompanyWebsiteError("The website page is too large to read safely."));
        } else chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
  });
  if (response.status >= 300 && response.status < 400) {
    if (!response.location || redirects >= 3) throw new CompanyWebsiteError("The website redirected too many times.");
    return fetchCompanyPage(new URL(response.location, url).href, signal, redirects + 1);
  }
  return { url: url.href, html: response.html };
}

export function htmlToCompanyText(html: string): string {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return html.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|nav|footer|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_match, code: string) => {
      if (!code.startsWith("#")) return entities[code.toLowerCase()] ?? " ";
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    }).replace(/\s+/g, " ").trim();
}

export async function readCompanyWebsite(input: string, callerSignal?: AbortSignal): Promise<{ content: string; sourceUrls: string[] }> {
  const signal = callerSignal ? AbortSignal.any([callerSignal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000);
  let main: Awaited<ReturnType<typeof fetchCompanyPage>>;
  try { main = await fetchCompanyPage(input, signal); }
  catch (error) {
    if (error instanceof CompanyWebsiteError) throw error;
    throw new CompanyWebsiteError("We could not read that website. Check the URL or try a publicly accessible company homepage.");
  }
  const root = new URL(main.url);
  const links = new Set<string>();
  for (const match of main.html.matchAll(/href\s*=\s*["']([^"'<>]+)["']/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), root);
      if (url.origin === root.origin && /\/(about(?:-us)?|company|products?|solutions?)(\/|$)/i.test(url.pathname)) {
        url.hash = ""; url.search = "";
        if (url.href !== root.href) links.add(url.href);
      }
    } catch { /* A malformed page link is not company evidence. */ }
  }
  const pages = [main];
  const extra = await Promise.allSettled([...links].slice(0, 2).map(url => fetchCompanyPage(url, signal)));
  for (const result of extra) {
    if (result.status === "fulfilled" && new URL(result.value.url).origin === root.origin) pages.push(result.value);
  }
  const usable = pages.map(page => ({ url: page.url, text: htmlToCompanyText(page.html).slice(0, 14_000) }))
    .filter(page => page.text.length >= 150);
  if (!usable.length) throw new CompanyWebsiteError("This website did not expose enough readable company information. Try an About or product page. Your fields have not been changed.");
  return { content: usable.map(page => `SOURCE: ${page.url}\n${page.text}`).join("\n\n"), sourceUrls: usable.map(page => page.url) };
}
