import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readStoredWorkflow } from "./playbook-workflow-storage";

test("reload preserves a saved Manual Email workflow without phantom edits", () => {
  const saved = {
    nodes: [{ id: "email-1", position: { x: 0, y: 0 }, data: {
      blockType: "manual-email", configuration: { variants: [{
        userContext: "QA seller context", guidelines: [{ id: "g1", text: "Keep it brief." }],
        preview: { subject: "QA subject", body: "QA body" },
      }] },
    } }],
    edges: [], prospects: [],
  };
  const raw = JSON.stringify(saved);
  const restored = readStoredWorkflow(raw);
  assert.deepEqual(restored, saved);
  assert.equal(JSON.stringify(restored), raw);
  assert.deepEqual(readStoredWorkflow(JSON.stringify(restored)), saved);
});
test("legacy records are preserved without inserting graph scaffolding", () => {
  const nodes = [{ id: "legacy-1", data: { blockType: "send-email", emailBody: "Saved content" } }];
  assert.deepEqual(readStoredWorkflow(JSON.stringify({ nodes })), { nodes, edges: [], prospects: [] });
});
test("invalid workflow shapes fail explicitly", () => {
  assert.throws(() => readStoredWorkflow('{"nodes":null}'));
  assert.throws(() => readStoredWorkflow('{"nodes":[],"edges":{}}'));
});