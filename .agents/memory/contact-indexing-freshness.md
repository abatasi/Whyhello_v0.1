---
name: Contact indexing freshness
description: User-defined reuse policy and provenance for contact insight scoring and quotables.
---

Returning to a contact profile must reuse its latest indexed insights, scores and quotables unless HQ changed or the last indexing is over seven days old.

**Why:** The user reported too much automatic refreshing when returning to profiles and explicitly specified the seven-day window.

**How to apply:** Track successful completion, including empty results, rather than treating empty/loading arrays as missing indexing. Use account-owned HQ-content fingerprints rather than save timestamps; no-op saves must not invalidate results. Extract before scoring once. Preserve explicit manual refresh and successful snapshots when a refresh fails.

Legacy globally stored results cannot prove which account's HQ produced them.

**Why:** Treating those records as an owned fresh index could silently reuse another account's HQ alignment.

**How to apply:** Keep legacy output visible while one indexing pass establishes owned provenance; do not invent an HQ fingerprint for old unscoped results.
