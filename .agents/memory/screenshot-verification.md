---
name: Screenshot interaction verification
description: A screenshot alone does not confirm an asynchronous UI smoke check completed.
---

A screenshot can arrive before an inline asynchronous UI check finishes. Require the check's explicit completion log before claiming its interactions passed.

**Why:** A focused-search check initially rendered a correct panel but emitted no completion log; a shorter equivalent sequence confirmed selection, dismissal, focus restoration and reopening.

**How to apply:** Inspect the capture's browser logs for completion and errors. Use a suitable browser test for longer critical journeys; do not interpret a visible screen as proof that later scripted steps ran.
