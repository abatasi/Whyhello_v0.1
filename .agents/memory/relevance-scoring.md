---
name: Relevance Scoring System
description: Architecture for scoring outside-in signals against HQ inside-out signals — table, API routes, client hooks, and UI.
---

## What it is
Each outside-in signal (personal/company/industry/role/colleague/counterpart) gets a Relevance score (0–100) computed by AI against the user's HQ/DNA profile. Scores persist in `insight_relevance_scores` table and surface in the Insights panel.

## DB table
`insight_relevance_scores`: contact_id, signal_type, signal_id, score (int 0-100), description (text), matched_hq_signals (JSON text), computed_at.

## API routes (mounted at `/contacts/:contactId/insights`)
- `GET /relevance` — returns stored scores for a contact
- `POST /relevance/score` — fetches all 6 signal categories + HQ profile, calls gpt-5-mini, persists results, returns scored list. Deletes old scores before inserting new ones.

**Why:** Both routes are on the same mount path as `insightsRouter` (which only handles `GET /`) — no conflict.

**AI prompt constraint:** Never set max_tokens or max_completion_tokens with gpt-5-mini (produces empty output).

## Client hooks (lib/api-client-react/src/relevance.ts)
- `useGetInsightRelevance(contactId)` — GET
- `useTriggerInsightRelevance()` — mutation POST

## UI (ContactProfile.tsx)
- `InsightRelevanceBar` component: "Score Relevance" button + "Sort: Relevance" toggle (visible after scoring)
- `RelevanceBadge` component: colored score pill (green ≥75, amber ≥50, orange ≥25, slate <25) with tooltip showing description
- `relevanceMap`: Map<"type-id", InsightRelevanceScore> built with useMemo
- `sortedCategoryData`: sorts items by score desc within each category when sortByRelevance=true
- Compact list mode: xs badge shown after source line
- Expanded card mode: full description block above action buttons

## Faisal Karmali (test contact)
- Contact id = 3673, CIBC Wood Gundy (company id = 29)
- Seeded via `seed-faisal.ts` which runs after seedProductionContactInsightsIfNeeded
- Has: 5 personal insights (pre-existing), 3 company insights (CIBC), 2 colleague insights, 2 counterpart insights, + shared Wealth Management industry + Investment Advisor role insights
