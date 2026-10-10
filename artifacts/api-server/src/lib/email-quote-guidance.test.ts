import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EMAIL_QUOTE_GUIDANCE } from "./email-quote-guidance.js";
import { EMAIL_INSIGHT_CATEGORIES, manualEmailGuidance } from "./manual-email-guidance.js";

test("every Playbook category introduces quotations before using bold double-quoted excerpts", () => {
  for (const category of EMAIL_INSIGHT_CATEGORIES) {
    const prompt = manualEmailGuidance(category, "long", "inline");
    assert.ok(prompt.includes(EMAIL_QUOTE_GUIDANCE));
    assert.match(prompt, /Before the quote, clearly say the sender came across/);
    assert.ok(prompt.includes('**"exact supplied words"**'));
    assert.match(prompt, /short, coherent, contiguous verbatim excerpt/);
    assert.match(prompt, /Never append detached citation labels/);
  }
});

test("contextual first-person and specific appreciation prefaces are allowed without overriding safeguards", () => {
  const prompt = manualEmailGuidance("personal", "medium", "inline");
  assert.match(prompt, /I recently came across your LinkedIn post/);
  assert.match(prompt, /Loved this from your/);
  assert.match(prompt, /specific quote-discovery preface may start with "I"/);
  assert.doesNotMatch(prompt, /Never open with "I" as the first word/);
  assert.match(prompt, /Never open with "I hope this email finds you well"/);
  assert.match(prompt, /Never invent proof or add filler/);
});

test("quote discovery cannot invent authorship, platform, publication recency or a private relationship", () => {
  assert.match(EMAIL_QUOTE_GUIDANCE, /only when recipient authorship is established/);
  assert.match(EMAIL_QUOTE_GUIDANCE, /identify the actual author in the preface/);
  assert.match(EMAIL_QUOTE_GUIDANCE, /source person and their verified relationship before quoting/);
  assert.match(EMAIL_QUOTE_GUIDANCE, /does not establish when the post was published/);
  assert.match(EMAIL_QUOTE_GUIDANCE, /not facts to copy/);
});

test("Single Message shares the same policy and exposes quote metadata as labeled data, not citation prose", () => {
  const route = readFileSync(new URL("../routes/outreach-jobs.ts", import.meta.url), "utf8");
  assert.ok(route.includes("${EMAIL_QUOTE_GUIDANCE}"));
  assert.ok(route.includes("Exact quote: ${JSON.stringify(q.quote)}"));
  assert.ok(route.includes("Named author: ${q.attribution}"));
  assert.ok(route.includes('where you said: **"[verbatim excerpt]"**'));
  assert.doesNotMatch(route, /Never open the body with "I" as the first word/);
  assert.doesNotMatch(route, /return `\[\$\{i \+ 1\}\] "\$\{q.quote\}"/);
  assert.doesNotMatch(route, /caught my eye: '\[quote\]'/);
});
