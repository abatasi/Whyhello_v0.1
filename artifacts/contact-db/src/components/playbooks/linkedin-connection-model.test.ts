import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createConnectionVariant, createLinkedInConnectionConfiguration, readLinkedInConnectionConfiguration, validateLinkedInConnectionConfiguration } from "./linkedin-connection-model";
import { readStoredWorkflow } from "./playbook-workflow-storage";

const ready = () => {
  const config = createLinkedInConnectionConfiguration();
  config.variants[0].preview = { body: "A brief connection invitation.", contactId: 1, personalization: "Actual contact.", insightsUsed: [] };
  return config;
};
test("every active mode needs a personalized preview with the 200-character limit", () => {
  assert.match(validateLinkedInConnectionConfiguration(createLinkedInConnectionConfiguration())!, /preview/);
  const config = ready();
  config.variants[0].preview!.body = "a".repeat(200);
  assert.equal(validateLinkedInConnectionConfiguration(config), null);
  config.variants[0].preview!.body += "a";
  assert.match(validateLinkedInConnectionConfiguration(config)!, /200 characters/);
});
test("template edits invalidate a previously validated merge preview", () => {
  const config = ready(); const variant = config.variants[0];
  variant.mode = "template"; variant.templateBody = "Hi {{firstName}}, let's connect.";
  assert.match(validateLinkedInConnectionConfiguration(config)!, /current template/);
  variant.preview!.templateBody = variant.templateBody;
  assert.equal(validateLinkedInConnectionConfiguration(config), null);
  variant.templateBody += " More context.";
  assert.match(validateLinkedInConnectionConfiguration(config)!, /current template/);
});
test("saved notes and configuration restore cleanly without mutating the workflow", () => {
  const config = ready();
  const raw = JSON.stringify({ nodes: [{ id: "connection-1", data: { blockType: "linkedin-connection-request", configuration: config } }], edges: [], prospects: [] });
  assert.equal(JSON.stringify(readStoredWorkflow(raw)), raw);
  assert.deepEqual(readLinkedInConnectionConfiguration(config), config);
});
test("allocation, prompt, custom tone and timing guards apply to connection notes", () => {
  const config = ready(); const variant = config.variants[0];
  variant.allocation = 90;
  assert.match(validateLinkedInConnectionConfiguration(config)!, /100%/);
  variant.allocation = 100; variant.mode = "prompt";
  assert.match(validateLinkedInConnectionConfiguration(config)!, /generation instructions/);
  variant.prompt = "Connect respectfully."; variant.tone = "Custom";
  assert.match(validateLinkedInConnectionConfiguration(config)!, /custom tone/);
  variant.customTone = "Brief"; config.dueTiming.unit = "specific";
  assert.match(validateLinkedInConnectionConfiguration(config)!, /date and time/);
});
test("disabled steps and zero-traffic variants do not require generation", () => {
  const config = createLinkedInConnectionConfiguration();
  config.enabled = false;
  assert.equal(validateLinkedInConnectionConfiguration(config), null);
  const active = ready();
  active.variants.push({ ...createConnectionVariant("Test B"), allocation: 0 });
  assert.equal(validateLinkedInConnectionConfiguration(active), null);
});