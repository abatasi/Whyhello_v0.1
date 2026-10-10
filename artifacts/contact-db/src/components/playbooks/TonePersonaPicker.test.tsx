import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TonePersonaPicker } from "./TonePersonaPicker";
import type { ManualEmailContext } from "./manual-email-model";

const context: ManualEmailContext = {
  contacts: [], contextSources: [], aiAvailable: true, mailboxes: [], templates: [],
  voice: "owned voice", voicePersonas: [{ id: "a", name: "Advisor" }, { id: "b", name: "Builder" }],
  activeVoicePersonaId: "a",
};
const render = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(TonePersonaPicker, {
  tones: ["Professional", "Friendly"], tone: "Professional", context,
  inheritHqTone: false, disabled: false,
  onTone: () => {}, onPersona: () => {}, onHqVoice: () => {},
  ...extra,
}));
test("saved personas and generic tones share the same accessible chip styling", () => {
  const html = render();
  assert.match(html, />Professional<\/button>/);
  assert.match(html, />Advisor<\/span>/);
  assert.match(html, /title="Saved HQ voice: Builder"/);
  assert.match(html, /aria-label="Advisor — HQ persona"/);
  assert.equal((html.match(/data-voice-source="hq"/g) ?? []).length, 2);
  assert.doesNotMatch(html.match(/<button[^>]*>Professional<\/button>/)?.[0] ?? "", /data-voice-source/);
  assert.equal((html.match(/inline-flex min-w-0 max-w-full/g) ?? []).length, 5);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
});
test("pinned persona overrides legacy inheritance without two selected choices", () => {
  const html = render({ voicePersonaId: "b", inheritHqTone: true });
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(html, /aria-pressed="true" data-testid="button-voice-persona-b"/);
});
test("loading is not misreported as deletion; actual missing selection is explicit", () => {
  assert.doesNotMatch(render({ context: undefined, voicePersonaId: "gone", loading: true }), /no longer available/);
  assert.doesNotMatch(render({ voicePersonaId: "gone", error: true }), /no longer available/);
  assert.match(render({ voicePersonaId: "gone" }), /no longer available/);
});
test("Single Message offers defined HQ personas without a generic HQ voice option", () => {
  const html = render({ showHqVoice: false, onHqVoice: undefined, voicePersonaId: "b" });
  assert.doesNotMatch(html, /button-hq-voice|>HQ voice<\/button>/);
  assert.match(html, /aria-label="Builder — HQ persona"/);
  assert.equal((html.match(/data-voice-source="hq"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
});
test("without defined personas Single Message keeps generic tones and no HQ fallback", () => {
  const html = render({ showHqVoice: false, context: { ...context, voicePersonas: [], activeVoicePersonaId: null } });
  assert.match(html, />Professional<\/button>/);
  assert.doesNotMatch(html, /button-hq-voice|HQ voice remains available|data-voice-source="hq"/);
  assert.match(html, /No saved HQ personas available/);
});
test("new inherited Playbook choices select the active named HQ voice instead of a generic tone", () => {
  const html = render({ inheritHqTone: true });
  assert.match(html, /aria-pressed="true" data-testid="button-voice-persona-a"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
});
test("without any HQ voice the inherited default displays the generic fallback", () => {
  const html = render({ inheritHqTone: true, context: { ...context, voice: "", voicePersonas: [], activeVoicePersonaId: null } });
  assert.match(html, /aria-pressed="true"[^>]*>Professional<\/button>/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
});
