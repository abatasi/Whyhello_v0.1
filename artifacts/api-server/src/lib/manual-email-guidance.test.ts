import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_INSIGHT_CATEGORIES, emailAnatomySchema, emailBodyFromAnatomy, emailLengthRevision, manualEmailGuidance, resolveEmailShape } from "./manual-email-guidance.js";
import { countEmailBodyCharacters } from "./email-length.js";

test("explicit length and category override legacy research controls", () => {
  assert.deepEqual(resolveEmailShape({ length: "long", insightCategory: "role", generationMode: "Concise", researchSources: ["personal"] }), { length: "long", insightCategory: "role" });
});

test("legacy drafts resolve deterministically without mutation", () => {
  const variant = { generationMode: "Detailed", researchSources: ["job-postings", "executive"] };
  assert.deepEqual(resolveEmailShape(variant), { length: "long", insightCategory: "company" });
  assert.deepEqual(variant, { generationMode: "Detailed", researchSources: ["job-postings", "executive"] });
  assert.equal(resolveEmailShape({ generationMode: "Concise", researchSources: [] }).length, "short");
});

test("each canonical category gets its own evidence posture and fixed category focus", () => {
  for (const category of EMAIL_INSIGHT_CATEGORIES) {
    const prompt = manualEmailGuidance(category, "medium", "inline");
    assert.ok(prompt.includes(`selected ${category} insight category`));
    assert.match(prompt, /Never switch category/);
    for (const layer of ["HOOK:", "BRIDGE:", "VALUE:", "PROOF:", "CTA:"]) assert.ok(prompt.includes(layer));
  }
  assert.match(manualEmailGuidance("colleagues", "short", "inline"), /colleague within/);
  assert.match(manualEmailGuidance("counterparts", "short", "inline"), /similar role at another company/);
});

test("single-message body lengths replace old independent word budgets", () => {
  for (const [length, range] of [["short", "350–550"], ["medium", "600–900"], ["long", "950–1300"]] as const) {
    assert.ok(manualEmailGuidance("personal", length, "inline").includes(range));
  }
});

test("anatomy forms exact ordered body paragraphs, with optional source P.S.", () => {
  const anatomy = emailAnatomySchema.parse({ hook: "A.", bridge: "B.", value: "C.", proof: "D.", cta: "E?" });
  assert.equal(emailBodyFromAnatomy(anatomy), "A.\n\nB.\n\nC.\n\nD.\n\nE?");
  assert.equal(emailBodyFromAnatomy(anatomy, "P.S. Source."), "A.\n\nB.\n\nC.\n\nD.\n\nE?\n\nP.S. Source.");
  assert.equal(emailAnatomySchema.safeParse({ ...anatomy, bridge: "" }).success, false);
});

test("visible length excludes Markdown syntax and hidden URL characters", () => {
  assert.equal(countEmailBodyCharacters("**Value**\n\nA [useful finding](https://example.com/a-very-long-url)."), "Value A useful finding.".length);
});

test("length revisions supply measured per-layer budgets including space for source P.S.", () => {
  const anatomy = { hook: "H".repeat(100), bridge: "B".repeat(100), value: "V".repeat(150), proof: "P".repeat(120), cta: "C".repeat(110) };
  const instruction = emailLengthRevision("short", anatomy, "P.S. ".repeat(10));
  assert.match(instruction, /cta: currently 110 visible characters; aim for/);
  assert.match(instruction, /Remove redundant explanations/);
  assert.match(instruction, /350–550/);
  assert.match(instruction, /chosen insight category and required source link/);
});

test("link placement is explicit and avoids invented quotes, proof or callbacks", () => {
  const prompt = manualEmailGuidance("company", "medium", "postscript");
  assert.match(prompt, /put it only in postscript/);
  assert.match(prompt, /No greeting-only paragraph, signature/);
  assert.match(prompt, /never quote an insight title or paraphrase/);
  assert.match(prompt, /Never send email or enroll anyone/);
  assert.match(prompt, /unless supplied context proves it/);
  assert.match(prompt, /Every capability and promised outcome/);
  assert.match(prompt, /does NOT establish automated follow-ups/);
  assert.match(prompt, /Only offer a document, mapping/);
});