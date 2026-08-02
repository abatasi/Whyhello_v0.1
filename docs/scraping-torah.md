# ✡ The Scraping Torah
## Whyhello Scraping Logic — Master Reference

> **בְּרֵאשִׁית** — *In the beginning, there was raw data. And the platform looked upon it, and saw that it needed context.*

> **Status:** Living scripture. The First Pillar. Reflects scraping scope and rules as of August 2026. All changes to scraping logic, signal sources, and extraction rules must be written here before they descend into code.

---

<div align="center">— ✦ —</div>

## פ Parasha Aleph · א
### *The Covenant with Data — Why We Scrape*

Whyhello scrapes the web not to accumulate data, but to find **the one signal** that justifies an outreach. Every scraping decision — what to pull, how fresh it must be, how it is stored — flows from a single covenant:

> **We scrape only what enables a more relevant, more human conversation. We do not harvest. We gather.**

This covenant produces three standing prohibitions:

1. **Thou shalt not store what cannot be used.** A signal that cannot logically appear in a message should not be collected, retained, or indexed.
2. **Thou shalt not fabricate currency.** Stale signals must not be presented as fresh. A signal's age is part of its truth.
3. **Thou shalt not violate proximity.** Data that requires private access, login walls, or deceptive extraction techniques is forbidden, regardless of its potential relevance.

All subsequent laws in this Torah derive from these three.

---

<div align="center">— ✦ —</div>

## פ Parasha Bet · ב
### *The Registry of Sources — Where We Are Permitted to Gather*

The platform may only pull signals from **permitted source categories**. Each category is listed here with its canonical identifier, permitted media types, and the signal category it populates.

### 2.1 Personal Signal Sources

These sources produce signals attributed directly to the contact.

| Source | Canonical `mediaType` | Signal Category | Notes |
|---|---|---|---|
| LinkedIn post (original) | `linkedin` / `linkedin_post` | `personal` | Body fetched live from URL at extraction |
| LinkedIn article | `linkedin_article` | `personal` | Full article text fetched live |
| Podcast appearance | `podcast` | `personal` | Episode description + transcript excerpt |
| Published interview | `interview` | `personal` | Article body text |
| Conference presentation | `presentation` | `personal` | Event abstract or published summary |
| Personal blog post | `blog` | `personal` | Full post text |
| Press mention (quoted) | `press` | `personal` | Excerpt containing direct quote only |
| Award / recognition | `award` | `personal` | Announcement body |

### 2.2 Company Signal Sources

These sources produce signals associated with the contact's employer.

| Source | Canonical `mediaType` | Signal Category | Notes |
|---|---|---|---|
| Company press release | `press_release` | `company` | Full text |
| News article (company subject) | `news` | `company` | Headline + body summary |
| Earnings call / investor material | `earnings` | `company` | Transcript excerpt or summary |
| Job posting (strategic signal) | `job_posting` | `company` | Used to infer growth areas |
| Leadership announcement | `leadership` | `company` | Announcement body |
| Regulatory filing (public) | `regulatory` | `company` | Abstract + key clauses |

### 2.3 Industry Signal Sources

| Source | Canonical `mediaType` | Signal Category | Notes |
|---|---|---|---|
| Industry research report | `research_report` | `industry` | Executive summary + key findings |
| Association publication | `association` | `industry` | Article or report body |
| Regulatory guidance | `regulatory_guidance` | `industry` | Public guidance document |
| Trade press article | `trade_press` | `industry` | Full article text |
| Market data release | `market_data` | `industry` | Statistical release + commentary |

### 2.4 Role Signal Sources

| Source | Canonical `mediaType` | Signal Category | Notes |
|---|---|---|---|
| Role-specific benchmark | `benchmark` | `role` | Report summary + key statistics |
| Professional association guidance | `association` | `role` | Guidance document |
| Role-specific survey | `survey` | `role` | Top-line findings |
| Function-specific conference content | `conference` | `role` | Session abstract or published slides |

### 2.5 Forbidden Sources

The following source types are **permanently prohibited** regardless of their potential signal value:

- Paywalled content accessed through credential-sharing or bypass techniques
- Content extracted from private or restricted LinkedIn profiles (connections-only)
- Internal corporate communications (Slack exports, email leaks, internal memos)
- Dark web or grey-market data brokers
- Any source that requires the platform to misrepresent its identity
- Government or court records involving personal criminal history

---

<div align="center">— ✦ —</div>

## פ Parasha Gimel · ג
### *The Laws of LinkedIn — Personal Post Extraction*

LinkedIn is the highest-priority personal signal source. These laws govern how LinkedIn content is extracted and what qualifies for storage.

### 3.1 Fetch Behaviour

- Post body text is fetched live from the LinkedIn URL at extraction time
- The stored `description` field from the database is **not used** — it is unreliable and often empty
- Fetches must include a valid `User-Agent` header; bare bot agents are forbidden
- A fetch timeout of **10 seconds** applies; posts that do not respond within this window are skipped, not errored
- Failed fetches are logged with the URL and failure reason for debugging

### 3.2 Post Type Eligibility

| Post Type | Eligible | Reason |
|---|---|---|
| Original text post (no link) | ✅ Yes | Highest signal value — contact's unfiltered voice |
| Link post with commentary | ✅ Yes | Commentary qualifies; the linked article does not |
| Re-share with added commentary | ✅ Yes | Original commentary only; re-shared content excluded |
| Re-share without commentary | ❌ No | No attributable voice; signals nothing about the contact |
| Poll (question text) | ✅ Yes | The question reveals priorities; results do not qualify |
| Image caption only | ✅ Yes | If caption is substantive (>30 words) |
| Bare link share | ❌ No | No attribution possible |
| Job change announcement | ✅ Yes | Career milestone; use Parasha Bet `award` type |
| Congratulatory post to others | ❌ No | No signal about the contact's own views |

### 3.3 Minimum Content Threshold

A LinkedIn post qualifies for extraction only if it meets both:

1. **Length:** ≥ 50 words of original text (after stripping hashtags, @mentions, and URLs)
2. **Attribution potential:** Contains at least one statement that can be attributed to the contact as a belief, observation, tension, or priority — not a pure factual recitation

### 3.4 Freshness Gate

| Post Age | Status |
|---|---|
| < 90 days | ✅ Fully eligible |
| 90–180 days | ✅ Eligible; flag for reviewer attention |
| 180–365 days | ⚠️ Eligible only if no newer posts qualify |
| > 365 days | ❌ Ineligible — do not extract |

The freshness gate is applied **before** the extraction AI call to avoid wasting tokens on stale content.

### 3.5 Volume Limits

- Maximum **10 posts** per extraction run per contact
- Posts are ordered newest-first; older posts fill the queue only if fewer than 10 newer posts are available
- If a contact has more than 10 eligible posts, the oldest eligible posts are silently discarded

---

<div align="center">— ✦ —</div>

## פ Parasha Dalet · ד
### *The Laws of Company Sources — News & Announcements*

### 4.1 Qualifying Company Events

The following event types qualify as company signals:

| Event | Priority | Messaging Sensitivity |
|---|---|---|
| Funding round / capital raise | High | Low — safe to reference |
| Acquisition or merger | High | Medium — confirm it is public and finalised |
| Office opening / geographic expansion | High | Low |
| New product or service launch | High | Low |
| Leadership hire or appointment | High | Low |
| Leadership departure | Medium | High — do not surface loss directly |
| Earnings beat / positive result | Medium | Low |
| Earnings miss / negative result | Medium | High — reference only structural implications |
| Layoffs / restructuring | Low | High — reference only in terms of strategic shift, never loss |
| Regulatory approval | Medium | Low |
| Litigation / settlement | Low | Very High — avoid entirely unless directly relevant to product |
| Award / industry recognition | Medium | Low |

### 4.2 Source Quality Standards

A company signal qualifies only if:
- The source is a named publication (no anonymous blogs or unverifiable sites)
- The event is described in factual terms, not speculative or unconfirmed
- The publication date is available and parseable
- The article or release is publicly accessible without login

### 4.3 De-duplication

Multiple articles covering the same event are collapsed into a single signal. Priority is given to:
1. The company's own press release (primary source)
2. The first mainstream publication to cover the story
3. All subsequent articles are discarded

---

<div align="center">— ✦ —</div>

## פ Parasha He · ה
### *The Laws of Industry Sources — Reports & Research*

### 5.1 Source Credibility Tiers

| Tier | Examples | Weight |
|---|---|---|
| **Tier 1 — Primary research** | Industry association reports, regulatory bodies, central bank publications | 1.0× |
| **Tier 2 — Established trade press** | Named trade publications with editorial standards | 0.85× |
| **Tier 3 — Consultant / analyst reports** | Big-4, McKinsey, Deloitte, Gartner, etc. | 0.80× |
| **Tier 4 — Vendor-sponsored research** | Reports published by competing vendors | 0.60× — flag bias |
| **Tier 5 — Blog / opinion** | No peer review or editorial process | 0.30× — use only for framing, never as evidence |

Tier 4 and 5 sources must include a bias disclosure when surfaced in a message context.

### 5.2 Relevance Threshold

An industry signal qualifies for storage only if it is relevant to:
- An industry in the platform's active `TargetMarketConfig` list, **or**
- A role type in the active `BuyingCenterConfig` seat list

Industry signals that are broadly relevant (e.g. "The economy is slowing") but not specifically actionable for any target market or role are discarded.

### 5.3 Freshness Windows

| Signal Type | Maximum Age |
|---|---|
| Market data / statistics | 90 days |
| Survey / benchmark results | 180 days |
| Regulatory change | 365 days |
| Research report | 180 days |
| Trade press article | 60 days |

---

<div align="center">— ✦ —</div>

## פ Parasha Vav · ו
### *The Laws of Quality — What a Signal Must Be*

These laws apply universally across all source types and signal categories.

### 6.1 The Five Gates

Every signal must pass all five gates before being stored.

**Gate 1 — Attribution**
The signal must be attributable to a real, named entity: a person, a company, or a recognised institution. Anonymous signals are rejected.

**Gate 2 — Specificity**
The signal must contain enough specific detail to support a meaningful message. "Industry is growing" is not specific. "Advisor headcount at independent firms rose 14% year-over-year" is specific.

**Gate 3 — Relevance**
The signal must plausibly connect to the platform's inside-out value proposition (the HQ profile). If no bridge can be constructed, the signal is not useful and should not be stored.

**Gate 4 — Provability**
The signal must be verifiable from the source URL. If the URL is broken, paywalled, or returns no content, the signal is rejected at fetch time.

**Gate 5 — Non-duplication**
The signal must not be a near-identical duplicate of an already-stored signal for the same contact or company. Title similarity > 85% triggers de-duplication review.

### 6.2 Quality Score

Each stored signal carries a computed quality score used by the Scoring Bible. The quality score is based on:

| Factor | Maximum contribution |
|---|---|
| Source tier (Parasha He, §5.1) | 30 pts |
| Specificity of content | 25 pts |
| Attribution clarity | 20 pts |
| Recency (inverse of age) | 15 pts |
| Relevance-to-ICP breadth | 10 pts |

Maximum possible quality score: **100**. Signals scoring below **40** are flagged for review before storage.

---

<div align="center">— ✦ —</div>

## פ Parasha Zayin · ז
### *The Laws of Freshness — Staleness and Decay*

### 7.1 The Freshness Imperative

> **A stale signal is worse than no signal.** An outreach that references a year-old news item signals carelessness, not research. If no fresh signal exists, the platform should open with inside-out content and leave the hook position empty.

### 7.2 Freshness Windows by Signal Category

| Category | Green (fully fresh) | Amber (usable, note age) | Red (do not use) |
|---|---|---|---|
| Personal (LinkedIn) | < 60 days | 60–120 days | > 120 days |
| Personal (other) | < 90 days | 90–180 days | > 180 days |
| Company (major event) | < 60 days | 60–120 days | > 120 days |
| Company (minor event) | < 30 days | 30–60 days | > 60 days |
| Industry report | < 120 days | 120–240 days | > 240 days |
| Role benchmark | < 180 days | 180–365 days | > 365 days |

### 7.3 Freshness in Hook Selection

When multiple signals compete for the HOOK position, freshness is a tiebreaker:
- Two signals of equal relevance → use the more recent one
- An amber signal vs. a red signal → use the amber signal and note its age
- A red signal has no hook value — never open with it, even if it is the only signal available

### 7.4 Re-scrape Triggers

A signal is eligible for re-scraping (refreshing from source) when:
- Its age crosses from Green into Amber
- A manual re-scrape is initiated by a platform user
- A new signal from the same contact / company is detected (triggers a full refresh of the contact's signal set)
- The platform detects that the source URL has been updated (ETag or Last-Modified header changed)

---

<div align="center">— ✦ —</div>

## פ Parasha Chet · ח
### *The Laws of Ethics — Rate Limiting and Privacy*

### 8.1 Rate Limit Obligations

| Target | Maximum request rate | Minimum delay between requests |
|---|---|---|
| LinkedIn (public pages) | 1 req / 3 sec per IP | 3 seconds |
| Company websites | 1 req / 2 sec per domain | 2 seconds |
| News aggregators | Per robots.txt directive | Per robots.txt |
| Research repositories | Per terms of service | Per terms of service |

Rate limit violations that result in IP blocks are treated as platform failures. No business justification overrides these limits.

### 8.2 Robots.txt Compliance

The platform must respect `robots.txt` directives unconditionally. If a page is disallowed by `robots.txt`, it is forbidden regardless of the signal value it would yield.

Exceptions: `robots.txt` does not apply to content the user has explicitly copied into the platform (pasted URLs, manually uploaded documents). Consent-based ingestion is not scraping.

### 8.3 Personal Data Handling

- No personally identifiable information beyond what is publicly visible on professional profiles may be stored
- Contact phone numbers, personal email addresses, home addresses, or family details encountered during scraping must be discarded immediately
- Age, ethnicity, religion, and health-related information encountered incidentally must not be extracted, stored, or used in any scoring or messaging context
- GDPR / CASL / CCPA obligations apply to all stored signal data

### 8.4 Transparency to Contacts

If a contact ever asks what data Whyhello holds about them, the platform must be able to produce a complete, readable summary of all stored signals and their sources. The scraping infrastructure is therefore obligated to store provenance — source URL, fetch date, and signal category — alongside every stored item.

---

<div align="center">— ✦ —</div>

## פ Parasha Tet · ט
### *The Laws of Storage — Normalization and Schema*

### 9.1 Universal Signal Fields

Every stored signal, regardless of source type, must carry:

| Field | Type | Description |
|---|---|---|
| `id` | integer | Auto-incremented primary key |
| `contactId` / `companyId` | integer | FK to the entity the signal belongs to |
| `type` | string | Signal category: `personal` \| `company` \| `industry` \| `role` |
| `title` | string | Headline or post opening (max 255 chars) |
| `url` | string | Canonical source URL |
| `source` | string | Publisher or platform name |
| `mediaType` | string | Canonical type from Parasha Bet §2.1–2.4 |
| `publishedDate` | date | Publication date of the original source |
| `fetchedAt` | timestamp | When Whyhello retrieved the content |
| `description` | text \| null | Body excerpt or summary (may be null) |
| `qualityScore` | integer | 0–100 per Parasha Vav §6.2 |
| `freshnessTier` | string | `green` \| `amber` \| `red` per Parasha Zayin §7.2 |

### 9.2 Normalization Rules

- `title` must be the human-readable headline, not the URL slug
- `publishedDate` must be stored in ISO 8601 format; if only a month/year is available, store the first of the month
- `url` must be the canonical URL (follow redirects before storing)
- `source` must be the publication name, not the domain (e.g. "Financial Post", not "financialpost.com")
- `description` may store a body excerpt of up to **2,000 characters**; longer content is truncated at the last sentence boundary

### 9.3 Upsert Behaviour

- Signals are upserted by `(contactId, url)` or `(companyId, url)` — the URL is the unique key
- A re-fetch of an existing URL updates `fetchedAt`, `qualityScore`, `freshnessTier`, and `description` only; it never creates a duplicate
- `publishedDate` is immutable once set — a re-fetch never changes it

---

<div align="center">— ✦ —</div>

## פ Parasha Yod · י
### *The Unanswered Questions — Open Matters*

| # | Question | Impact |
|---|---|---|
| 1 | Should scraping run on a scheduled cadence (e.g. nightly) or only on-demand per contact? | Infrastructure, freshness SLA |
| 2 | When a contact's LinkedIn profile is private, should we fall back to their company page or suppress personal signals entirely? | Personal signal coverage |
| 3 | How should the platform handle signal URLs that have been deleted or return 404 after storage? | Data integrity |
| 4 | Should job postings be actively scraped to infer strategic intent, or only ingested when manually added? | Company signal depth |
| 5 | At what quality score threshold should a signal be auto-suppressed from the generation pipeline vs. flagged for manual review? | Signal-to-noise ratio |
| 6 | How do we handle duplicate contacts (same person at two companies) — do signals merge, separate, or cross-reference? | Contact identity model |
| 7 | Should the platform monitor source URL health (broken links) on a separate cadence from content freshness? | Signal integrity |
| 8 | When expanding Quotables to blog posts and podcasts (per future roadmap), do the same LinkedIn freshness windows apply? | Cross-source consistency |

---

<div align="center">— ✦ —</div>

*The Scraping Torah is the foundation. Without sound gathering, there is no scoring. Without sound scoring, there is no messaging. Guard these laws.*
