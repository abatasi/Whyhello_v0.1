import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { playbookMessageContext, PLAYBOOK_ADDITIONAL_CONTEXT_GUIDANCE } from "./playbook-message-context.js";
import { manualEmailGuidance, emailAnatomySchema, emailBodyFromAnatomy } from "./manual-email-guidance.js";

const event = "I just met these contacts at the ABC Tradeshow and they all came to our booth.";
const sources = [{ id: "company", name: "Company", content: "Our company builds research tools." },
  { id: "customers", name: "Customers", content: "An unselected source." }];

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
