---
name: User-scoped buyer ranking
description: Defines the ownership and evidence rules for ranking companies as a user’s next buyers.
---

“Your next buyer” rankings must be computed from the authenticated user's explicitly live HQ Target Market. Never derive a personalized buyer ranking from the global contact meta-score table or from an arbitrary draft market.

**Why:** HQ profiles are user-owned, while existing contact meta scores are not user-keyed. Reusing those global scores can present one user’s scoring context as another user’s company fit.

**How to apply:** If no live Target Market is selected, show no personalized buyer rankings. Otherwise score company industry, size, and location against that market alone, and show matched-versus-configured criteria so a one-dimension match is not mistaken for broad fit.