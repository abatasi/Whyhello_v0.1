import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createManualEmailConfiguration, createEmailVariant, readManualEmailConfiguration } from "./manual-email-model";
import { createPhoneCallConfiguration } from "./phone-call-model";
import { createLinkedInConnectionConfiguration } from "./linkedin-connection-model";

test("named voice ID survives reusable manual email configuration reload", () => {
  const config = createManualEmailConfiguration();
  config.variants[0].tone = "Professional";
  config.variants[0].inheritHqTone = false;
  config.variants[0].voicePersonaId = "persona-stable-42";
  const restored = readManualEmailConfiguration(JSON.parse(JSON.stringify(config)));
  assert.equal(restored.variants[0].voicePersonaId, "persona-stable-42");
  assert.equal(restored.variants[0].tone, "Professional");
  assert.equal(restored.variants[0].inheritHqTone, false);
});

test("legacy HQ inheritance remains intact without a pinned persona ID", () => {
  const config = createManualEmailConfiguration();
  const restored = readManualEmailConfiguration(JSON.parse(JSON.stringify(config)));
  assert.equal(restored.variants[0].inheritHqTone, true);
  assert.equal(restored.variants[0].voicePersonaId, undefined);
});

test("new email, phone and LinkedIn configurations prefer the defined active HQ voice", () => {
  const context = { voicePersonas: [{ id: "a", name: "Advisor" }, { id: "b", name: "Builder" }], activeVoicePersonaId: "b" };
  for (const create of [createManualEmailConfiguration, createPhoneCallConfiguration, createLinkedInConnectionConfiguration]) {
    const variant = create(context).variants[0];
    assert.equal(variant.voicePersonaId, "b");
    assert.equal(variant.inheritHqTone, false);
  }
  assert.equal(createEmailVariant("Test B", { ...context, activeVoicePersonaId: null }).voicePersonaId, "a");
  assert.equal(createEmailVariant("Test B", {}).voicePersonaId, null);
  assert.equal(createEmailVariant("Test B", {}).inheritHqTone, false);
});
