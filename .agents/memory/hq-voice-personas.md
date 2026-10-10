---
name: HQ voice personas
description: User scope and activation decisions for reusable named HQ voices.
---

HQ Voice & Tone must support multiple named, saved personas.

**Why:** The user explicitly requested that users can build, define, name, and save multiple personas.

**How to apply:** Preserve existing voice settings when introducing persona management, and keep each persona's definition and summary account-owned.

Editing a persona is separate from choosing the voice messaging uses.

**Why:** Explicit activation avoids changing outbound messaging style merely because a seller is working on another persona.

**How to apply:** Require an explicit activation action. Keep the compact “HQ voice” label in messaging configuration rather than displaying serialized parameters.

Do not automatically migrate unscoped legacy browser voice summaries to a persona.

**Why:** Their account ownership cannot be established; importing them risks attaching another seller's text to the current account.

**How to apply:** Preserve the legacy voice definition, while saving new summaries independently per persona. Late generation must not overwrite manual summary edits or newer voice inputs.
