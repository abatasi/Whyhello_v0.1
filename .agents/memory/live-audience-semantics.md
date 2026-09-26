---
name: Live audience semantics
description: Explicit per-user live Buying Center and Target Market selection versus editor/view selection
---

Only an explicitly chosen, saved Buying Center and Target Market are live for cross-platform personalization. An editor tab or a temporary Multi-threading view selection must not silently designate an object as live. If no object is chosen, or the chosen object is removed, personalized badges and live-market buyer rankings remain absent rather than falling back to the first draft.

**Why:** The user wants to maintain multiple drafts while controlling which single configuration informs the rest of the platform. Automatic fallbacks can silently change contact-seat labels and company targeting when a draft is created, opened, or deleted.

**How to apply:** Keep live selection scoped to the signed-in user's server profile. Any feature that claims to use the live audience should resolve the saved selection and verify the target still exists before matching; avoid using tab/view state or stale browser storage as authority.