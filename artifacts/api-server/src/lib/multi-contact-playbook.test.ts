import { test } from "node:test";
import assert from "node:assert/strict";
import { multiContactCanvas, multiContactActivationError, multiRecipientContext, storedPlaybookNodes, type MultiCanvas } from "./multi-contact-playbook.js";
const document = (): MultiCanvas & { nodes: unknown[] } => ({ contactMode: "multi", companyId: 12, nodes: [], seatSequences: [
  { id: "lead", name: "Business Champion", contactId: 10, workflow: { nodes: [{ id: "lead-email", data: { blockType: "manual-email" } }], edges: [], prospects: [] } },
  { id: "buyer", name: "Economic Buyer", contactId: 11, workflow: { nodes: [{ id: "buyer-call", data: { blockType: "phone-call" } }], edges: [], prospects: [] } },
] });
test("legacy single workflows remain single, with their own nodes", () => {
  assert.equal(multiContactCanvas(JSON.stringify({ nodes: [], edges: [] })), null);
  assert.deepEqual(storedPlaybookNodes(JSON.stringify({ nodes: [{ id: "single", data: {} }] })), [{ id: "single", data: {} }]);
});
test("all independent seat nodes are inspected, not the lead mirror", () => {
  assert.deepEqual(storedPlaybookNodes(JSON.stringify(document())).map(node => node.id), ["lead-email", "buyer-call"]);
  assert.equal(multiContactActivationError(multiContactCanvas(JSON.stringify(document()))!), undefined);
});
test("an empty non-lead sequence prevents activation", () => {
  const value = document(); value.seatSequences[1].workflow.nodes = [];
  assert.match(multiContactActivationError(multiContactCanvas(JSON.stringify(value))!)!, /Economic Buyer/);
});
test("every seat must be assigned before activation", () => {
  const value = document(); value.seatSequences[1].contactId = null;
  assert.match(multiContactActivationError(multiContactCanvas(JSON.stringify(value))!)!, /every Buying Center seat/);
});
test("duplicate contacts and non-lead defaults are rejected", () => {
  const value = document(); value.seatSequences[1].contactId = 10;
  assert.throws(() => multiContactCanvas(JSON.stringify(value)), /Multi-Contact/);
  value.seatSequences[1].contactId = 11; value.seatSequences.reverse();
  assert.throws(() => multiContactCanvas(JSON.stringify(value)), /Business Champion/);
});
test("preview context identifies the actual recipient's assigned seat", () => {
  assert.deepEqual(multiRecipientContext(JSON.stringify(document()), 11, 12), { seat: "Economic Buyer" });
  assert.ok(multiRecipientContext(JSON.stringify(document()), 11, 99).error);
  assert.ok(multiRecipientContext(JSON.stringify(document()), 1000, 12).error);
  assert.deepEqual(multiRecipientContext(JSON.stringify({ nodes: [] }), 10, 12), {});
});
