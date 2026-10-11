import { test } from "node:test";
import assert from "node:assert/strict";
import { createContactModeDocument, readMultiContactDocument, updateSeatWorkflow, clearRecipientPreviews, SINGLE_CONTACT } from "./contact-mode-model";
import { duplicateDescription, type PlaybookRecord } from "./list-model";
const starter = () => ({ nodes: [{ id: "email", position: { x: 0, y: 0 }, data: { label: "Email" } }], edges: [], prospects: [] });
test("single contact retains its exact existing workflow", () => {
  const original = starter(); assert.equal(createContactModeDocument(original, SINGLE_CONTACT), original);
});
test("multi seats are independent and Business Champion is the default lead", () => {
  const value = readMultiContactDocument(JSON.stringify(createContactModeDocument(starter(), { mode: "multi", seats: ["Economic Buyer", "Business Champion"] })))!;
  assert.equal(value.seatSequences[0].name, "Business Champion");
  assert.notEqual(value.seatSequences[0].workflow.nodes[0].id, value.seatSequences[1].workflow.nodes[0].id);
  value.seatSequences[0].workflow.nodes[0].data.label = "Champion email";
  assert.equal(value.seatSequences[1].workflow.nodes[0].data.label, "Email");
  const updated = updateSeatWorkflow(value, value.seatSequences[1].id, { nodes: [], edges: [], prospects: [] });
  assert.equal(updated.seatSequences[0].workflow.nodes[0].data.label, "Champion email");
  assert.equal(updated.seatSequences[1].workflow.nodes.length, 0);
  assert.equal(updated.nodes[0].data.label, "Champion email");
});
test("recipient changes clear generated previews but keep reusable configuration", () => {
  const node = { ...starter().nodes[0], data: { configuration: { variants: [{ id: "variant", templateBody: "Reusable body", preview: { body: "Old recipient" } }] } } };
  const cleared = clearRecipientPreviews(node).data.configuration as { variants: { templateBody: string; preview?: unknown }[] };
  assert.equal(cleared.variants[0].templateBody, "Reusable body"); assert.equal(cleared.variants[0].preview, undefined);
});
test("duplicates keep all seat sequences but reset company and recipients", () => {
  const value = readMultiContactDocument(JSON.stringify(createContactModeDocument(starter(), { mode: "multi", seats: ["Economic Buyer"] })))!;
  value.companyId = 12; value.seatSequences[0].contactId = 10; value.seatSequences[1].contactId = 11;
  value.seatSequences[1].workflow.nodes[0].data.configuration = { variants: [{ id: "variant", preview: { body: "Economic buyer draft" } }] };
  const row = { description: JSON.stringify(value) } as PlaybookRecord;
  const copy = readMultiContactDocument(duplicateDescription(row))!;
  assert.equal(copy.companyId, null); assert.ok(copy.seatSequences.every(seat => seat.contactId === null));
  assert.equal(copy.seatSequences[1].workflow.nodes.length, 1);
  const config = copy.seatSequences[1].workflow.nodes[0].data.configuration as { variants: { preview?: unknown }[] };
  assert.equal(config.variants[0].preview, undefined);
});
