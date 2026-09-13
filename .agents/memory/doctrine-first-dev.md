---
name: Doctrine-first development
description: Any Messaging or Scoring code change must include a same-turn doc update. The Scraping Torah is not actively maintained.
---

# Doctrine-First Development

**Rule:** Any code change that touches Messaging or Scoring logic must include a doc update in the same turn — before the response is delivered to the user. The doc update is part of the definition of done, not a follow-up task.

- Messaging changes → update `docs/messaging-quran.md` (correct Surah)
- Scoring changes → update `docs/scoring-bible.md` (correct Book)
- Scraping changes → `docs/scraping-torah.md` is NOT actively maintained; skip unless the user explicitly asks

**Why:** The user is building three living doctrine documents (Torah / Bible / Quran) that govern how the platform scrapes, scores, and messages. They will be monitored and revised over time. Code that isn't reflected in doctrine creates silent drift between what the platform does and what the doctrine says it should do.

**How to apply:** After every Messaging or Scoring code change, identify the affected Surah(s) or Book(s), add or update the relevant section, and confirm the update in the response. Do not propose a follow-up task for it — do it inline.

**Relationship-message rule:** Colleague and Counterpart messaging must be grounded in dynamically resolved source-contact metadata and use different, non-pressuring segue questions. The doctrine must describe both the attribution and segue behavior.

**Why:** Materialized relationship rows can lose the source person's identity or become stale while profile routes resolve the live peer insight. Keeping the prompt and doctrine explicit prevents anonymous or manipulative peer framing.

**How to apply:** When changing Colleague or Counterpart message generation, update both the relationship-insight context used by message/chat prompts and Surah 3.6–3.7 in `docs/messaging-quran.md`.
