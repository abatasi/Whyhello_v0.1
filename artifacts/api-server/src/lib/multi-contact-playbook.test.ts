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
test("preview samples and actual assignments do not determine sequence activation readiness", () => {
  const value = document(); value.seatSequences[1].contactId = null;
  assert.equal(multiContactActivationError(multiContactCanvas(JSON.stringify(value))!), undefined);
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
test("sample previews are separate from recipients and permit a shared fallback with explicit seat identity", () => {
  const value = document();
  value.sampleView = { companyId: 99, contactIds: { lead: 25, buyer: 25 }, manualSeatIds: ["buyer"] };
  assert.ok(multiContactCanvas(JSON.stringify(value)));
  assert.deepEqual(multiRecipientContext(JSON.stringify(value), 25, 99, "buyer"), { seat: "Economic Buyer" });
  assert.deepEqual(multiRecipientContext(JSON.stringify(value), 25, 99, "lead"), { seat: "Business Champion" });
  assert.ok(multiRecipientContext(JSON.stringify(value), 25, 99).error);
  assert.ok(multiRecipientContext(JSON.stringify(value), 25, 12, "buyer").error);
  assert.ok(multiRecipientContext(JSON.stringify(value), 11, 12, "buyer").error);
  assert.equal(value.seatSequences[1].contactId, 11);
});
test("sample metadata rejects invalid company IDs, unknown seats and contact IDs", () => {
  const value = document();
  value.sampleView = { companyId: 99, contactIds: { fake: 25 }, manualSeatIds: [] };
  assert.throws(() => multiContactCanvas(JSON.stringify(value)), /Multi-Contact/);
  value.sampleView.contactIds = { lead: -1 };
  assert.throws(() => multiContactCanvas(JSON.stringify(value)), /Multi-Contact/);
  value.sampleView.contactIds = { lead: 25 }; value.sampleView.companyId = null;
  assert.throws(() => multiContactCanvas(JSON.stringify(value)), /Multi-Contact/);
});
