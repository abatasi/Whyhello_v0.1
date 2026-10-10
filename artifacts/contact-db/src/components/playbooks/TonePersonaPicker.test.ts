import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TonePersonaPicker } from "./TonePersonaPicker";
import { createManualEmailConfiguration } from "./manual-email-model";
import { toVoicePickerContext } from "../../lib/hq-voice-profile-model";
import { OUTPUT_TONE_DESCRIPTIONS } from "../../lib/output-tone-descriptions";

const profile = { voicePersonas: [{ id: "a", name: "Advisor" }, { id: "b", name: "Builder" }], activeVoicePersonaId: "b" };
function render(tone: string, voicePersonaId: string | null, context = toVoicePickerContext(profile)) {
  return renderToStaticMarkup(createElement(TonePersonaPicker, {
    tones: ["Professional", "Friendly", "Direct", "Warm", "Authoritative", "Default", "Formal", "Casual", "Creative", "Custom"], tone, voicePersonaId, inheritHqTone: false,
    context, disabled: false, showHqVoice: false, showGenericDescription: true, onTone: () => {}, onPersona: () => {},
  }));
}
test("new Playbook emails select the active HQ voice and show it before all generic options", () => {
  const [variant] = createManualEmailConfiguration(profile).variants;
  assert.equal(variant.voicePersonaId, "b");
  const html = render(variant.tone, variant.voicePersonaId ?? null);
  const firstButton = html.match(/<button\b[^>]*>/)?.[0] ?? "";
  assert.match(firstButton, /button-voice-persona-b/);
  assert.match(firstButton, /aria-pressed="true"/);
  assert.ok(html.indexOf("button-voice-persona-a") < html.indexOf(">Professional</button>"));
});
test("explicit generic choices remain selected even with HQ options first", () => {
  const html = render("Friendly", null);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>Friendly<\/button>/);
  assert.doesNotMatch(html.match(/<button\b[^>]*>/)?.[0] ?? "", /aria-pressed="true"/);
});
test("without defined voices a generic tone is still the first selected option", () => {
  const html = render("Professional", null, toVoicePickerContext({ voicePersonas: [] }));
  assert.doesNotMatch(html, /button-voice-persona-/);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>Professional<\/button>/);
});

test("the selected HQ voice repeats its exact saved description, not the active voice's description", () => {
  const context = toVoicePickerContext({ ...profile, voicePersonas: [
    { id: "a", name: "Advisor", summary: "Warm and concise.\nAsk practical questions." },
    { id: "b", name: "Builder", summary: "Direct and energetic." },
  ] });
  const description = render("Professional", "a", context).split('data-testid="selected-hq-voice-description"')[1] ?? "";
  assert.ok(description.includes("Warm and concise.\nAsk practical questions."));
  assert.ok(!description.includes("Direct and energetic."));
  assert.ok(!render("Friendly", null, context).includes('data-testid="selected-hq-voice-description"'));
});

test("missing or deleted summaries do not borrow another persona's description", () => {
  assert.match(render("Professional", "a"), /No short description is saved for this voice/);
  assert.ok(!render("Professional", "deleted").includes('data-testid="selected-hq-voice-description"'));
});

test("Playbook presets show short descriptions matching Single Message and the selected tone", () => {
  for (const [tone, description] of Object.entries(OUTPUT_TONE_DESCRIPTIONS)) {
    const html = render(tone, null);
    const reminder = html.split('data-testid="selected-generic-tone-description"')[1] ?? "";
    assert.ok(reminder.includes(description), `${tone} is missing its visible description`);
    assert.ok(!html.includes('data-testid="button-hq-voice"'));
  }
});

test("named HQ voices keep their saved descriptions without a generic-tone reminder", () => {
  const context = toVoicePickerContext({ ...profile, voicePersonas: [
    { id: "a", name: "Advisor", summary: "A practical, warm conversation." },
    { id: "b", name: "Builder", summary: "Crisp and energetic." },
  ] });
  const html = render("Professional", "a", context);
  assert.ok(html.includes('data-testid="button-voice-persona-a"'));
  assert.ok(html.includes("A practical, warm conversation."));
  assert.ok(!html.includes('data-testid="button-hq-voice"'));
  assert.ok(!html.includes('data-testid="selected-generic-tone-description"'));
});

test("old inherited configurations remain explicit but cannot choose the removed HQ shortcut", () => {
  const html = renderToStaticMarkup(createElement(TonePersonaPicker, {
    tones: ["Professional"], tone: "Professional", inheritHqTone: true,
    context: toVoicePickerContext({ voice: { writingNotes: "Saved legacy voice" }, voicePersonas: [] }),
    disabled: false, showHqVoice: false, showGenericDescription: true,
    onTone: () => {}, onPersona: () => {},
  }));
  assert.ok(!html.includes('data-testid="button-hq-voice"'));
  assert.ok(html.includes("This saved configuration uses a legacy HQ voice."));
  assert.ok(!html.includes('data-testid="selected-generic-tone-description"'));
});
