import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareVoicePersonaProfile, resolveActiveHqVoice, voiceSettingsSchema } from "./voice-personas.js";

const persona = (id: string, name: string, writingNotes: string) => ({
  id, name, voice: voiceSettingsSchema.parse({ writingNotes }), summary: `${name} summary`,
});
const profile = () => ({
  company: { name: "Preserved company" },
  voice: { writingNotes: "Stale legacy mirror" },
  voicePersonas: [persona("warm", "Warm advisor", "Warm and concise"), persona("direct", "Direct operator", "Direct and precise")],
  activeVoicePersonaId: "warm",
});

test("legacy profiles remain unchanged and retain their voice", () => {
  const legacy = { company: { name: "Legacy" }, voice: { writingNotes: "Existing notes", customField: "Keep" } };
  const result = prepareVoicePersonaProfile(legacy);
  assert.ok(result.ok);
  assert.equal(result.data, legacy);
  assert.deepEqual(resolveActiveHqVoice(legacy), legacy.voice);
});

test("only the explicitly active persona drives the legacy mirror and generation", () => {
  const input = profile();
  const result = prepareVoicePersonaProfile(input);
  assert.ok(result.ok);
  assert.deepEqual(result.data.voice, input.voicePersonas[0].voice);
  assert.deepEqual(result.data.company, input.company);
  assert.equal((input.voice as { writingNotes: string }).writingNotes, "Stale legacy mirror");
  assert.deepEqual(resolveActiveHqVoice({ ...input, activeVoicePersonaId: "direct" }), input.voicePersonas[1].voice);
});

test("editing an inactive persona never changes the effective active voice", () => {
  const input = profile();
  input.voicePersonas[1].voice.writingNotes = "Edited inactive definition";
  assert.deepEqual(resolveActiveHqVoice(input), input.voicePersonas[0].voice);
});

test("names are trimmed; blank and case-insensitive duplicate names fail", () => {
  const input = profile();
  input.voicePersonas[0].name = "  Warm advisor  ";
  const result = prepareVoicePersonaProfile(input);
  assert.ok(result.ok);
  assert.equal((result.data.voicePersonas as typeof input.voicePersonas)[0].name, "Warm advisor");
  assert.equal(prepareVoicePersonaProfile({ ...input, activeVoicePersonaId: "a", voicePersonas: [persona("a", " ", "")] }).ok, false);
  assert.equal(prepareVoicePersonaProfile({ ...input, activeVoicePersonaId: "a", voicePersonas: [persona("a", "Same", ""), persona("b", " same ", "")] }).ok, false);
});

test("invalid IDs, missing active persona, final deletion and malformed settings fail explicitly", () => {
  const input = profile();
  for (const invalid of [
    { ...input, activeVoicePersonaId: "missing" },
    { ...input, voicePersonas: [] },
    { ...input, voicePersonas: [persona("same", "First", ""), persona("same", "Second", "")] },
    { ...input, voicePersonas: [{ ...input.voicePersonas[0], voice: { toneTags: "not an array" } }] },
    [],
  ]) assert.equal(prepareVoicePersonaProfile(invalid).ok, false);
});

test("definition fields, independent summaries and unrelated HQ data survive a JSON round trip", () => {
  const input = profile();
  Object.assign(input.voicePersonas[0].voice, {
    toneTags: ["warm"], communicationStyle: "concise", trainingText: "Sample copy",
    suppressions: ["synergy"], suppressionNotes: "No sign-off",
  });
  const result = prepareVoicePersonaProfile(JSON.parse(JSON.stringify(input)));
  assert.ok(result.ok);
  assert.deepEqual(result.data.voicePersonas, input.voicePersonas);
  assert.deepEqual(result.data.company, input.company);
});
