---
name: Buying Center Role identity
description: The tradeoff behind Role-backed Buying Center department selections and their rename behavior.
---

Buying Center seat criteria persist selected Role names in the existing department-name arrays, rather than numeric Role IDs. Existing saved department selections remain readable, and contacts with assigned Roles use those Roles as the canonical match; unassigned contacts can still match their legacy department text.

**Why:** HQ profiles already persist strings, and replacing them with IDs would make old saved configurations unusable without a migration. Matching assigned Roles also allows Investment Advisor contacts with no department text to fill the selected seat.

**How to apply:** If Role renaming or duplicate Role names become supported, migrate saved HQ seat selections or add a stable ID field before changing Role names. Do not assume the contact's department field is populated when they have an assigned Role.

Selecting every available seniority level in a Buying Center seat means no seniority restriction, including contacts with an unrecorded seniority. A partial seniority selection remains a real restriction. The HQ qualifying-record preview and the Multi-Threading seat matcher must apply the same rule.

**Why:** Contacts can have a valid assigned Role while lacking any seniority value; treating "all levels" as a strict list hides those valid Role matches.

**How to apply:** Keep the preview query and live seat matching aligned whenever seniority options or matching logic change. Do not conflate a missing seniority with a known level when only some levels are selected.