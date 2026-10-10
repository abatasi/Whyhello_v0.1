---
name: Reusable email configuration
description: User-defined relationship between Playbook Manual Email and the Single Message composer.
---

Keep core Playbook message controls; replace advanced context-source and guideline editors with a single user-written Additional context field.

**Why:** The user explicitly chose to keep core settings while asking for context such as meeting a recipient cohort at a tradeshow to inform messaging.

**How to apply:** Persist context per variant and include it in AI generation whenever nonblank, independently of legacy custom-source selection. Weave only stated facts into existing anatomy; a meeting is not proof of interest or seller outcomes. Preserve saved settings and literal templates rather than rewriting them automatically.

Manual Email configuration must mimic the parameters and approach already established for constructing a single message. Message anatomy takes its cues from the Messaging Quran. Since Playbooks genericize the message, users specify an insight-category focus rather than choosing seeded individual insights.

**Why:** The user explicitly requested consistency with Single Message rather than a separate generic-email recipe, and category selection rather than recipient-specific insight selection.

**How to apply:** Align reusable email controls and generation with the established messaging doctrine. Resolve real evidence for each recipient within the configured category, preserving seller review and existing saved content.

Show HQ voice as a label in messaging configuration, not a wall of its underlying parameters.

**Why:** The user explicitly said users do not need to see all the voice parameters.

**How to apply:** Keep voice settings available for generation, but do not render their serialized values in step configuration.

When a Playbook insight category is chosen, lead with its highest-scoring usable insight for the recipient and tell users this policy in the editor. “Top-performing” here means stored insight relevance, not measured message engagement.

**Why:** The user explicitly asked to start with the highest-scoring insight within the selected category and document the approach in the Messaging Quran.

**How to apply:** Keep selection recipient- and category-specific; do not let the model choose a weaker lead from an arbitrary recent batch. Make an unscored fallback explicit rather than implying it has a measured score.