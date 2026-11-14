import assert from "node:assert/strict";
import test from "node:test";
import { editableTemplateNodes } from "./template-workflow";
import { createManualEmailConfiguration, type ManualEmailConfiguration } from "./manual-email-model";
import type { PhoneCallConfiguration } from "./phone-call-model";
import type { LinkedInConnectionConfiguration } from "./linkedin-connection-model";
import { createContactModeDocument, type MultiContactDocument } from "./contact-mode-model";

const node = (id: string, blockType: string, extra: Record<string, unknown> = {}) => ({
  id, type: "playbook", position: { x: 0, y: 140 },
  data: { blockType, laneId: "lane_primary", ...extra } as Record<string, unknown>,
});

test("template touchpoints use normal editable step types in the original order", () => {
  const original = [
    node("start", "prospect-added"), node("email", "send-email", { emailType: "Initial Email" }),
    node("delay", "time-delay", { delayAmount: 3, delayUnit: "business days" }),
    node("follow", "send-email", { emailType: "Follow-up" }),
    node("call", "make-call"),
    node("connection", "send-linkedin", { linkedinAction: "Send Connection Request" }),
    node("message", "send-linkedin", { linkedinAction: "Send Message", linkedinBody: "Keep me" }),
    node("split", "split-path", { branches: ["YES", "NO"], condition: "Email replied to" }),
    node("last", "send-email", { emailType: "Breakup Email" }), node("end", "sequence-complete"),
  ];
  const before = JSON.stringify(original);
  const result = editableTemplateNodes(original);
  assert.deepEqual(result.map(n => n.id), original.map(n => n.id));
  assert.deepEqual(result.map(n => n.data.blockType), [
    "prospect-added", "manual-email", "time-delay", "manual-email", "phone-call",
    "linkedin-connection-request", "send-linkedin", "split-path", "manual-email", "sequence-complete",
  ]);
  assert.equal(JSON.stringify(original), before, "input must not be mutated");
  for (const index of [0, 2, 6, 7, 9]) assert.equal(result[index], original[index]);
  const configs = [result[1], result[3], result[8]].map(n => n.data.configuration as ManualEmailConfiguration);
  assert.deepEqual(configs.map(c => c.variants[0].emailType), ["Outreach", "Follow-up", "Last pitch"]);
  assert.ok(configs.every(c => c.variants[0].mode === "assisted" && !c.variants[0].preview && c.variants[0].inheritHqTone));
  assert.equal(new Set(configs.map(c => c.variants[0].id)).size, 3);
});

test("saved seller text, insight category, objective and CTA survive conversion and reload", () => {
  const result = editableTemplateNodes([node("email", "send-email", {
    subject: "For {{firstName}}", emailBody: "Seller-written email", insightCategory: "Company",
    messagingObjective: "Educate", callToAction: "Open to a chat?", emailType: "Value Share", label: "My introduction",
  })]);
  const config = result[0].data.configuration as ManualEmailConfiguration;
  assert.equal(config.variants[0].mode, "template");
  assert.equal(config.variants[0].templateSubject, "For {{firstName}}");
  assert.equal(config.variants[0].templateBody, "Seller-written email");
  assert.equal(config.variants[0].insightCategory, "company");
  assert.deepEqual(config.variants[0].guidelines.map(g => g.text), [
    "Messaging objective: Educate", "Call to action: Open to a chat?",
  ]);
  assert.equal(result[0].data.emailBody, "Seller-written email");
  assert.equal(result[0].data.label, "My introduction");
  assert.deepEqual(editableTemplateNodes(JSON.parse(JSON.stringify(result))), result);
});

test("call scripts and connection notes stay editable without invented previews", () => {
  const result = editableTemplateNodes([
    node("call", "make-call", { opener: "Hello", discoveryQuestion: "What changed?", voicemail: "Call me", callObjective: "Reconnect" }),
    node("li", "send-linkedin", { linkedinAction: "Send Connection Request", linkedinBody: "Let's connect." }),
  ]);
  const call = (result[0].data.configuration as PhoneCallConfiguration).variants[0];
  assert.equal(call.mode, "template");
  assert.equal(call.template.opener, "Hello");
  assert.deepEqual(call.template.questions, ["What changed?"]);
  assert.equal(call.template.voicemail, "Call me");
  assert.equal(call.preview, undefined);
  const connection = (result[1].data.configuration as LinkedInConnectionConfiguration).variants[0];
  assert.equal(connection.mode, "template");
  assert.equal(connection.templateBody, "Let's connect.");
  assert.equal(connection.preview, undefined);
});

test("already configured and unknown steps remain intact", () => {
  const configuration = createManualEmailConfiguration();
  configuration.variants[0].userContext = "Met at a tradeshow";
  const modern = node("modern", "manual-email", { configuration });
  const legacy = node("legacy", "send-email", { configuration });
  const unknown = node("unknown", "custom-action", { content: "Saved content" });
  const result = editableTemplateNodes([modern, legacy, unknown]);
  assert.equal(result[0], modern);
  assert.equal(result[1].data.configuration, configuration);
  assert.equal(result[2], unknown);
});

test("multi-contact template copies preserve edges and isolate each seat's edits", () => {
  const nodes = editableTemplateNodes([
    node("email", "send-email"), node("delay", "time-delay", { delayAmount: 3 }),
    node("call", "make-call"),
  ]);
  const edges = [{ id: "e1", source: "email", target: "delay" }, { id: "e2", source: "delay", target: "call", sourceHandle: "delay-0" }];
  const doc = createContactModeDocument({ nodes, edges, prospects: [] }, {
    mode: "multi", seats: ["Business Champion", "Economic Buyer"],
  }) as MultiContactDocument;
  assert.equal(doc.seatSequences.length, 2);
  const [lead, buyer] = doc.seatSequences;
  assert.deepEqual(lead.workflow.nodes.map(n => n.data.blockType), ["manual-email", "time-delay", "phone-call"]);
  for (const seat of doc.seatSequences) {
    const ids = new Set(seat.workflow.nodes.map(n => n.id));
    assert.ok(seat.workflow.edges.every(e => ids.has(e.source) && ids.has(e.target)));
  }
  const leadConfig = lead.workflow.nodes[0].data.configuration as ManualEmailConfiguration;
  const buyerConfig = buyer.workflow.nodes[0].data.configuration as ManualEmailConfiguration;
  leadConfig.variants[0].userContext = "Lead only";
  assert.equal(buyerConfig.variants[0].userContext, "");
});
