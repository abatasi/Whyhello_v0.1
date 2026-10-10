import { strict as assert } from "node:assert";
import { test } from "node:test";
import { toVoicePickerContext, preferredHqPersonaId, resolveHqToneChoice, orderedHqVoicePersonas } from "../lib/hq-voice-profile-model";

test("voice picker context exposes saved HQ descriptions without private voice definitions", () => {
  const context = toVoicePickerContext({
    voice: { writingNotes: "private definition" },
    voicePersonas: [{ id: "voice-id-7", name: "Field Notes", voice: { trainingText: "private" }, summary: "Warm and concise, with a practical conversational tone." }],
    activeVoicePersonaId: "voice-id-7",
  });
  assert.equal(context?.voice, "available");
  assert.deepEqual(context?.voicePersonas, [{ id: "voice-id-7", name: "Field Notes", summary: "Warm and concise, with a practical conversational tone." }]);
  assert.equal(context?.activeVoicePersonaId, "voice-id-7");
  assert.equal(JSON.stringify(context).includes("private"), false);
});

test("missing HQ profile stays unavailable instead of selecting another account voice", () => {
  assert.equal(toVoicePickerContext(null), undefined);
});

const voices = { voicePersonas: [{ id: "a", name: "Advisor" }, { id: "b", name: "Builder" }], activeVoicePersonaId: "b" };
test("the default HQ persona is presented first without changing saved persona order", () => {
  assert.deepEqual(orderedHqVoicePersonas(voices.voicePersonas, voices.activeVoicePersonaId).map(voice => voice.id), ["b", "a"]);
  assert.deepEqual(voices.voicePersonas.map(voice => voice.id), ["a", "b"]);
  assert.equal(orderedHqVoicePersonas(voices.voicePersonas, null)[0].id, preferredHqPersonaId({ ...voices, activeVoicePersonaId: null }));
});
test("new tone choices prefer the active defined HQ persona, then the first defined persona", () => {
  assert.equal(preferredHqPersonaId(voices), "b");
  assert.equal(preferredHqPersonaId({ ...voices, activeVoicePersonaId: null }), "a");
  assert.equal(preferredHqPersonaId({ ...voices, activeVoicePersonaId: "deleted" }), "a");
  assert.deepEqual(resolveHqToneChoice(voices, "owner", null), { tone: "professional", voicePersonaId: "b" });
});
test("generic fallback remains available when no HQ persona is defined", () => {
  assert.deepEqual(resolveHqToneChoice(null, "owner", null), { tone: "professional", voicePersonaId: null });
  assert.equal(preferredHqPersonaId({ voicePersonas: [{ id: "", name: "Unnamed" }] }), null);
});
test("explicit generic and named choices survive HQ refetch and active-voice changes", () => {
  const generic = { scope: "owner", tone: "warm", voicePersonaId: null };
  assert.deepEqual(resolveHqToneChoice(voices, "owner", generic), { tone: "warm", voicePersonaId: null });
  const named = { scope: "owner", tone: "professional", voicePersonaId: "a" };
  assert.deepEqual(resolveHqToneChoice(voices, "owner", named), { tone: "professional", voicePersonaId: "a" });
  assert.equal(resolveHqToneChoice(null, "owner", named).voicePersonaId, "a");
});
test("another account's override never replaces the current account default", () => {
  assert.equal(resolveHqToneChoice(voices, "new-owner", { scope: "old-owner", tone: "warm", voicePersonaId: "foreign" }).voicePersonaId, "b");
});
