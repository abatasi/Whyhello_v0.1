---
name: Relevance Scoring System
description: Outside-in signal scoring pipeline — DB tables, API routes, client hooks, and UI components. Includes meta score.
---

## Tables
- `insight_relevance_scores` — one row per (contactId, signalType, signalId). Signal-level scores 0–100.
- `contact_meta_scores` — one row per contactId (unique). Aggregate meta score across Personal/Company/Industry/Role.

## API routes (artifacts/api-server/src/routes/relevance.ts)
- `GET  /api/contacts/:contactId/insights/relevance` — returns all stored signal scores
- `POST /api/contacts/:contactId/insights/relevance/score` — AI scores all signals, persists, then upserts meta score
- `GET  /api/contacts/:contactId/insights/relevance/meta` — returns stored ContactMetaScore or null
- `GET  /api/contacts/:contactId/insights/relevance/top-contact` — returns highest avg-scored other contact

## Meta Score formula
```
metaScore = round((personalBest + companyBest + industryBest + roleBest) / 4)
```
- Only core four categories count (not colleague/counterpart)
- Missing categories → 0
- Computed and upserted inside the POST /score handler — never computed on demand

## Client hooks (lib/api-client-react/src/relevance.ts)
- `useGetInsightRelevance(contactId)` → InsightRelevanceScore[]
- `useGetContactMetaScore(contactId)` → ContactMetaScore | null
- `useGetTopRelevantContact(contactId, enabled)` → TopRelevantContact | null
- `useTriggerInsightRelevance()` → mutation; on success invalidates both relevance and meta queryKeys

## IMPORTANT: dist types must be kept in sync
The package exports from `./src/index.ts` but has a stale `dist/` folder.
TypeScript in the frontend resolves to `dist/relevance.d.ts` (not src).
Any new types/hooks added to `src/relevance.ts` must also be manually added to `dist/relevance.d.ts`.

## UI
- `RelevanceBadge` — signal-level score badge (green/amber/orange/slate by tier)
- `MetaScoreBadge` — contact-level meta score badge (violet/blue/slate); shown in profile header next to seniority badge; tooltip shows per-category breakdown bars
- Both in ContactProfile.tsx

## Doctrine
- Changes to scoring logic must update `docs/scoring-bible.md` in the same turn (Libro Octavo covers meta score)

## LinkedIn engagement proximity
- Personal LinkedIn signals authored by someone other than the contact are scored as lower-confidence engagement signals.
- Without a substantive contact comment or explicit direct quote, engagement signals are capped in the lower range; visible social comments such as congratulations are not actionable evidence.
- A third-party post with substantive contact-authored evidence can recover some score, but remains below a comparable contact-authored post.
- Stored relevance scores are fresh for ten minutes; both client and API enforce this before starting another scoring run.
