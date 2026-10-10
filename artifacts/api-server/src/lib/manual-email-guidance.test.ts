import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_INSIGHT_CATEGORIES, emailAnatomySchema, emailBodyFromAnatomy, manualEmailGuidance, resolveEmailShape } from "./manual-email-guidance.js";
import { readFileSync } from "node:fs";
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

test("every email length is advisory and prioritizes all five layers over quotas", () => {
  for (const length of ["short", "medium", "long"] as const) {
    const instruction = manualEmailGuidance("company", length, "inline");
    assert.match(instruction, /Anatomy and supported facts take priority/);
    assert.match(instruction, /not minimums or hard caps/);
    assert.match(instruction, /Never invent proof or add filler/);
    assert.match(instruction, /Never omit a layer/);
  }
});

test("complete anatomy accepts bodies below or above old ranges but not missing layers", () => {
  const minimal = { hook: "A supported hook.", bridge: "A buyer implication.", value: "A supplied outcome.", proof: "Grounded qualitative proof.", cta: "Compare notes?" };
  assert.ok(countEmailBodyCharacters(emailBodyFromAnatomy(emailAnatomySchema.parse(minimal))) < 350);
  const extended = { ...minimal, value: "A supplied outcome with grounded context. ".repeat(40) };
  assert.ok(countEmailBodyCharacters(emailBodyFromAnatomy(emailAnatomySchema.parse(extended))) > 1300);
  for (const layer of ["hook", "bridge", "value", "proof", "cta"]) {
    assert.equal(emailAnatomySchema.safeParse({ ...minimal, [layer]: "" }).success, false);
  }
});

test("email generation routes contain no character-count gates or length-only rewrites", () => {
  for (const name of ["playbook-manual-email", "outreach-jobs"]) {
    const route = readFileSync(new URL(`../routes/${name}.ts`, import.meta.url), "utf8");
    assert.doesNotMatch(route, /countEmailBodyCharacters|emailLengthRevision|lengthValid|lengthSpec|Email length verification failed/);
    if (name === "playbook-manual-email") {
      assert.match(route, /anatomy: emailAnatomySchema/);
      assert.match(route, /assertFilledEmail\(generated.subject, body\)/);
      assert.match(route, /resolveEvidenceIds\(evidence, generated.insightIdsUsed\)/);
    } else {
      assert.match(route, /subject.trim\(\) && body.trim\(\)/);
    }
  }
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