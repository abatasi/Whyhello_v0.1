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
- LinkedIn reshares are not inherently weaker; score the underlying shared content for HQ relevance and actionability, without treating the reshare itself as a penalty or relevance boost.
- Personal video interviews, talks, and features with contact participation are high-proximity evidence; an explicitly named contact in the title/description gets an 85-point floor before freshness, while video format alone is not a boost.
- Direct quotable bonuses are content-quality gated: weak/partial HQ matches receive only a small lift, while the full bonus requires a strong underlying-content score.
- Freshness uses the source publication date, not platform ingestion time: LinkedIn live `datePublished` fills missing stored dates, with full value through one year, then a 20-percentage-point annual decay and a 0.20 floor.
- Ordinary final signal scores have a 10-point floor after proximity and freshness; only explicit extraordinary negative evidence may produce 0–9.
- Stored relevance scores are fresh for ten minutes; automatic client and API requests enforce this, while an explicit user-triggered refresh can bypass the window.
