import { test } from "node:test";
import assert from "node:assert/strict";
import { singleToMultiContact, appendBuyingCenterSeat } from "./contact-mode-model";
import { chooseSampleCompany, chooseSampleContact, populateAddedSamples, sampleViewFor } from "./sample-view-model";
const document = () => singleToMultiContact({
  nodes: [{ id: "email", position: { x: 0, y: 0 }, data: { configuration: { variants: [{ templateBody: "Keep template", additionalContext: "Keep context", preview: { body: "Old sample" } }] } } }],
  edges: [], prospects: [{ isPrimary: true, contactId: 10 }],
}, "Economic Buyer", { id: 10, companyId: 12 });
test("company samples auto-fill matching seats, mark missing ones and never change actual recipients", () => {
  const original = document(), before = JSON.stringify(original);
  const next = chooseSampleCompany(original, 99, [{ id: 25, companyId: 99, matchingSeats: ["Business Champion"] }]);
  assert.deepEqual(next.sampleView?.contactIds, { "seat-0": 25, "seat-1": null });
  assert.equal(next.companyId, 12);
  assert.equal(next.seatSequences[0].contactId, 10);
  assert.deepEqual(next.seatSequences[0].workflow.prospects, original.seatSequences[0].workflow.prospects);
  assert.equal(JSON.stringify(original), before);
  const variant = (next.seatSequences[0].workflow.nodes[0].data.configuration as { variants: { preview?: unknown; additionalContext: string; templateBody: string }[] }).variants[0];
  assert.equal(variant.preview, undefined); assert.equal(variant.additionalContext, "Keep context"); assert.equal(variant.templateBody, "Keep template");
});
test("manual fallback can reuse another sample's contact and survives reload", () => {
  const auto = chooseSampleCompany(document(), 99, [{ id: 25, companyId: 99, matchingSeats: ["Business Champion"] }]);
  const next = chooseSampleContact(auto, "seat-1", 25);
  assert.deepEqual(sampleViewFor(JSON.parse(JSON.stringify(next))).contactIds, { "seat-0": 25, "seat-1": 25 });
  assert.deepEqual(next.sampleView?.manualSeatIds, ["seat-1"]);
  assert.equal(next.seatSequences[1].contactId, null);
});
test("changing sample company replaces stale overrides, handles no contacts and populates newly added seats", () => {
  const samples = [{ id: 25, companyId: 99, matchingSeats: ["Business Champion", "Technical Buyer"] }];
  const next = populateAddedSamples(appendBuyingCenterSeat(chooseSampleCompany(document(), 99, samples), "Technical Buyer"), samples);
  assert.equal(next.sampleView?.contactIds["seat-2"], 25);
  const changed = chooseSampleCompany(chooseSampleContact(next, "seat-1", 25), 100, []);
  assert.deepEqual(changed.sampleView?.contactIds, { "seat-0": null, "seat-1": null, "seat-2": null });
  assert.deepEqual(changed.sampleView?.manualSeatIds, []);
  assert.equal(changed.companyId, 12);
});
