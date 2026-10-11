import { test } from "node:test";
import assert from "node:assert/strict";
import { createContactModeDocument, readMultiContactDocument, updateSeatWorkflow, clearRecipientPreviews, SINGLE_CONTACT } from "./contact-mode-model";
import { duplicateDescription, type PlaybookRecord } from "./list-model";
import { configuredBuyingCenterSeats, BUYING_CENTER_SEATS } from "./contact-mode-model";
import { appendBuyingCenterSeat, singleToMultiContact } from "./contact-mode-model";
test("adding a seat preserves saved sequences and assignments and starts an independent empty sequence", () => {
  const original = singleToMultiContact(starter(), "Economic Buyer", { id: 42, companyId: 9 });
  const before = JSON.stringify(original);
  const next = appendBuyingCenterSeat(original, "Technical Buyer");
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(next.seatSequences.slice(0, 2), original.seatSequences);
  assert.equal(next.companyId, 9);
  assert.equal(next.seatSequences[0].contactId, 42);
  assert.deepEqual(next.seatSequences[2].workflow, { nodes: [], edges: [], prospects: [] });
  assert.equal(next.seatSequences[2].contactId, null);
  assert.equal(new Set(next.seatSequences.map(seat => seat.id)).size, 3);
  assert.throws(() => appendBuyingCenterSeat(next, "Economic Buyer"), /already included/);
  assert.throws(() => appendBuyingCenterSeat(next, "Unknown"), /valid Buying Center/);
});
test("Single to Multi preserves the original workflow as Business Champion without copying it to the new seat", () => {
  const source = { ...starter(), prospects: [{ isPrimary: true, contactId: 42, laneId: "primary" }] };
  const multi = singleToMultiContact(source, "Technical Buyer", { id: 42, companyId: 9 });
  assert.deepEqual(multi.seatSequences[0].workflow, source);
  assert.equal(multi.seatSequences[0].name, "Business Champion");
  assert.equal(multi.seatSequences[1].name, "Technical Buyer");
  assert.equal(multi.seatSequences[1].workflow.nodes.length, 0);
  assert.equal(readMultiContactDocument(JSON.stringify(multi))?.seatSequences.length, 2);
  multi.seatSequences[0].workflow.nodes[0].data.label = "Changed";
  assert.equal(source.nodes[0].data.label, "Email");
  assert.throws(() => singleToMultiContact(source, "Business Champion"), /already included/);
});
test("saved Buying Centers select only highlighted seats, not all hypothetical seats", () => {
  const seats = BUYING_CENTER_SEATS.map(seat => ({
    seat, seniorities: seat === "Economic Buyer" ? ["Executive"] : [],
    departments: seat === "Business Champion" ? ["Sales"] : [],
  }));
  assert.deepEqual(configuredBuyingCenterSeats(seats).sort(), ["Business Champion", "Economic Buyer"]);
  const other = seats.map(seat => ({ ...seat, seniorities: [], departments: seat.seat === "Technical Buyer" ? ["Engineering"] : [] }));
  assert.deepEqual(configuredBuyingCenterSeats(other), ["Technical Buyer"]);
  assert.deepEqual(configuredBuyingCenterSeats(seats.map(seat => ({ ...seat, seniorities: [], departments: [] }))), []);
  assert.deepEqual(configuredBuyingCenterSeats(["Economic Buyer", "Economic Buyer", "Unknown"]), ["Economic Buyer"]);
});
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
