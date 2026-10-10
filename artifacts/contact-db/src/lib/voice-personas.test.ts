import assert from "node:assert/strict";
import test from "node:test";
import {
  activateVoicePersona,
  deleteVoicePersona,
  duplicateVoicePersona,
  migrateVoicePersonas,
  renameVoicePersona,
  selectVoicePersona,
  updateVoicePersona,
} from "./voice-personas.ts";

const legacyVoice = {
  toneTags: ["Direct", "Warm"],
  communicationStyle: "executive",
  writingNotes: "Short, considered sentences.",
  trainingText: "A sample message.",
  suppressions: ["Emojis"],
  suppressionNotes: "No false familiarity.",
};
const base = {
  voice: legacyVoice,
  voicePersonas: [],
  activeVoicePersonaId: "",
};

test("migrates legacy voice losslessly into the first Default persona", () => {
  const migrated = migrateVoicePersonas(base, () => "persona-a");
  assert.equal(migrated.activeVoicePersonaId, "persona-a");
  assert.equal(migrated.voicePersonas[0].name, "Default");
  assert.deepEqual(migrated.voicePersonas[0].voice, legacyVoice);
  assert.deepEqual(migrated.voice, legacyVoice);
});

test("editor selection is separate from activation and compatibility mirror", () => {
  const first = migrateVoicePersonas(base, () => "persona-a");
  const second = duplicateVoicePersona(first, "persona-a", "persona-b");
  const switched = selectVoicePersona(second, "persona-b");
  assert.equal(switched.editorPersonaId, "persona-b");
  assert.equal(switched.data.activeVoicePersonaId, "persona-a");
  assert.deepEqual(switched.data.voice, legacyVoice);
  const activated = activateVoicePersona(switched.data, "persona-b");
  assert.equal(activated.activeVoicePersonaId, "persona-b");
  assert.deepEqual(activated.voice, activated.voicePersonas[1].voice);
});

test("editing active updates compatibility mirror; editing another does not", () => {
  const initial = migrateVoicePersonas(base, () => "persona-a");
  const other = duplicateVoicePersona(initial, "persona-a", "persona-b");
  const activeEdit = updateVoicePersona(other, "persona-a", { writingNotes: "Updated" });
  assert.equal(activeEdit.voice.writingNotes, "Updated");
  const inactiveEdit = updateVoicePersona(activeEdit, "persona-b", { writingNotes: "Separate" });
  assert.equal(inactiveEdit.voice.writingNotes, "Updated");
  assert.equal(inactiveEdit.voicePersonas[1].voice.writingNotes, "Separate");
});

test("names trim, reject blank and case-insensitive duplicates", () => {
  const initial = duplicateVoicePersona(migrateVoicePersonas(base, () => "persona-a"), "persona-a", "persona-b");
  const blank = renameVoicePersona(initial, "persona-a", "   ");
  assert.equal(blank.error, "Give this persona a name.");
  const tooLong = renameVoicePersona(initial, "persona-a", "x".repeat(121));
  assert.equal(tooLong.error, "Names must be 120 characters or fewer.");
  const duplicate = renameVoicePersona(initial, "persona-b", "  default ");
  assert.match(duplicate.error ?? "", /already exists/);
  const renamed = renameVoicePersona(initial, "persona-b", "  Sales leader ");
  assert.equal(renamed.data.voicePersonas[1].name, "Sales leader");
});

test("duplicates preserve all voice fields and custom summary", () => {
  const initial = migrateVoicePersonas(base, () => "persona-a");
  const withSummary = {
    ...initial,
    voicePersonas: [{ ...initial.voicePersonas[0], summary: "A custom voice summary." }],
  };
  const copy = duplicateVoicePersona(withSummary, "persona-a", "persona-b");
  assert.deepEqual(copy.voicePersonas[1].voice, legacyVoice);
  assert.equal(copy.voicePersonas[1].summary, "A custom voice summary.");
  assert.notEqual(copy.voicePersonas[0].voice.toneTags, copy.voicePersonas[1].voice.toneTags);
});

test("deletion blocks the final persona and replaces an active persona explicitly", () => {
  const initial = duplicateVoicePersona(migrateVoicePersonas(base, () => "persona-a"), "persona-a", "persona-b");
  const blocked = deleteVoicePersona(initial, "persona-a");
  assert.equal(blocked.deleted, true);
  assert.equal(blocked.replacementId, "persona-b");
  assert.equal(blocked.data.activeVoicePersonaId, "persona-b");
  assert.deepEqual(blocked.data.voice, blocked.data.voicePersonas[0].voice);
  const last = deleteVoicePersona(blocked.data, "persona-b");
  assert.equal(last.deleted, false);
  assert.equal(last.data.voicePersonas.length, 1);
});
