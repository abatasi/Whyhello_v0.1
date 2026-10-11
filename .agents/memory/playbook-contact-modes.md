---
name: Playbook contact modes
description: User-defined Single-Contact and company-based Multi-Contact Playbook semantics.
---

Single-Contact Playbooks retain the existing user flow. Multi-Contact Playbooks address multiple contacts within one company, with each contact corresponding to a Buying Center seat chosen by the user. Business Champion is the default/lead contact.

Each Buying Center seat has its own independent sequence, including its steps, timing and messages; do not implement shared steps with only seat-specific message variants.

**Why:** The user defined these as two dimensions of the Playbooks product, not separate applications, and explicitly chose separate sequences per seat.

**How to apply:** Offer Single versus Multi in the Create Playbook wizard after the user chooses how to build. In the sequence builder, put Buying Center seat tabs in the same row as the step count and saved/unsaved status. Preserve existing Single-Contact behavior and autosave guarantees.
