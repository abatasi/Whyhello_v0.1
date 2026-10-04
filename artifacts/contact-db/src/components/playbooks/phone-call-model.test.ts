import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createCallVariant, createPhoneCallConfiguration, readPhoneCallConfiguration, validatePhoneCallConfiguration } from "./phone-call-model";
import { readStoredWorkflow } from "./playbook-workflow-storage";

const template = () => {
  const c = createPhoneCallConfiguration();
  c.variants[0].mode = "template";
  c.variants[0].template = { opener: "Hi {{firstName}}", talkingPoints: ["A supported point"], questions: ["What matters most?"], objections: [{ objection: "Not now", response: "Understood." }], voicemail: "A quick question.", closing: "Would a short conversation help?" };
  return c;
};
test("new calls need a saved preview; complete templates do not need AI", () => {
  assert.match(validatePhoneCallConfiguration(createPhoneCallConfiguration())!, /generate a call preview/);
  assert.equal(validatePhoneCallConfiguration(template()), null);
});
test("call scripts, timing and variant identities survive clean workflow reload", () => {
  const config = template();
  const raw = JSON.stringify({ nodes: [{ id: "call-1", data: { blockType: "phone-call", configuration: config } }], edges: [], prospects: [] });
  assert.equal(JSON.stringify(readStoredWorkflow(raw)), raw);
  assert.deepEqual(readPhoneCallConfiguration(JSON.parse(raw).nodes[0].data.configuration), config);
});
test("call allocations, prompt/custom tone and timing are activation guarded", () => {
  const config = template();
  config.variants[0].allocation = 90;
  assert.match(validatePhoneCallConfiguration(config)!, /100%/);
  config.variants[0].allocation = 100; config.dueTiming.unit = "specific";
  assert.match(validatePhoneCallConfiguration(config)!, /date and time/);
  config.dueTiming.unit = "minutes"; config.variants[0].mode = "prompt";
  assert.match(validatePhoneCallConfiguration(config)!, /generation instructions/);
  config.variants[0].mode = "template"; config.variants[0].tone = "Custom";
  assert.match(validatePhoneCallConfiguration(config)!, /custom tone/);
  config.variants[0].tone = "Default"; config.variants[0].template.talkingPoints = [" "];
  assert.match(validatePhoneCallConfiguration(config)!, /complete the call template/);
});
test("disabled steps and zero-traffic variants do not need generated scripts", () => {
  const config = createPhoneCallConfiguration();
  config.enabled = false;
  assert.equal(validatePhoneCallConfiguration(config), null);
  const ready = template();
  ready.variants.push({ ...createCallVariant("Test B"), allocation: 0 });
  assert.equal(validatePhoneCallConfiguration(ready), null);
});
test("restoring custom context preserves its source without mutating saved input", () => {
  const config = template();
  config.variants[0].userContext = "Actual seller context";
  const original = JSON.stringify(config);
  assert.ok(readPhoneCallConfiguration(config).variants[0].contextSources.includes("custom"));
  assert.equal(JSON.stringify(config), original);
});