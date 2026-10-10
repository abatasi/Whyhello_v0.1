---
name: HQ voice personas
description: User scope and activation decisions for reusable named HQ voices.
---

HQ Voice & Tone must support multiple named, saved personas.

**Why:** The user explicitly requested that users can build, define, name, and save multiple personas.

**How to apply:** Preserve existing voice settings when introducing persona management, and keep each persona's definition and summary account-owned.

Editing a persona is separate from choosing the voice messaging uses.

**Why:** Explicit activation avoids changing outbound messaging style merely because a seller is working on another persona.

**How to apply:** Require an explicit HQ activation action for the default voice. Output-level choices may use another persona without activating it globally. Show saved persona names or the compact legacy “HQ voice” label, never serialized parameters.

Saved personas must be options wherever the user chooses a writing voice for an output, with the same design elements as generic tone options.

**Why:** The user explicitly requested persona options throughout output creation and the same design as generic tones.

**How to apply:** Include all AI-written outreach configurations and contact chat, not just Single Message. Append an **HQ** marker to saved-persona badges so their source is distinguishable from generic tones, as the user requested. Use account-owned IDs; generic tones and named persona choices are mutually exclusive. A missing persona must not silently switch to a different voice.

When defining tone throughout the app, default to defined HQ voice options over generic options.

**Why:** The user explicitly requested this app-wide default and repeated that HQ-generated voices must be the first options presented.

**How to apply:** Prefer the active saved HQ persona, then the first defined persona, with generic tones as the no-persona fallback. Present named HQ voices before generic presets, with that preferred default first and remaining personas in saved order. Preserve explicit user choices and existing saved configurations; defaulting an output must not activate a persona globally.

Single Message and Playbook message generation must not offer a generic **HQ voice** option; their HQ options must be defined saved personas.

**Why:** The user removed the generic HQ voice shortcut from Single Message, then requested the same removal in Playbooks.

**How to apply:** Keep generic tone presets and named persona badges with the HQ marker. With no saved personas, show no HQ choice. Playbook Assisted and Prompt flows show short descriptions for selected generic tones, matching Single Message for shared presets. Preserve old saved inheritance without exposing it as a new selectable option or silently changing its output voice.

Output-generation flows must repeat the selected HQ persona's saved short Voice Profile description, including Single Message and Playbook messages.

**Why:** The user explicitly requested the HQ short description as a reminder of the general tone that will be used; Single Message also needs brief generic-tone descriptions.

**How to apply:** Repeat the selected persona's exact saved description below the tone options, including manual edits, not another persona's description or a new AI summary. Update it on selection changes, avoid duplicate reminders, and explicitly identify missing descriptions. Do not replace the concise persona badges with a wall of voice parameters.

Saved HQ descriptions must refresh downstream voice metadata after successful HQ writes, and newly exposed metadata must not reuse older name-only caches.

**Why:** A correctly saved description was reported missing in Playbooks because its context could retain an earlier response; HQ saves invalidated buyer/contact data but not voice consumers.

**How to apply:** Invalidate only the signed-in account's HQ and Playbook metadata after confirmed saves. Reload current metadata on reopening editors and distinguish changed response shapes in cache keys. Never regenerate indexing or a summary merely to refresh its display.

Do not automatically migrate unscoped legacy browser voice summaries to a persona.

**Why:** Their account ownership cannot be established; importing them risks attaching another seller's text to the current account.

**How to apply:** Preserve the legacy voice definition, while saving new summaries independently per persona. Late generation must not overwrite manual summary edits or newer voice inputs.
