---
name: Screenshot interaction verification
description: Verify asynchronous completion and painted control visibility, not just successful click assertions.
---

A screenshot can arrive before an inline asynchronous UI check finishes. Require the check's explicit completion log before claiming its interactions passed.

**Why:** A focused-search check initially rendered a correct panel but emitted no completion log; a shorter equivalent sequence confirmed selection, dismissal, focus restoration and reopening.

**How to apply:** Inspect the capture's browser logs for completion and errors. Use a suitable browser test for longer critical journeys; do not interpret a visible screen as proof that later scripted steps ran.

For horizontally scrolling controls, successful clicks do not prove the selected label is visible or that fixed sibling controls leave enough usable space.

**Why:** Mobile seat switches passed click assertions while the selected label remained a narrow sliver beside a fixed contact control.

**How to apply:** Check the mobile screenshot and clipping boundaries as well as click results. Keep the selected tab visible within its own scroll container; do not scroll the entire page during auto-save.
