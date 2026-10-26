---
name: Master-owned HQ configurations
description: Permission and live-context boundaries for multiple named HQs.
---

Only the existing master identity may maintain multiple distinct HQs. Exactly one is explicitly live for that account; editing or selecting another HQ does not activate it. Other users keep their existing single HQ.

**Why:** The user requested multiple HQs for their master access only, with the live HQ informing messaging, scoring and the rest of the platform.

**How to apply:** Keep configuration documents independent. Preserve the existing HQ on first use. Server-side authorization must use the trusted, verified primary identity, not a submitted role or email. Scope even live-editor saves to a configuration ID so a delayed save cannot overwrite a newly activated HQ, particularly when two HQs began as identical copies.

The existing per-account HQ document remains the live projection for downstream consumers; archive configuration data separately.

**Why:** Existing messaging/scoring/audience readers use that document directly. Embedding inactive archives in it would contaminate prompts, fingerprints and context. Legacy audience/profile writers may update the live projection without updating its archived snapshot.

**How to apply:** Activation must lock the workspace, snapshot the authoritative previous live document, then atomically publish the selected saved configuration. Inactive saves must not alter live content, global browser caches or index freshness. Refresh client context and competitor badges on explicit activation. Update the Messaging Quran and Scoring Bible when changing this contract.
