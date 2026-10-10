import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { AdditionalMessageContext } from "./AdditionalMessageContext";
import { createManualEmailConfiguration, readManualEmailConfiguration } from "./manual-email-model";
import { createPhoneCallConfiguration, readPhoneCallConfiguration } from "./phone-call-model";
import { createLinkedInConnectionConfiguration, readLinkedInConnectionConfiguration } from "./linkedin-connection-model";

const event = "I just met these contacts at the ABC Tradeshow and they all came to our booth.";
test("context is visible and editable with a matching backend character limit", () => {
  const html = renderToStaticMarkup(createElement(AdditionalMessageContext, { value: event, onChange: () => {} }));
  assert.ok(html.includes(event));
  assert.match(html, /maxlength="6000"/i);
  assert.ok(html.includes('aria-label="Additional message context"'));
  assert.doesNotMatch(html, /disabled=""/);
});
test("read-only and template context cannot be edited; template behavior is explicit", () => {
  for (const props of [{ disabled: true }, { template: true }]) {
    const html = renderToStaticMarkup(createElement(AdditionalMessageContext, { value: event, onChange: () => {}, ...props }));
    assert.match(html, /disabled=""/);
    if ("template" in props) assert.match(html, /Templates are used as written/);
  }
});
test("all three saved configuration formats round-trip context independently of the custom flag", () => {
  for (const [create, read] of [
    [createManualEmailConfiguration, readManualEmailConfiguration],
    [createPhoneCallConfiguration, readPhoneCallConfiguration],
    [createLinkedInConnectionConfiguration, readLinkedInConnectionConfiguration],
  ] as const) {
    const config = create();
    config.variants[0].userContext = event;
    const originalSources = [...config.variants[0].contextSources];
    assert.ok(!originalSources.includes("custom"));
    const saved = read(JSON.parse(JSON.stringify(config)));
    assert.equal(saved.variants[0].userContext, event);
    assert.deepEqual(saved.variants[0].contextSources.filter(id => id !== "custom"), originalSources);
  }
});
test("each editor invalidates a preview when context changes, without the advanced source/guideline UI", () => {
  for (const path of ["manual-email/ManualEmailStep.tsx", "phone-call/PhoneCallStep.tsx", "linkedin-connection/LinkedInConnectionFields.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /AdditionalMessageContext/);
    assert.match(source, /set\(\{ userContext, preview: undefined \}\)/);
    assert.doesNotMatch(source, /Add guideline|Inspect enabled HQ sources|Inspect available sources/);
  }
});
