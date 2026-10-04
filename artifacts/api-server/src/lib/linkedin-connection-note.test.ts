import { strict as assert } from "node:assert";
import { test } from "node:test";
import { connectionNoteError } from "./linkedin-connection-note.js";
import { renderCallText } from "./call-template.js";

test("200 is accepted and 201 is rejected without truncation", () => {
  assert.equal(connectionNoteError("a".repeat(200)), null);
  const body = "a".repeat(201);
  assert.match(connectionNoteError(body)!, /currently 201/);
  assert.equal(body.length, 201);
});
test("spaces, punctuation and newlines count toward the complete note budget", () => {
  assert.equal(connectionNoteError("a".repeat(197) + " !\n"), null);
  assert.match(connectionNoteError("a".repeat(197) + " !\n ")!, /200 characters/);
  assert.match(connectionNoteError(" \n ")!, /Add/);
});
test("unicode counting is conservative and consistent with native browser/API limits", () => {
  assert.equal(connectionNoteError("😀".repeat(100)), null);
  assert.match(connectionNoteError("😀".repeat(101))!, /currently 202/);
});
test("the limit is applied after personalizing merge fields", () => {
  const raw = "a".repeat(185) + "{{company}}";
  assert.ok(raw.length <= 200);
  assert.match(connectionNoteError(renderCallText(raw, { company: "A very long company name" }))!, /200 characters/);
});