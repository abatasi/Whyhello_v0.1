---
name: Clerk browser testing claims
description: Avoid an unsupported custom-claims prerequisite when verifying signed-in Playbooks.
---

Do not require a custom session-claims override as a prerequisite for routine Clerk browser tests. Use the supported programmatic test login and verify that normal authenticated API access works first.

**Why:** The testing instructions mention overriding claims, but the supported browser-test login helper accepts identity, TTL, and redirect arguments—not custom claims. A tester stopped before exercising the app solely because an unnecessary override had been requested.

**How to apply:** Inspect the current ownership resolver before specifying special claims. When it falls back to Clerk's authenticated user identity, the normal test session is sufficient. Keep ownership checks enabled; never substitute an authentication bypass. Recheck the live helper interface if a future app genuinely requires custom claims.

If an earlier test identity cannot be recovered, prefer a fresh isolated programmatic test identity over asking the builder for their own login details. Temporary HQ criteria may be created only for that test identity; existing users' profiles and directory records remain untouched.

**Why:** An earlier test session was lost and its app-side identity metadata could not supply an email; a fresh ordinary test identity successfully signed in without special claims.

**How to apply:** Separate authentication success from actual flow verification. If the browser or provider fails before the changed screen is exercised, report that limitation rather than claiming the protected flow was verified.