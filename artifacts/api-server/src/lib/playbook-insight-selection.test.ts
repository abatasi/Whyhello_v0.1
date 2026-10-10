import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTopPlaybookInsight } from "./playbook-insight-selection.js";

const row = (id: number) => ({ id, title: `Insight ${id}`, description: "Verified research", url: `https://example.com/${id}` });

test("selects the highest score even outside the old recent-insight limit", () => {
  const rows = Array.from({ length: 50 }, (_, i) => row(i + 1));
  const scores = new Map([["company:1", 98], ["company:50", 40]]);
  assert.equal(selectTopPlaybookInsight(rows, "company", scores)?.id, 1);
  assert.equal(rows.length, 50);
  assert.equal(rows[0].id, 1);
});

test("signal-type identity prevents overlapping IDs from borrowing scores", () => {
  const scores = new Map([["personal:1", 100], ["role:2", 60]]);
  assert.equal(selectTopPlaybookInsight([row(1), row(2)], "role", scores)?.id, 2);
});

test("scored zero outranks unscored evidence; unscored fallback uses newest ID", () => {
  assert.equal(selectTopPlaybookInsight([row(1), row(2)], "personal", new Map([["personal:1", 0]]))?.id, 1);
  assert.equal(selectTopPlaybookInsight([row(1), row(2)], "personal", new Map())?.id, 2);
});

test("score ties resolve deterministically to the newest insight", () => {
  assert.equal(selectTopPlaybookInsight([row(2), row(1)], "industry", new Map([["industry:1", 70], ["industry:2", 70]]))?.id, 2);
});

test("unusable leaders are skipped; empty categories do not borrow other evidence", () => {
  const scores = new Map([["colleague:1", 99], ["colleague:2", 80]]);
  assert.equal(selectTopPlaybookInsight([{ ...row(1), url: "" }, row(2)], "colleague", scores)?.id, 2);
  assert.equal(selectTopPlaybookInsight([{ ...row(1), title: " ", description: null }], "colleague", scores), undefined);
  assert.equal(selectTopPlaybookInsight([], "counterpart", scores), undefined);
});
