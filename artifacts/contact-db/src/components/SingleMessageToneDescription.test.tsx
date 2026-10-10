import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getSingleMessageToneDescription, SINGLE_MESSAGE_TONE_DESCRIPTIONS, SingleMessageToneDescription } from "./SingleMessageToneDescription";

const profile = {
  activeVoicePersonaId: "a",
  voicePersonas: [
    { id: "a", name: "Advisor", summary: "The active voice description." },
    { id: "b", name: "Builder", summary: "The saved Builder description, manually edited in HQ." },
  ],
};
test("all five generic tones have concise sound and characteristic descriptions", () => {
  for (const tone of ["Professional", "Friendly", "Direct", "Warm", "Authoritative"]) {
    const result = getSingleMessageToneDescription(tone, null, profile);
    assert.equal(result.description, SINGLE_MESSAGE_TONE_DESCRIPTIONS[tone.toLowerCase()]);
    assert.ok(result.description.length > 40 && result.description.length < 160);
    assert.equal(result.label, tone);
  }
});
test("selected HQ persona reuses its own saved description, not the active persona or a generic tone", () => {
  const before = JSON.stringify(profile);
  const result = getSingleMessageToneDescription("professional", "b", profile);
  assert.equal(result.label, "Builder · HQ");
  assert.equal(result.description, profile.voicePersonas[1].summary);
  assert.equal(JSON.stringify(profile), before);
});
test("missing and undescribed personas are explicit rather than borrowing another description", () => {
  assert.match(getSingleMessageToneDescription("professional", "missing", profile).description, /no longer available/);
  const empty = { voicePersonas: [{ id: "empty", name: "New voice", summary: " " }] };
  assert.match(getSingleMessageToneDescription("professional", "empty", empty).description, /No Voice Profile description/);
});
test("rendered description is readable, scrollable for long HQ summaries, and safely escaped", () => {
  const html = renderToStaticMarkup(createElement(SingleMessageToneDescription, {
    tone: "professional", voicePersonaId: "b",
    profile: { voicePersonas: [{ id: "b", name: "Builder", summary: "<script>unsafe()</script>\nSaved description" }] },
  }));
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /overflow-y-auto/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
