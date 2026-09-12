---
name: Quotables extraction pipeline
description: How LinkedIn Quotables are extracted, stored, and injected into message generation
---

## Rule
Quotables are sourced by fetching LinkedIn post bodies live from the public URL at extraction time. Never use the stored `description` field — it is consistently `"N/A"` for LinkedIn signals.

**Why:** The `description` column in `contact_insights` is not populated for LinkedIn signals during ingestion. The actual post body is available on LinkedIn's public page via `og:description` meta tag and JSON-LD `articleBody` field — no auth required.

**How to apply:** The LinkedIn fetcher prefers JSON-LD `articleBody` (untruncated) over `og:description` (sometimes cut off), and also reads public JSON-LD comments when available.

Nested third-party quotations must not be attributed to the contact. Validate model output against the fetched body and reject any exact match inside a quoted passage; a fresh extraction with no valid results must also clear stale quote rows.

**Why:** LinkedIn posts can contain testimonials or transcripts that are verbatim in the post body but were written by someone else. Exact substring matching alone cannot establish authorship.

**How to apply:** Keep deterministic quote validation after model extraction; use the model only to select among eligible text, never as the sole authorship check.

Personal LinkedIn signals can be contact-authored posts or posts the contact merely engaged with. Classify authorship from the LinkedIn author/profile slug; for third-party posts, accept only the contact's visible comment or a direct quote explicitly attributed to them.

**Why:** Engagement signals expose third-party posts alongside the contact's own activity, so treating every personal LinkedIn body as the contact's words creates false attribution.

**How to apply:** Pass only comments authored by the contact into the extraction prompt and validate comment quotes against the comment text; omit third-party prose when no authorship evidence is present.

## Current scope
Only `linkedin` / `linkedin_post` media types are scanned. Other authored types (blog_post, newsletter, podcast) are intentionally excluded until LinkedIn quality is validated (Task #5 covers expansion).

## Source citation in generation
Each quote in the `quotesSection` prompt block includes a `Source: LinkedIn` label. The HOOK starters in `outreach-jobs.ts` instruct the AI to always name the platform explicitly:
- "Came across your post on LinkedIn re: [topic]: '[quote]'…"

Both the `quotesBlock` instructions and the LAYER 1 HOOK quote starters in the system prompt enforce this.

## Signal source map
`signalSourceMap` in `runGeneration` maps signalId → platform label by joining the loaded signal arrays against `signalSourceLabel()`. Covers personal, colleague, counterpart, company, industry, role arrays.

## Dev userId bypass
`X-Dev-User-Id` header on POST `/contacts/:id/outreach-jobs` injects a userId for unauthenticated dev/test calls. Gated on `NODE_ENV !== "production"`. Known userId for Richardson Wealth profile: `56015584`.

## Panel location
`QuotablesCarousel` lives at the bottom of the **Outreach panel** (right sidebar), not the Insights sidebar. It is minimizable and shows one quote at a time with ← / → navigation. Only mounts when quotes exist or extraction is pending.
