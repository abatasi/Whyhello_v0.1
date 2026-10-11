---
name: Playbook step modes
description: Why Manual Email is distinct from automatic send actions, and how Actions differ from Rules.
---

Playbook Configuration should not show the Prompt tab/tag.

**Why:** The user requested “Remove Prompt tag from Configuration.”

**How to apply:** Keep visible choices to Assisted and Template across message step editors. Preserve existing saved Prompt-mode content rather than treating a display change as permission to delete it.

Manual Email is a seller-reviewed email task. AI may prepare its content, but the seller reviews and sends it. It must not silently reuse the legacy automatically sent email action.

**Why:** The user's Add Step brief explicitly distinguishes Automatic Email from Manual Email; confusing them would change who controls sending.

**How to apply:** Keep manual tasks distinct in saved step identity and execution mode. Building or configuring a step must not send email. Validate readiness before activation on both the editor and server.

Actions represent something the seller/system does; Rules control when, whether, or how the next action occurs. Time Delay and Split Path are Rules, even if initially hidden from the action menu.

**Why:** The user wants later step types introduced without redesigning the builder, and may surface Rules separately.

**How to apply:** Use extensible definitions with configuration, validation, category, and execution mode instead of hardcoding every choice into the menu.