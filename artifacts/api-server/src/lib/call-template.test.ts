import { strict as assert } from "node:assert";
import { test } from "node:test";
import { renderCallText } from "./call-template.js";
test("spoken templates merge actual contact fields", () => {
  assert.equal(renderCallText("Hi {{ firstName }}, a question about {{company}}.", { firstName: "Alex", company: "Example" }), "Hi Alex, a question about Example.");
});
test("unknown, unavailable, prototype and malformed fields fail explicitly", () => {
  for (const template of ["{{phone}}", "{{firstName}}", "{{toString}}", "{{bad-token}}", "{{}}", "{{bad"]) {
    assert.throws(() => renderCallText(template, { firstName: "" }), /Template field/);
  }
});