---
name: Playbooks design direction
description: User's intended visual and interaction direction for the Playbooks module
---

Playbooks should be a dense, table-first operational interface for daily B2B sales work, not a decorative dashboard. The user's brief calls for warm near-black surfaces, compact but legible typography, thin dividers, and progressive disclosure through menus and contextual controls. Use the application's existing dark-mode primary color for buttons, toggles, and accents instead of the brief's original lime/yellow.

**Why:** The user supplied a comprehensive Playbooks design brief emphasizing mature enterprise SaaS, information density, and practical table interactions, then requested replacing yellow with an existing dark-mode button/toggle color.

**How to apply:** Keep metrics and names easy to scan; allow horizontal table scrolling rather than shrinking text. Preserve stationary, subtle hover feedback and clear focus states. Do not add giant cards, gradients, glass effects, decorative illustrations, or excessive whitespace.

The brief's example labels say "Sequences," but the requested product module is Playbooks. Keep the work scoped to Playbooks and retain its terminology unless the user requests a broader rename or app-wide redesign.

**Why:** The user asked to design the Playbooks module, not replace the application's branding or every module.

**How to apply:** Treat the sample sequence-management interface as the interaction and visual reference, while preserving Whyhello's module identity and existing app behavior when integrating an approved design.

Wrap the Playbooks module in the existing master sidebar and master topbar, rather than presenting it as a standalone page.

**Why:** The user explicitly requested that the module be wrapped around the master sidebar and master topbar.

**How to apply:** Reuse the actual master navigation components and their responsive behavior in Playbooks previews and integrations; do not invent a replacement application shell.

The rest of the platform's table styling supersedes the original Playbooks brief's table-specific fonts, sizes, text colors, and related presentation.

**Why:** The user explicitly requested platform consistency for table styling and approved the resulting design with the existing dark-mode primary accent and master navigation shell.

**How to apply:** Use the existing Directory/shared table conventions and theme tokens rather than introducing bespoke typography or text palettes for Playbooks. Preserve its table controls and behavior.

Graduating the approved interface must preserve real records and the multi-threaded builder, not introduce the prototype's example people, playbooks or performance figures.

**Why:** The approval was for integration into the existing Whyhello product. The prototype demonstrated controls with local example data; that data is not production content.

**How to apply:** Keep builder workflows and existing templates intact. Use actual enrollment and sent-message counts; do not infer delivery or replies from a successful send. Label unrecorded outcomes unavailable. Create new workflows and duplicates as drafts; duplicates should not enroll or attach existing contacts automatically.