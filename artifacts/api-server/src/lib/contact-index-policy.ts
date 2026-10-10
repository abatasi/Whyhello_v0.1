import { createHash } from "node:crypto";

export const CONTACT_INDEX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export function hqIndexFingerprint(profile: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]),
    );
    return value;
  };
  return createHash("sha256").update(JSON.stringify(canonical(profile ?? {}))).digest("hex");
}
export function indexIsFresh(snapshot: { hqFingerprint: string; indexedAt: Date | string } | undefined, fingerprint: string, now = Date.now()): boolean {
  if (!snapshot || snapshot.hqFingerprint !== fingerprint) return false;
  const indexedAt = new Date(snapshot.indexedAt).getTime();
  return Number.isFinite(indexedAt) && indexedAt <= now && now - indexedAt <= CONTACT_INDEX_WINDOW_MS;
}
export function scoresIndexIsFresh(scores: { hqFingerprint: string; indexedAt: Date | string } | undefined, quotes: { indexedAt: Date | string } | undefined, fingerprint: string, now = Date.now()): boolean {
  return indexIsFresh(scores, fingerprint, now)
    && (!quotes || new Date(quotes.indexedAt).getTime() <= new Date(scores!.indexedAt).getTime());
}
