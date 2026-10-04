import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertFilledEmail, resolveEvidenceIds } from "./manual-email-evidence.js";

const sources = [
  { id: "Company / Strategic Company Research:120", title: "Company observation", url: "https://example.com/company" },
  { id: "Personal / Executive Persona Research:800", title: "Personal observation", url: "https://example.com/person" },
];
test("shortened numeric citation retains actual evidence details and canonical identity", () => {
  assert.deepEqual(resolveEvidenceIds(sources, ["120"]), [sources[0]]);
});
test("exact citations resolve and duplicate references do not duplicate evidence", () => {
  assert.deepEqual(resolveEvidenceIds(sources, [sources[0].id, "120"]), [sources[0]]);
});
test("unknown or ambiguous citations fail instead of hiding evidence", () => {
  assert.throws(() => resolveEvidenceIds(sources, ["999"]));
  assert.throws(() => resolveEvidenceIds([...sources, { ...sources[1], id: "Role:120" }], ["120"]));
});
test("a preview that uses no research may legitimately have no citations", () => {
  assert.deepEqual(resolveEvidenceIds(sources, []), []);
});
test("AI output cannot silently include a sender or contact placeholder", () => {
  assert.throws(() => assertFilledEmail("Hello", "Thanks,\n[Sender Name]"));
  assert.throws(() => assertFilledEmail("Hello {{firstName}}", "Real body"));
  assert.doesNotThrow(() => assertFilledEmail("A useful observation", "Hello, would this be useful to explore?"));
});