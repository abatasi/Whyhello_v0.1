import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InsightCategorySelect, INSIGHT_CATEGORY_OPTIONS, LEGACY_INSIGHT_CATEGORY_OPTIONS } from "./InsightCategorySelect";

test("each saved category displays its corresponding icon in a page-styled combobox", () => {
  assert.deepEqual(INSIGHT_CATEGORY_OPTIONS.map(option => option.value), ["personal", "company", "industry", "role", "colleagues", "counterparts"]);
  for (const option of INSIGHT_CATEGORY_OPTIONS) {
    const html = renderToStaticMarkup(createElement(InsightCategorySelect, { value: option.value, onValueChange: () => {} }));
    assert.match(html, /<button[^>]*role="combobox"/);
    assert.ok(html.includes(`data-insight-category-icon="${option.value}"`));
    assert.ok(html.includes(option.label));
    assert.ok(html.includes("bg-background"));
    assert.ok(html.includes('aria-label="Insight category"'));
  }
  assert.equal(new Set(INSIGHT_CATEGORY_OPTIONS.map(option => option.icon)).size, 6);
});

test("read-only steps cannot change the category and retain the label association", () => {
  const html = renderToStaticMarkup(createElement(InsightCategorySelect, {
    id: "insight-category-variant", value: "company", disabled: true, onValueChange: () => {},
  }));
  assert.match(html, /<button[^>]*disabled=""/);
  assert.ok(html.includes('id="insight-category-variant"'));
  assert.ok(html.includes('data-insight-category-icon="company"'));
});

test("older Playbook editors preserve Automatic and their original saved category values", () => {
  assert.deepEqual(LEGACY_INSIGHT_CATEGORY_OPTIONS.map(option => option.value), ["Automatic", "Personal", "Company", "Industry", "Role", "Colleague", "Counterpart"]);
  const html = renderToStaticMarkup(createElement(InsightCategorySelect, {
    value: "Automatic", onValueChange: () => {}, options: LEGACY_INSIGHT_CATEGORY_OPTIONS,
  }));
  assert.ok(html.includes('data-insight-category-icon="Automatic"'));
});
