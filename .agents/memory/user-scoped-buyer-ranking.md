---
name: User-scoped buyer ranking
description: Defines the ownership and evidence rules for ranking companies as a user’s next buyers.
---

“Your next buyer” rankings must be computed from the authenticated user’s HQ target markets. Never derive a personalized buyer ranking from the global contact meta-score table.

**Why:** HQ profiles are user-owned, while existing contact meta scores are not user-keyed. Reusing those global scores can present one user’s scoring context as another user’s company fit.

**How to apply:** Score company industry, size, and location against each configured target market, use the best per-market match, and show matched-versus-configured criteria so a one-dimension match is not mistaken for broad fit.