---
name: Insight uniqueness and publishing
description: Why contact insight URL uniqueness is handled by application checks rather than a production index
---

Do not reintroduce a database-level unique constraint on contact insight URLs without first addressing existing production duplicates through an approved data-maintenance process. Keep best-effort duplicate checks in application import paths meanwhile.

**Why:** Production contained repeated URLs within contacts, so publish validation could not add the development unique index. The user explicitly prioritized successful publishing over database-enforced deduplication and approved removing the development index. A new constraint would recreate the same migration failure until production data is cleaned.

**How to apply:** Before proposing schema-level uniqueness again, inspect production read-only for duplicate groups, plan safe preservation of attached relevance scores and quotes, and obtain authorization for production cleanup through supported channels. Do not add deployment-time DDL.