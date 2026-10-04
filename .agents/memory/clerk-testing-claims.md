---
name: Clerk browser testing claims
description: Avoid an unsupported custom-claims prerequisite when verifying signed-in Playbooks.
---

Do not require a custom session-claims override as a prerequisite for routine Clerk browser tests. Use the supported programmatic test login and verify that normal authenticated API access works first.

**Why:** The testing instructions mention overriding claims, but the supported browser-test login helper accepts identity, TTL, and redirect arguments—not custom claims. A tester stopped before exercising the app solely because an unnecessary override had been requested.

**How to apply:** Inspect the current ownership resolver before specifying special claims. When it falls back to Clerk's authenticated user identity, the normal test session is sufficient. Keep ownership checks enabled; never substitute an authentication bypass. Recheck the live helper interface if a future app genuinely requires custom claims.