import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHONE_CALL_LANGUAGE_LIBRARY, phoneCallLanguageGuidance } from "./phone-call-language.js";

test("spoken library retains pronouns and covers all generated spoken sections", () => {
  const guidance = phoneCallLanguageGuidance();
  assert.match(guidance, /grammatical subjects and natural personal pronouns/);
  assert.match(guidance, /never clip them/);
  assert.match(guidance, /take precedence over any written-outreach shorthand/);
  for (const field of ["opener", "talkingPoints", "questions", "objection responses", "voicemail", "closing"]) {
    assert.ok(guidance.includes(field), `Missing guidance for ${field}`);
  }
});

test("library includes the reported clipped opener and a complete spoken alternative", () => {
  const example = PHONE_CALL_LANGUAGE_LIBRARY.examples[0];
  assert.equal(example.avoid, "Hi Abdo -- noticed RBC was recently recognized...");
  assert.match(example.prefer, /^Hi Abdo\. I noticed RBC/);
  assert.match(example.prefer, /Do you have a moment/);
  assert.match(phoneCallLanguageGuidance(), /do not copy names, companies, events, or unsupported facts/);
});

test("voice guidance preserves factual boundaries and conditional follow-up examples", () => {
  const guidance = phoneCallLanguageGuidance();
  assert.match(guidance, /never imply that the seller and recipient share a company/);
  assert.match(guidance, /must not imply a prior conversation unless/);
  assert.match(guidance, /callback number only when supplied/);
  assert.match(guidance, /Condition: Use only when the supplied context confirms information was sent/);
});

test("generation includes the separate library as system guidance without changing templates", () => {
  const route = readFileSync(new URL("../routes/playbook-phone-call.ts", import.meta.url), "utf8");
  assert.match(route, /role: "system", content: phoneCallLanguageGuidance\(\)/);
  assert.ok(route.indexOf('if (v.mode === "template")') < route.indexOf("content: phoneCallLanguageGuidance()"));
});