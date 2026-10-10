import assert from "node:assert/strict";
import test from "node:test";
import { CONTACT_INDEX_WINDOW_MS, hqIndexFingerprint, indexIsFresh, scoresIndexIsFresh } from "./contact-index-policy";

const now = Date.parse("2026-10-10T12:00:00Z");
const fingerprint = hqIndexFingerprint({ company: { name: "Index QA" }, products: [] });
const snapshot = (age: number) => ({ hqFingerprint: fingerprint, indexedAt: new Date(now - age) });
test("indexing lasts seven days, including the exact boundary, not ten minutes", () => {
  assert.equal(indexIsFresh(snapshot(11 * 60_000), fingerprint, now), true);
  assert.equal(indexIsFresh(snapshot(CONTACT_INDEX_WINDOW_MS), fingerprint, now), true);
  assert.equal(indexIsFresh(snapshot(CONTACT_INDEX_WINDOW_MS + 1), fingerprint, now), false);
});
test("HQ changes invalidate indexing immediately, while key order alone does not", () => {
  assert.equal(hqIndexFingerprint({ b: { z: 2, a: 1 }, a: [] }), hqIndexFingerprint({ a: [], b: { a: 1, z: 2 } }));
  assert.equal(indexIsFresh(snapshot(0), hqIndexFingerprint({ company: { name: "Changed HQ" } }), now), false);
});
test("missing, invalid or future completion dates are not fresh", () => {
  assert.equal(indexIsFresh(undefined, fingerprint, now), false);
  assert.equal(indexIsFresh({ hqFingerprint: fingerprint, indexedAt: "invalid" }, fingerprint, now), false);
  assert.equal(indexIsFresh(snapshot(-1), fingerprint, now), false);
});
test("successful empty snapshots remain fresh and newly extracted quotes invalidate older scoring", () => {
  const emptySnapshot = { ...snapshot(0), results: [] };
  assert.equal(indexIsFresh(emptySnapshot, fingerprint, now), true);
  assert.equal(scoresIndexIsFresh(snapshot(200), snapshot(100), fingerprint, now), false);
  assert.equal(scoresIndexIsFresh(snapshot(100), snapshot(200), fingerprint, now), true);
});
