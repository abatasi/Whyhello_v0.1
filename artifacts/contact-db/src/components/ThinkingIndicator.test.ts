import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThinkingIndicator } from "./ThinkingIndicator";

test("renders the original five colored segments with accessible thinking status", () => {
  const html = renderToStaticMarkup(createElement(ThinkingIndicator));
  assert.match(html, /viewBox="0 0 320 205"/);
  assert.equal((html.match(/<path /g) ?? []).length, 5);
  for (const color of ["#76D84F", "#22BED2", "#19B9D5", "#F52535"]) assert.ok(html.includes(color));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-label="Whyhello is thinking"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /focusable="false"/);
});

test("supports compact and panel sizes and task-specific labels", () => {
  const html = renderToStaticMarkup(createElement(ThinkingIndicator, { className: "h-10 w-16", label: "Generating email preview" }));
  assert.match(html, /h-10 w-16/);
  assert.doesNotMatch(html, /\bh-5\b|\bw-8\b/);
  assert.match(html, /aria-label="Generating email preview"/);
});

test("decorative button indicators do not duplicate the visible accessible label", () => {
  const html = renderToStaticMarkup(createElement(ThinkingIndicator, { decorative: true }));
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /role="status"|aria-label=|aria-live=/);
});

test("preserves the breathing timing and honors reduced motion", () => {
  const css = readFileSync(new URL("./ThinkingIndicator.css", import.meta.url), "utf8");
  assert.match(css, /1\.8s cubic-bezier/);
  for (const delay of [".22s", ".44s", ".66s", ".88s"]) assert.ok(css.includes(delay));
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none/);
  assert.match(css, /opacity: 1;\s+filter: none;/);
  const appCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");
  assert.match(appCss, /@import "\.\/components\/ThinkingIndicator\.css"/);
});
