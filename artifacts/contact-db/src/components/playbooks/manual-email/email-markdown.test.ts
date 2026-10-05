import assert from "node:assert/strict";
import test from "node:test";
import { emailMarkdownToHtml } from "./email-markdown";

test("email Markdown renders paragraphs, bold, and inspectable safe source links", () => {
  const html = emailMarkdownToHtml("**Outcome**\n\nA [report](https://example.com/report).");
  assert.match(html, /<strong>Outcome<\/strong>/);
  assert.match(html, /href="https:\/\/example.com\/report"/);
  assert.equal((html.match(/<p /g) ?? []).length, 2);
});

test("untrusted scripts, unsafe schemes and URL attribute injection remain inert", () => {
  const html = emailMarkdownToHtml('<script>alert(1)</script> [no](javascript:alert) [x](https://example.com/" onmouseover="alert)');
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('" onmouseover="'));
  assert.match(html, /&quot; onmouseover=&quot;/);
});