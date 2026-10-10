import assert from "node:assert/strict";
import test from "node:test";
import { resolveOutputVoice, voicePersonaOptions, VoicePersonaSelectionError } from "./voice-personas.js";

const voice = (marker: string) => ({
  toneTags: [marker], communicationStyle: "concise", writingNotes: `${marker} notes`,
  trainingText: `${marker} sample`, suppressions: [`${marker} forbidden`], suppressionNotes: `${marker} suppression`,
});
const profile = {
  company: { name: "Unchanged seller" },
  voice: voice("stale"),
  voicePersonas: [
    { id: "a", name: "Advisor", voice: voice("A"), summary: "A summary" },
    { id: "b", name: "Builder", voice: voice("B"), summary: "B summary" },
  ],
  activeVoicePersonaId: "a",
};

test("options contain IDs, names and saved descriptions; choosing an inactive persona never activates it", () => {
  const before = structuredClone(profile);
  assert.deepEqual(voicePersonaOptions(profile), {
    voicePersonas: [{ id: "a", name: "Advisor", summary: "A summary" }, { id: "b", name: "Builder", summary: "B summary" }],
    activeVoicePersonaId: "a",
  });
  const result = resolveOutputVoice(profile, { voicePersonaId: "b", tone: "Formal", inheritHqTone: false });
  assert.deepEqual(result.voiceProfile, voice("B"));
  assert.deepEqual(JSON.parse(result.hqVoice), voice("B"));
  assert.equal(result.voicePersonaId, "b");
  assert.match(result.tone, /instead of a generic tone/);
  assert.deepEqual(profile, before);
});

test("generic tones ignore saved voices and custom tones remain supported", () => {
  assert.deepEqual(resolveOutputVoice(profile, { tone: "Direct", voicePersonaId: null, inheritHqTone: false }), {
    tone: "Direct", hqVoice: "", voiceProfile: undefined, voicePersonaId: null,
  });
  assert.equal(resolveOutputVoice(profile, { tone: "Custom", customTone: "Matter-of-fact" }).tone, "Matter-of-fact");
});

test("legacy inheritance resolves active voice while explicit ID wins over inheritance", () => {
  assert.deepEqual(resolveOutputVoice(profile, { tone: "Default", inheritHqTone: true }).voiceProfile, voice("A"));
  assert.deepEqual(resolveOutputVoice(profile, { tone: "my_voice_profile" }).voiceProfile, voice("A"));
  assert.deepEqual(resolveOutputVoice(profile, { voicePersonaId: "b", inheritHqTone: true }).voiceProfile, voice("B"));
  assert.deepEqual(resolveOutputVoice({ voice: voice("legacy") }, { tone: "my_voice_profile" }).voiceProfile, voice("legacy"));
});

test("deleted, malformed, and another account's IDs fail rather than falling back", () => {
  for (const id of ["missing", "", " ", "x".repeat(101)]) {
    assert.throws(() => resolveOutputVoice(profile, { voicePersonaId: id }), VoicePersonaSelectionError);
  }
  assert.throws(() => resolveOutputVoice({ voice: voice("other account") }, { voicePersonaId: "b" }), VoicePersonaSelectionError);
  assert.throws(() => resolveOutputVoice({}, { tone: "my_voice_profile" }), VoicePersonaSelectionError);
  assert.equal(resolveOutputVoice({}, { tone: "Default", inheritHqTone: true }).hqVoice, "");
});

test("snapshot survives JSON round trip and later persona edits or deletion", () => {
  const selected = resolveOutputVoice(profile, { voicePersonaId: "b" });
  const stored = JSON.parse(JSON.stringify({ voicePersonaId: selected.voicePersonaId, voiceProfile: selected.voiceProfile }));
  const changed = structuredClone(profile);
  changed.voicePersonas[1].voice.writingNotes = "Later edit";
  changed.voicePersonas.pop();
  assert.deepEqual(stored.voiceProfile, voice("B"));
  assert.equal(stored.voicePersonaId, "b");
});

test("long examples are bounded without dropping suppressions or breaking JSON", () => {
  const long = structuredClone(profile);
  long.voicePersonas[1].voice.trainingText = "sample".repeat(5000);
  const selected = resolveOutputVoice(long, { voicePersonaId: "b" });
  const promptVoice = JSON.parse(selected.hqVoice);
  assert.equal(promptVoice.trainingText.length, 8000);
  assert.deepEqual(promptVoice.suppressions, voice("B").suppressions);
  assert.equal(promptVoice.suppressionNotes, voice("B").suppressionNotes);
  assert.equal(selected.voiceProfile?.trainingText.length, 30000);
});
