import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { firstHandMeetingContext, preserveFirstHandMeeting, playbookMessageContext, PLAYBOOK_ADDITIONAL_CONTEXT_GUIDANCE } from "./playbook-message-context.js";
import { fitManualEmailLength } from "./manual-email-length-fit.js";
import { manualEmailGuidance, emailAnatomySchema, emailBodyFromAnatomy } from "./manual-email-guidance.js";

const event = "I just met these contacts at the ABC Tradeshow and they all came to our booth.";
const sources = [{ id: "company", name: "Company", content: "Our company builds research tools." },
  { id: "customers", name: "Customers", content: "An unselected source." }];

const tradeshowContext = "I just met these contacts at a tradeshow in Tampa Bay called IA Annual.";
const anatomy = { hook: 'I came across your post: **"A verified insight"**.', bridge: "A buyer implication.", value: "A supported outcome.", proof: "A grounded proof point.", cta: "Compare notes?" };

test("explicit tradeshow meeting keeps the supplied event and location without inventing a booth visit", () => {
  const meeting = firstHandMeetingContext(tradeshowContext);
  assert.deepEqual(meeting, { event: "IA Annual", location: "Tampa Bay", opener: "We met at IA Annual in Tampa Bay." });
  const result = preserveFirstHandMeeting({ anatomy }, meeting);
  assert.ok(result.anatomy.hook.startsWith("We met at IA Annual in Tampa Bay."));
  assert.ok(result.anatomy.hook.includes(anatomy.hook));
  assert.equal(emailBodyFromAnatomy(result.anatomy).split("\n\n").length, 5);
  assert.doesNotMatch(result.anatomy.hook, /booth|discussed|interested|consent/i);
});

test("existing acknowledgement is not duplicated; missing location is restored", () => {
  const meeting = firstHandMeetingContext(tradeshowContext);
  const existing = { anatomy: { ...anatomy, hook: `Great meeting you at IA Annual in Tampa Bay. ${anatomy.hook}` } };
  assert.equal(preserveFirstHandMeeting(existing, meeting), existing);
  const missingCity = { anatomy: { ...anatomy, hook: `Great meeting you at IA Annual. ${anatomy.hook}` } };
  assert.match(preserveFirstHandMeeting(missingCity, meeting).anatomy.hook, /IA Annual in Tampa Bay/);
  assert.equal(firstHandMeetingContext("We may meet these contacts at IA Annual."), undefined);
  assert.equal(firstHandMeetingContext("I have not met these contacts at IA Annual."), undefined);
  assert.equal(firstHandMeetingContext(""), undefined);
  assert.equal(firstHandMeetingContext(event)?.event, "ABC Tradeshow");
  assert.equal(firstHandMeetingContext("I've just met these contacts at IA Annual in Tampa Bay.")?.location, "Tampa Bay");
});

test("a shortening pass cannot discard the supplied meeting, event or location", async () => {
  const meeting = firstHandMeetingContext(tradeshowContext);
  const original = preserveFirstHandMeeting({ anatomy: { ...anatomy, value: "Supported value. ".repeat(80) } }, meeting);
  const result = await fitManualEmailLength(original, "medium", async instruction => {
    assert.match(instruction, /first-hand meeting, event name and location/);
    // Simulate an otherwise valid model edit that silently drops relationship facts.
    return preserveFirstHandMeeting({ anatomy }, meeting);
  });
  assert.match(result.anatomy.hook, /We met at IA Annual in Tampa Bay/);
  assert.equal(emailBodyFromAnatomy(result.anatomy).split("\n\n").length, 5);
});

test("context is included without selecting a legacy custom flag, without replacing HQ evidence", () => {
  const variant = { contextSources: ["company"], userContext: `  ${event}  ` };
  const result = playbookMessageContext(sources, variant);
  assert.equal(result.additionalContext, event);
  assert.deepEqual(result.insideOut, [{ name: "Company", content: sources[0].content }]);
  assert.deepEqual(variant.contextSources, ["company"]);
  assert.equal(variant.userContext, `  ${event}  `);
});

test("clearing context removes it and legacy flags cannot create a phantom context", () => {
  const result = playbookMessageContext(sources, { contextSources: ["company", "custom"], userContext: " \n " });
  assert.equal(result.additionalContext, "");
  assert.equal(result.insideOut.length, 1);
});

test("user context remains distinct from product/customer proof, including when HQ is absent", () => {
  const result = playbookMessageContext([], { contextSources: [], userContext: event });
  assert.deepEqual(result, { insideOut: [], additionalContext: event });
  assert.match(PLAYBOOK_ADDITIONAL_CONTEXT_GUIDANCE, /not proof of a seller capability or economic benefit/);
  assert.match(PLAYBOOK_ADDITIONAL_CONTEXT_GUIDANCE, /Do not invent dates, discussions, promises, product interest/);
});

test("every email category retains anatomy while incorporating additional context guidance", () => {
  for (const category of ["personal", "company", "industry", "role", "colleagues", "counterparts"] as const) {
    const prompt = manualEmailGuidance(category, "medium", "inline");
    assert.ok(prompt.includes(PLAYBOOK_ADDITIONAL_CONTEXT_GUIDANCE));
    for (const layer of ["HOOK:", "BRIDGE:", "VALUE:", "PROOF:", "CTA:"]) assert.ok(prompt.includes(layer));
  }
  const anatomy = emailAnatomySchema.parse({ hook: "Good meeting you at ABC Tradeshow.", bridge: "A supported buyer implication.", value: "A supported outcome.", proof: "Supported seller proof.", cta: "Compare notes?" });
  assert.equal(emailBodyFromAnatomy(anatomy).split("\n\n").length, 5);
});

test("all Playbook AI routes pass additional context, and both shorter channels use its safeguards", () => {
  for (const channel of ["manual-email", "phone-call", "linkedin-connection"]) {
    const route = readFileSync(new URL(`../routes/playbook-${channel}.ts`, import.meta.url), "utf8");
    assert.match(route, /playbookMessageContext\(hq\.contextSources, v\)/);
    assert.match(route, /insideOut, additionalContext/);
    assert.doesNotMatch(route, /(?:includes|has)\("custom"\).*userContext/);
    if (channel !== "manual-email") assert.match(route, /role: "system", content: PLAYBOOK_ADDITIONAL_CONTEXT_GUIDANCE/);
  }
});
