---
name: Playbooks design direction
description: User's intended visual and interaction direction for the Playbooks module
---

Do not show separate Personalization snippets or rationale fields in Playbook message previews.

**Why:** The user said the snippet is unnecessary and does not add to this view.

**How to apply:** Keep preview attention on the actual deliverable. Preserve recipient-specific message content and saved generation metadata; this is a display change, not a change to personalization logic.

Playbooks should be a dense, table-first operational interface for daily B2B sales work, not a decorative dashboard. Use compact but legible typography, thin dividers, and progressive disclosure through menus and contextual controls. Use the application's existing dark-mode primary color for buttons, toggles, and accents instead of the brief's original lime/yellow.

**Why:** The user supplied a comprehensive Playbooks design brief emphasizing mature enterprise SaaS, information density, and practical table interactions, then requested replacing yellow with an existing dark-mode button/toggle color.

**How to apply:** Keep metrics and names easy to scan; allow horizontal table scrolling rather than shrinking text. Preserve stationary, subtle hover feedback and clear focus states. Do not add giant cards, gradients, glass effects, decorative illustrations, or excessive whitespace.

Playbook Insight category pick lists must use page-styled menus with a corresponding icon for each category, not browser/system-rendered option popups.

**Why:** The user explicitly requested styling consistent with the overall page and category-specific icons.

**How to apply:** Reuse themed accessible menu components for the options and show the selected category's icon too. Preserve saved category values and evidence-selection behavior.

The Playbooks page background must match the master sidebar/topbar, not use the prototype's separate warm near-black page color.

**Why:** The user explicitly requested matching the Playbooks background to the sidebar/topbar after integration.

**How to apply:** Use the shared application background theme token instead of a hardcoded module-specific page fill.

The brief's example labels say "Sequences," but the requested product module is Playbooks. Keep the work scoped to Playbooks and retain its terminology unless the user requests a broader rename or app-wide redesign.

**Why:** The user asked to design the Playbooks module, not replace the application's branding or every module.

**How to apply:** Treat the sample sequence-management interface as the interaction and visual reference, while preserving Whyhello's module identity and existing app behavior when integrating an approved design.

Wrap the Playbooks module in the existing master sidebar and master topbar, rather than presenting it as a standalone page.

**Why:** The user explicitly requested that the module be wrapped around the master sidebar and master topbar.

**How to apply:** Reuse the actual master navigation components and their responsive behavior in Playbooks previews and integrations; do not invent a replacement application shell.

The rest of the platform's table styling supersedes the original Playbooks brief's table-specific fonts, sizes, text colors, and related presentation.

**Why:** The user explicitly requested platform consistency for table styling and approved the resulting design with the existing dark-mode primary accent and master navigation shell.

**How to apply:** Use the existing Directory/shared table conventions and theme tokens rather than introducing bespoke typography or text palettes for Playbooks. Preserve its table controls and behavior.

Graduating the approved interface must preserve real records, not introduce the prototype's example people, playbooks or performance figures.

**Why:** The approval was for integration into the existing Whyhello product. The prototype demonstrated controls with local example data; that data is not production content.

**How to apply:** Keep existing saved workflows and templates intact. The user subsequently requested redefining and replacing the Build from Scratch process; that authorizes a new creation experience, not overwriting existing records. Use actual enrollment and sent-message counts; do not infer delivery or replies from a successful send. Label unrecorded outcomes unavailable. Create new workflows and duplicates as drafts; duplicates should not enroll or attach existing contacts automatically.

Builder creation-flow briefs define page structure, states, and interactions, not a new visual design system. Do not redefine background/text/accent colors, fonts, global button or border styling, or the overall theme.

**Why:** The user's empty-state brief explicitly says the application's visual design system is already established and must be reused.

**How to apply:** Implement subsequent builder flow changes with existing application components and theme tokens. Keep scratch creation separate from preserving saved workflows and template records.

Do not restore the previous building-blocks panel or mind-map presentation. The empty editor should begin directly after the step-count / “Draft changes are saved to this playbook” bar, with its empty-state component centered in the remaining workspace.

**Why:** The user reiterated that the previous playbook creation flow is being replaced and explicitly removed the building-blocks panel, dotted background, zoom functionality, and related canvas controls.

**How to apply:** Subsequent builder work must use a flat, non-mind-map workspace without the legacy palette, graph connectors, minimap, zoom, or extra canvas toolbars. Preserve existing saved data; do not treat earlier instructions to preserve the builder UI as current.

Configured steps belong inline in a vertically connected workflow, with configuration and preview side by side. Do not bring back the temporary Manual Email setup sheet or a separate configuration drawer.

**Why:** The user's configured-step brief defines this as the primary working interface after adding a step, not another intermediate setup flow.

**How to apply:** Extend subsequent step types within that inline workflow while retaining the established visual design system.

Loading a saved inline workflow must not invent graph scaffolding or modify its semantic content.

**Why:** Retired graph hydration inserted a new placeholder on reload and made a saved, unchanged Manual Email workflow appear dirty.

**How to apply:** Apply identical non-mutating restoration to saved and working snapshots; preserve existing records without graph-specific migrations.

Playbook email creation must omit “Five-layer email anatomy,” “Set your AI context,” and “Set your guidelines,” and show an AI-mistakes disclaimer.

**Why:** The user explicitly requested this simplified email creation interface.

**How to apply:** Do not restore these sections when extending the editor. Preserve existing saved configuration and email-generation anatomy; the request removes creation UI, not saved data or generation rules.