# ✝ The Scoring Bible
## Whyhello Relevance Scoring Logic — Master Reference

> *"For not all signals are created equal; but each shall be judged according to its proximity, its freshness, and its alignment with the mission."*

> **Status:** Living scripture. The Second Pillar. Reflects scoring methodology as of August 2026. All changes to relevance scoring, signal weights, and selection logic must be written here before they descend into code.

---

<div align="center">— ✞ —</div>

## Book I · Genesis
### *The Origin of a Score — Why Scoring Exists*

Before a signal can become a message, it must be judged. The Scoring Bible governs that judgment.

Whyhello holds, at any given time, dozens of signals per contact: LinkedIn posts, company announcements, industry reports, role benchmarks. Not all of them are equally useful. A signal from three years ago is not as valuable as one from last week. A signal about the contact's own ideas is not as valuable as a signal about their company's restructuring — unless the message is a follow-up to a prior conversation about their thinking. The meaning of a signal is not absolute; it is **contextual and relational**.

The scoring system exists to produce a single output for each signal in a given generation context:

> **A relevance score between 0 and 100 that represents how likely this signal is to produce a better message for this contact at this moment.**

This number drives signal selection, hook priority, and variant generation. It is never shown to the contact. It is operational truth.

### 1.1 The Beatitudes of Scoring

*These are the first principles. All scoring rules derive from them.*

**Blessed is the signal that is recent** — for it speaks to the world as it is now, not as it was.

**Blessed is the signal that is specific** — for a statistic is stronger than a trend, and a quote is stronger than a summary.

**Blessed is the signal that is proximate** — for what a person said matters more than what was said about their industry.

**Blessed is the signal that bridges** — for a signal without a connection to the seller's value proposition is noise.

**Blessed is the signal that is credible** — for its source determines how far it may travel.

---

<div align="center">— ✞ —</div>

## Book II · Exodus
### *Leaving Noise Behind — Signal Pre-Qualification*

Before a signal receives a relevance score, it must pass pre-qualification. Pre-qualification is not scoring — it is the gate that determines whether a signal enters the scoring pipeline at all. Signals that fail pre-qualification are excluded from selection, regardless of how interesting their content may appear.

### 2.1 Pre-Qualification Requirements

A signal must satisfy **all three** of the following to enter the scoring pipeline:

**2:1 — The Scraping Torah gate**
The signal must comply with all storage and quality laws of the Scraping Torah. Signals below quality score **40** (per Parasha Vav §6.2) are disqualified.

**2:2 — The freshness gate**
The signal must not carry a `freshnessTier` of `red` (per Parasha Zayin §7.2). Red signals do not enter the scoring pipeline.

**2:3 — The provenance gate**
The signal must have a stored source URL and a confirmed `publishedDate`. Signals without a verifiable origin are disqualified.

### 2.2 Soft Filters (Warnings, Not Disqualifiers)

The following conditions do not disqualify a signal but reduce its composite score and generate a warning flag visible in the platform's internal debugger:

- Source is Tier 4 or Tier 5 (Parasha He §5.1) — bias flag applied
- Signal `freshnessTier` is `amber` — age penalty applied (see Book IV)
- Signal title similarity > 85% to an already-selected signal — de-duplication penalty applied

---

<div align="center">— ✞ —</div>

## Book III · Leviticus
### *The Law of Weights — Base Scores by Signal Type*

Base scores establish the floor value of a signal before context and contact adjustments are applied. They reflect the structural value of each signal type, independent of content quality.

### 3.1 Base Score Table

| Signal Category | Sub-type | Base Score |
|---|---|---|
| **Personal** | Attributable quote (LinkedIn post) | 90 |
| **Personal** | Original LinkedIn post (no quote extracted) | 75 |
| **Personal** | Published interview or article | 70 |
| **Personal** | Podcast appearance | 65 |
| **Personal** | Conference presentation | 60 |
| **Personal** | Press mention (quoted) | 55 |
| **Personal** | Award / recognition | 45 |
| **Company** | Strategic announcement (funding, M&A, launch) | 70 |
| **Company** | Leadership hire | 65 |
| **Company** | Expansion / new office | 60 |
| **Company** | Earnings / financial result | 55 |
| **Company** | Leadership departure | 40 |
| **Company** | Restructuring / layoffs | 30 |
| **Company** | Regulatory filing | 40 |
| **Industry** | Tier 1 primary research | 65 |
| **Industry** | Tier 2 trade press | 55 |
| **Industry** | Tier 3 analyst report | 50 |
| **Industry** | Tier 4 vendor-sponsored research | 35 |
| **Role** | Benchmark / survey | 60 |
| **Role** | Association guidance | 55 |
| **Role** | Conference content | 45 |

> **3:16** — *"The personal signal is the highest law; for it speaks of the person, not merely of the world around them."*

### 3.2 Base Score Justifications

**Why personal signals score highest:**
They are the most specific, the most proximate, and the most personally resonant. A well-used personal signal proves genuine research. An unused personal signal, when one exists, represents a messaging failure.

**Why company restructuring and departures score low:**
High sensitivity and high risk of tone error suppress the base value. These signals require exceptional judgment to use well; their default score reflects the probability of error, not the potential of the signal.

**Why Tier 4 industry signals score low:**
Vendor-sponsored research carries inherent bias. Its information may be accurate, but its credibility in the buyer's eyes is reduced by the conflict of interest.

---

<div align="center">— ✞ —</div>

## Book IV · Numbers
### *Counting Context — Proximity and Freshness Multipliers*

Base scores are modified by two independent multiplier chains. Multipliers compound: a signal with a proximity multiplier of 1.2 and a freshness multiplier of 0.8 yields a composite of `base × 1.2 × 0.8`.

### 4.1 Contact Proximity Multipliers

Contact proximity measures how directly the signal relates to the specific person being targeted.

| Proximity Condition | Multiplier |
|---|---|
| Signal is attributed directly to the contact (they authored or said it) | 1.30× |
| Signal is attributed to the contact's company (they work there) | 1.10× |
| Signal is attributed to a named colleague within the contact's organization | 1.05× |
| Signal is attributed to a named counterpart in the same role at another company | 1.00× (neutral) |
| Signal is industry-level with no named entity | 0.90× |
| Signal is role-level with no named entity | 0.85× |

### 4.2 Freshness Multipliers

Freshness multipliers are applied based on signal age at the time of message generation, not at the time of storage.

| Signal Age | Freshness Tier | Multiplier |
|---|---|---|
| 0–30 days | Green | 1.15× |
| 31–60 days | Green | 1.05× |
| 61–90 days | Green | 1.00× |
| 91–120 days | Amber | 0.90× |
| 121–180 days | Amber | 0.80× |
| 181–365 days | Amber | 0.65× |
| > 365 days | Red | Signal disqualified (pre-qualification gate) |

### 4.3 HQ Alignment Multiplier

The HQ alignment score measures how naturally the signal connects to the seller's inside-out value proposition. It is computed at signal-load time using the following inputs:

- Does the signal topic overlap semantically with any of the three messaging pillars? (+0.10 per pillar match, up to +0.20)
- Does the signal topic overlap with any active product's `persona` or `outcomes` field? (+0.10)
- Does the signal topic overlap with the `valueWedge`? (+0.05)

| HQ Alignment Condition | Multiplier Bonus |
|---|---|
| No alignment detected | +0.00 |
| Aligns with 1 pillar | +0.10 |
| Aligns with 2+ pillars | +0.20 |
| Aligns with active product persona | +0.10 |
| Aligns with value wedge | +0.05 |
| Maximum possible bonus | +0.35 |

### 4.4 Seniority Fit Multiplier

Signal type preference varies by the contact's seniority. These multipliers adjust scores to reflect what will resonate at each level.

| Seniority | Personal | Company | Industry | Role |
|---|---|---|---|---|
| C-Suite / Partner | 1.10× | 1.15× | 1.20× | 0.80× |
| VP / Senior Director | 1.10× | 1.10× | 1.10× | 0.90× |
| Director / Manager | 1.10× | 1.00× | 1.00× | 1.10× |
| IC / Specialist | 1.10× | 0.95× | 0.95× | 1.20× |

*Personal signals are equally valued at all seniority levels — a well-used personal signal is effective regardless of title.*

---

<div align="center">— ✞ —</div>

## Book V · Deuteronomy
### *The Second Law — Composite Score Formula and Selection*

The composite relevance score is the final number that determines signal selection and hook priority.

### 5.1 The Formula

```
compositeScore = min(100, round(
  baseScore
  × proximityMultiplier
  × freshnessMultiplier
  × (1 + hqAlignmentBonus)
  × seniorityFitMultiplier
))
```

The result is capped at **100**. Scores below **0** are not possible by construction of this formula; no negative multipliers exist.

### 5.2 Score Tiers

| Score Range | Tier | Interpretation |
|---|---|---|
| 80–100 | **Excellent** | Strong hook candidate; likely to produce a differentiated message |
| 60–79 | **Good** | Reliable signal; use freely |
| 40–59 | **Adequate** | Usable but not distinctive; prefer higher-scoring alternatives |
| 20–39 | **Weak** | Use only if no better signal exists |
| 0–19 | **Insufficient** | Do not use in message generation |

### 5.3 Selection Rules

When multiple signals compete for the same position in a message (e.g. the HOOK slot), selection follows:

1. **Score first:** The highest-scoring qualifying signal wins
2. **Type tiebreak:** If two signals share an equal score, prefer: Personal > Company > Industry > Role
3. **Freshness tiebreak:** If type is also equal, prefer the more recent signal
4. **Diversity floor:** If the highest-scoring signal and the second-highest share the same `type` and differ by fewer than 5 score points, prefer the more recent signal for the HOOK and the other for supporting context in BRIDGE

### 5.4 Variant Generation Score Routing

When generating message variants, each variant category receives only the signals appropriate to its category:

| Variant | Eligible Signal Types |
|---|---|
| Primary (default) | All types, full scoring |
| Company variant | Company signals only |
| Industry variant | Industry signals only |
| Role variant | Role signals only |
| Personal variant | Personal signals only |

Within each variant, the standard composite score formula applies — but signals outside the variant's eligible types receive a score of **0** and are excluded from selection.

A variant category is **suppressed** (not generated) if the highest-scoring eligible signal for that category scores below **20**. The suppression reason (`"No qualifying [type] signals (highest score: N)"`) must be stored and surfaced in the UI.

### 5.5 The Parable of Two Signals

> *A contact had written a thoughtful LinkedIn post about the future of advisor independence. They had also recently survived a company restructuring. Two signals competed for the HOOK.*
>
> *The LinkedIn post scored 87: personal, 45 days old, strong HQ alignment with the autonomy pillar.*
> *The restructuring article scored 28: company, 35 days old, high sensitivity, weak alignment.*
>
> *The platform chose the LinkedIn post. Not because the restructuring was unimportant — but because the message that opened with the contact's own thinking was more likely to receive a reply. The restructuring was referenced, carefully, in the BRIDGE.*
>
> *This is the purpose of scoring: not to find the most dramatic signal, but to find the most useful one.*

---

<div align="center">— ✞ —</div>

## Book VI · Proverbs
### *Wisdom for Edge Cases*

### 6.1 When No Signal Scores Above 20

If no signal for a contact clears the **20-point** floor after all multipliers are applied:

- The generation proceeds without an outside-in hook
- The message opens directly with the inside-out value wedge
- The platform logs a `no_qualifying_signal` event on the job
- The user is shown a notice: *"No strong outside-in signals available — message opens with your value proposition."*

### 6.2 When a Contact Has Only One Signal Type

If all of a contact's signals belong to a single category (e.g. only industry signals, no personal or company signals):

- Score normally within the available category
- Suppress all variant categories that have no eligible signals (per §5.4)
- Do not attempt to generate a variant from signals that don't exist
- The primary message uses the best available signal, even if it is only industry-level

### 6.3 When HQ Profile is Empty

If the HQ module has not been populated (no pillars, no value wedge, no products):

- HQ alignment multiplier bonus = +0.00 for all signals (no penalty, no boost)
- Message generation proceeds but produces lower-quality output; the platform should display a HQ setup prompt to the user
- Scoring still functions and produces valid composite scores based on proximity, freshness, and base scores alone

### 6.4 When Two Contacts Share the Same Signal

If a company news signal is relevant to multiple contacts at the same company (e.g. a funding announcement), each contact receives an **independent score calculation** — the signal's score is not shared or averaged across contacts. Two contacts in different roles may score the same signal differently because of their seniority fit multipliers and HQ alignment context.

### 6.5 Signal Score Caching

Composite scores are computed at generation time, not at storage time. A signal's score today may differ from its score next week — because it has aged, because the HQ profile has changed, or because the contact's role has been updated. Score caching (storing a pre-computed score) is permitted only for the duration of a single generation job; it must not persist across sessions.

---

<div align="center">— ✞ —</div>

## Book VII · Revelation
### *Open Questions — What Remains to be Revealed*

| # | Question | Impact |
|---|---|---|
| 1 | Should the HQ alignment score be computed by keyword matching or by embedding similarity? The current approach is keyword-based; embeddings would be more accurate but more expensive. | Score quality, cost |
| 2 | Should the seniority fit multiplier apply to the hook signal only, or to all signals selected for the message? | EB and BRIDGE signal selection |
| 3 | When a contact changes companies, should their previous company's signals be re-scored with a new proximity multiplier (now reduced) or retired? | Signal lifecycle |
| 4 | Should scoring incorporate engagement signals (e.g. did the contact like or comment on the source post)? These signals exist but are not currently captured. | Engagement-informed scoring |
| 5 | Is a composite score of 20 the right suppression floor, or should variant suppression require a higher minimum (e.g. 35)? | Variant quality |
| 6 | Should the platform surface score explanations to users ("This signal scored 82 because it's a direct quote from 3 weeks ago with strong pillar alignment")? | Transparency and trust |
| 7 | How should the platform handle A/B evidence — if a message that used a low-scoring signal outperformed a message that used a high-scoring signal? | Score calibration feedback loop |

---

<div align="center">— ✞ —</div>

## Appendix · The Score in Practice

### Worked Example: Agnes Krause, Richardson Wealth

**Signal:** Agnes Krause's LinkedIn post "US Fed may reconsider rate cuts amid shutdown concerns"
- `mediaType`: `linkedin`
- `baseScore`: 75 (original LinkedIn post, no quote extracted yet)
- `proximityMultiplier`: 1.30× (attributed directly to contact)
- `freshnessMultiplier`: 1.00× (within 90 days)
- `hqAlignmentBonus`: +0.10 (aligns with market-conditions pillar)
- `seniorityFitMultiplier`: 1.10× (VP-level, personal signal)

```
compositeScore = min(100, round(75 × 1.30 × 1.00 × 1.10 × 1.10))
               = min(100, round(75 × 1.573))
               = min(100, round(117.975))
               = 100
```

**Result:** Score capped at 100. This signal wins the HOOK position in all variants that include personal signals.

---

<div align="center">— ✞ —</div>

*The Scoring Bible is the bridge between the Scraping Torah and the Messaging Quran. Without sound scoring, gathered signals become noise. With it, they become conversation.*
