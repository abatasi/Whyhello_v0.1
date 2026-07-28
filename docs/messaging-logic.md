# Whyhello Messaging Logic — Master Reference

> **Status:** Living document. Reflects logic implemented in `artifacts/contact-db/src/pages/HQ.tsx` and `ContactProfile.tsx` as of July 2026. All future messaging changes should be spec'd here first.

---

## 1. Philosophy: The Inside-Out / Outside-In Blend

Whyhello generates outbound messages by combining two independent signal streams and resolving them into a single, contextually relevant output.

```
OUTSIDE-IN                          INSIDE-OUT
─────────────────────────────       ────────────────────────────
Contact signals              ╮      Company DNA (HQ)
  · Personal Insights         │      · Value wedge
    (news, quotes, content    ├──►   · Positioning statement
     linked to the contact)   │      · Messaging pillars
Company signals              │BLEND · Product economic benefits
  · Company Insights          │      · Customer proof points
    (news, events, content    │      · Voice & tone profile
     linked to the company)   │      · Competitive positioning
Industry signals             │      · Target market fit
  · InsightItems type:        │      · Buying center map
    "industry"               │
Role-level signals           ╯
  · InsightItems type: "role"
```

**Inside-out** answers: *Who are we, what do we do, and why does it matter?*  
**Outside-in** answers: *Who is this specific person, and what is true of their world right now?*

A message scores well when it uses outside-in signals to **select** which inside-out content to surface — not to change what is true about the company, but to choose the angle, proof point, pillar, or economic benefit that will resonate most with this contact in this moment.

---

## 2. Inside-Out Inputs: The HQ Data Model

All inside-out data is defined and maintained in the HQ module (`DNAData`). The fields below are the authoritative messaging inputs.

### 2.1 Company Core

| Field | Description | Messaging Role |
|---|---|---|
| `company.name` | Brand name | Sender identity |
| `company.valueWedge` | One-line value statement | Subject line hook, opener |
| `company.positioning` | Full positioning paragraph | Context for tone/angle selection |
| `company.differentiators` | Free-text list of differentiators | Reasons to believe |
| `company.pillars[0–2]` | Three named messaging pillars | Primary message themes |

### 2.2 Voice Profile

| Field | Description | Messaging Role |
|---|---|---|
| `voice.toneTags` | Array of tone descriptors (e.g. `["direct","warm"]`) | Sentence register, word choice |
| `voice.communicationStyle` | Paragraph describing how the brand speaks | AI instruction block |
| `voice.writingNotes` | Freeform notes on language preferences | Edge-case overrides |
| `voice.trainingText` | Sample approved copy | Few-shot exemplar for generation |
| `voice.suppressions` | Words/phrases to avoid | Negative constraint list |

### 2.3 Products

Each `Product` represents a distinct offering that can anchor a message.

```typescript
interface Product {
  id: string;
  name: string;
  tagline: string;
  features: string;          // what it does
  outcomes: string;          // what it achieves for the buyer
  persona: string;           // who it is built for
  economicBenefits: EconomicBenefit[];
}
```

The `persona` field is the primary signal used to match a product to an outside-in contact when multiple products exist.

### 2.4 Economic Benefits

Each `EconomicBenefit` is a structured, quantified value claim attached to either a Product or a Customer proof point.

```typescript
interface EconomicBenefit {
  id: string;
  type: "pain" | "gain";
  label: string;       // name of the benefit (e.g. "Revenue from new AUM")
  description: string; // free-text verb phrase (e.g. "generates revenue from assets under management")
  amount: string;      // numeric magnitude (e.g. "1.2%")
  unit: string;        // unit of measurement (e.g. "Per $1M of net-new AUM")
  frequency: string;   // cadence key: "one-time" | "monthly" | "quarterly" | "annually" | "per-event" | "ongoing"
}
```

**Gain** = positive economic outcome the buyer realizes.  
**Pain** = cost, loss, or inefficiency the buyer avoids or eliminates.

### 2.5 Customers (Proof Points)

```typescript
interface Customer {
  id: string;
  rawTestimonial: string;
  customerProfile: string;      // who they are (role, industry, size)
  startingSituation: string;    // before state
  customerPriorities: string;   // what they cared about
  solutionProvided: string;     // what was delivered
  customerTransformation: string;
  results: string;
  economicBenefits: EconomicBenefit[];
  customerQuote: string;
}
```

Customer EBs use **simple past tense** (proof: this already happened).  
Product EBs use **present tense** (promise: this is what the product does).

### 2.6 Competitors

```typescript
interface Competitor {
  id: string;
  name: string;
  website: string;
  productCompared: string;
  category: string[];           // multi-select: "Direct" | "Indirect" | "Substitute" | "Status quo"
  marketSegments: string;
  dealFrequency: string;
  notes: string;
  theirStrengths: string;
  buyersPreferThem: string;
  theyAreBetterWhen: string;
  avoidClaiming: string;        // claims we must not make against this competitor
  ourStrengths: string;
  problemsExposingWeakness: string;
  buyersPreferUs: string;
  advantagesOverTime: string;
}
```

### 2.7 Market Position

```typescript
interface MarketPosition {
  pricePosition: string;         // e.g. "Premium"
  productBreadth: string;        // e.g. "Narrow / specialist"
  productDepth: string;          // e.g. "Deep"
  customerFocus: string;         // e.g. "Mid-market enterprise"
  deliveryModel: string;         // e.g. "Managed service"
  primaryAdvantage: string;      // e.g. "Outcomes speed"
  typicalBuyingPriority: string; // e.g. "ROI > risk > ease"
}
```

### 2.8 Buying Centers & Target Markets

```typescript
interface BuyingCenterConfig {
  id: string;
  name: string;
  seats: BuyingCenterSeat[];   // each seat: role title + seniority + department arrays
}

interface TargetMarketConfig {
  id: string;
  name: string;
  industries: string[];
  companySizes: string[];
  locations: string[];
}
```

These are used to **match** a contact to the correct buying center seat and target market, which determines which product persona and EB set to activate.

---

## 3. Outside-In Inputs: Platform Signal Types

Outside-in data is sourced entirely from within the Whyhello platform — from the Personal Insights attached to each contact and the Company Insights attached to each company. No external enrichment or third-party data feeds are used at this stage. All signals are read-only from a messaging perspective — they inform selection, not content.

### 3.1 Contact Signals

Contact signals come from the **Personal Insights** associated with each contact record in the platform. These are `InsightItem` records of `type: "contact"` — articles, interviews, posts, or other content directly linked to that individual.

| Signal | How it is read | Messaging Use |
|---|---|---|
| Role / title | Stored on the contact record (`jobTitle`) | Select product persona match; determine seniority frame |
| Department | Stored on the contact record (`department`) | Infer functional priorities; choose EB type (revenue vs. cost) |
| Seniority | Stored on the contact record (`seniority`) | Choose message register (strategic vs. operational) |
| Buying center seat | Matched from HQ `BuyingCenterConfig` against role + department | Activate relevant product + EB set |
| Personal Insights | `InsightItem[]` of `type: "contact"` linked to this contact | Hook — open the message with something specific to this person |

Personal Insights are the highest-value contact signal because they provide a specific, timely, attributable reference — a quote, a post the person wrote, a panel they spoke on — that makes an opener feel researched rather than templated.

### 3.2 Company Signals

Company signals come from the **Company Insights** associated with each company record in the platform. These are `InsightItem` records linked to that company — news coverage, press releases, earnings commentary, or other content about the organisation.

| Signal | How it is read | Messaging Use |
|---|---|---|
| Industry | Stored on the company record (`industry`) | Match target market; select relevant social proof |
| Company size | Stored on the company record (`size`) | Confirm target market fit; adjust scale of EB numbers |
| Location | Stored on the company record (`location`) | Regional context; regulatory framing |
| Company Insights | `InsightItem[]` linked to this company | Hook — open with a recent event or development at their organisation |

Company Insights convert a generic pitch into a timely one. A funding round, a leadership change, a product launch, or a market entry noted in the company's insight feed provides a natural opening before pivoting to the inside-out value proposition.

### 3.3 Industry Signals

Drawn from `InsightItem` records with `type: "industry"`. Used to:
- Frame the message within a sector-level narrative the contact recognises
- Reference a shared headwind or tailwind without requiring personalised research
- Avoid making claims that feel generic by anchoring to a real sector dynamic

### 3.4 Role-Level Signals

Drawn from `InsightItem` records with `type: "role"`. Used to:
- Lead with a pain or priority that is structurally true of this role archetype
- Validate that the economic benefit framing matches what this persona measures
- Choose between revenue-growth (gain) vs. cost/risk-reduction (pain) framing

### 3.5 Insight Items (News / Content)

```typescript
interface InsightItem {
  id: number;
  title: string;
  url: string;
  source: string;
  publishedDate?: string | null;
  mediaType: string;
  description?: string | null;
}

interface InsightCategory {
  type: string;    // "contact" | "company" | "industry" | "role" | "product" | ...
  label: string;
  items: InsightItem[];
}
```

A published insight is the highest-value outside-in trigger because it provides a **specific, timely hook** that can open a message before pivoting to inside-out value.

---

## 4. The Blend: Signal Resolution Rules

When generating a message, the engine resolves outside-in signals into inside-out selections using the following priority order.

### 4.1 Product Selection

1. Match contact's buying center seat (from HQ `BuyingCenterConfig`) to the product whose `persona` field best aligns.
2. If no direct seat match, fall back to `TargetMarketConfig` — choose the product associated with the matched target market.
3. If still ambiguous, default to the first product.

### 4.2 Economic Benefit Selection

Once a product is selected, choose an EB using:

| Outside-in signal | EB preference |
|---|---|
| Seniority = C-level / VP | Lead with highest-magnitude gain EB; suppress operational pain EBs |
| Seniority = Director / Manager | Lead with pain EB; support with gain EB |
| Department = Finance / CFO | Prefer gain EBs with `unit` containing "$" or "%" |
| Department = Operations | Prefer pain EBs (cost, time, risk reduction) |
| Company Insight signals growth (funding, expansion, new hire) | Prefer gain EBs (growth narrative) |
| Company Insight signals pressure (restructure, cost news, missed targets) | Prefer pain EBs (efficiency narrative) |

If no signal match, default to the first gain EB, then the first pain EB.

### 4.3 Messaging Pillar Selection

Map the contact's role archetype to the most relevant messaging pillar:

1. Scan the three `company.pillars` for semantic alignment with the contact's inferred priorities.
2. Select the pillar whose language most closely reflects what the outside-in signals indicate this person cares about.
3. Use the selected pillar as the **thematic anchor** of the message body — it should be present, not necessarily quoted verbatim.

### 4.4 Social Proof Selection

From the `customers` array, select the proof point where `customerProfile` most closely matches the contact's company profile (industry + size + role type). Use that customer's:
- `customerTransformation` as the "before/after" narrative
- `results` as the supporting detail
- `customerQuote` as optional close
- Customer EBs as past-tense quantified validation of the product EB claim

### 4.5 Hook Selection (Outside-In Lead)

A message should open with the most specific outside-in signal available, in this priority:

1. **Contact insight** — something the person said, published, or was quoted on
2. **Company insight** — a recent event (funding, M&A, product launch, earnings)
3. **Industry insight** — a sector trend or regulatory shift
4. **Role insight** — a structural truth about this role's current environment
5. **No hook available** — open directly with value wedge + pillar

---

## 5. Economic Benefit Sentence Construction

This is the core quantified-value rendering logic, implemented as a verb-extraction pipeline.

### 5.1 Verb Normalisation (`VERB_FORMS`)

All recognised verbs are registered in `VERB_FORMS` as a dictionary mapping **any surface form** (base, 3sg present, past, participle, gerund) to a `[present-3sg, simple-past]` tuple.

```
generate → generates / generated
reduce   → reduces   / reduced
eliminate → eliminates / eliminated
```

Coverage includes ~40 gain verbs and ~20 pain verbs. Any verb not in the dictionary falls back to the default:
- **Gain fallback:** `realizes` / `realized`
- **Pain fallback:** `eliminates` / `eliminated`

### 5.2 Verb Extraction (`descriptionToVerbPhrase`)

The description field is a free-text verb phrase written by the user (e.g. *"generates revenue from assets under management"*).

The algorithm:
1. Lowercase the description
2. Scan words left-to-right for the first word present in `VERB_FORMS`
3. If the verb is at position 0: the predicate is `conjugated_verb + rest_of_phrase`
4. If the verb is mid-phrase (e.g. *"revenue generated from assets"*): restructure as `conjugated_verb + pre-verb_words + post-verb_words` → *"generates revenue from assets"*
5. Apply tense: **present** for Products, **simple past** for Customers

### 5.3 Frequency Rendering (`frequencyPhrase`)

| Key | Product (present) | Customer (past) |
|---|---|---|
| `one-time` | `in a single engagement` | `in a single engagement` |
| `monthly` | `every month` | `every month` |
| `quarterly` | `each quarter` | `each quarter` |
| `annually` | `each year` | `each year` |
| `per-event` | `per occurrence` | `per occurrence` |
| `ongoing` | `on an ongoing basis` | `on an ongoing basis` |

### 5.4 Sentence Assembly

**Gain (Product — present tense):**
```
{label} {predicate} — {amount} {unit}, {freq}.
                     ^^^^^^^^^^^^^^^^^^^
                     bolded in rendered output
```
Example: *Revenue from new AUM generates revenue from assets under management — **1.2% per $1M of net-new AUM**, each year.*

**Pain (Product — present tense):**
```
{label} {predicate}, saving {amount} {unit} {freq}.
                            ^^^^^^^^^^^^^^^^^^^
                            bolded in rendered output
```
Example: *Compliance overhead eliminates manual compliance reporting, saving **$80K per advisor** each year.*

**Gain (Customer — simple past):**
```
{label} {predicate} — {amount} {unit}, {freq}.
```
Example: *Revenue from new AUM generated revenue from assets under management — **1.2% per $1M of net-new AUM**, each year.*

**Pain (Customer — simple past):**
```
{label} {predicate}, saving {amount} {unit} {freq}.
```
Example: *Compliance overhead eliminated manual compliance reporting, saving **$80K per advisor** each year.*

### 5.5 Unit Normalisation

- Leading `"Per"` → lowercased to `"per"` in sentence context
- All other unit casing preserved as entered

---

## 6. Message Structure Templates

### 6.1 Cold Outreach (Email / LinkedIn)

```
[HOOK — outside-in lead, 1 sentence]
[BRIDGE — connect hook to the contact's implied priority]
[VALUE — inside-out: value wedge or activated pillar]
[PROOF — EB sentence (gain or pain) + optional customer reference]
[CTA — specific, low-friction ask]
```

### 6.2 Follow-Up / Nurture

```
[CALLBACK — reference prior interaction or shared context]
[RELEVANCE — new outside-in signal that has emerged since]
[DEPTH — go deeper on the previously introduced pillar]
[EB — second EB if first was gain, use pain; if first was pain, use gain]
[CTA]
```

### 6.3 Meeting Prep Briefing

```
[CONTACT SNAPSHOT — role, seniority, recent signals]
[COMPANY SNAPSHOT — industry, size, recent events]
[RECOMMENDED ANGLE — pillar + EB set to lead with]
[COMPETITIVE ALERT — any known competitor in play + avoid-claiming notes]
[SUGGESTED QUESTIONS — derived from customerPriorities field]
```

### 6.4 Competitive Response

```
[ACKNOWLEDGE — what the competitor is genuinely good at (theirStrengths)]
[REFRAME — shift to terrain where we win (ourStrengths / advantagesOverTime)]
[AVOID — suppress any claims in avoidClaiming]
[PROOF — customer EB that directly addresses the competitor's claimed strength]
```

---

## 7. Voice & Tone Application Rules

1. `toneTags` constrain word choice and sentence rhythm — applied globally to every output.
2. `communicationStyle` is passed as a system instruction to the generation layer.
3. `writingNotes` override defaults at the phrase level (e.g. "never use the word 'leverage'").
4. `suppressions` are enforced as a post-generation filter — any suppressed term triggers a rewrite pass.
5. `trainingText` is used as few-shot exemplar material — extract 2–3 representative passages as style anchors.

---

## 8. Constraint Hierarchy

When signals conflict, apply this precedence:

```
1. suppressions (hard block — never output)
2. avoidClaiming (competitive — hard block in competitive context)
3. voice.toneTags (soft constraint — shapes register)
4. outside-in hook selection rules (context selection)
5. seniority-based EB framing (presentation selection)
6. pillar selection (thematic anchor)
7. default fallbacks
```

---

## 9. Open Questions & Future Decisions

| # | Question | Impact |
|---|---|---|
| 1 | Should the buying center seat match override persona match when they conflict? | Product selection |
| 2 | How should the system behave when zero EBs are defined for the selected product? | EB sentence fallback |
| 3 | Should multiple pillars ever be combined in one message, or always one at a time? | Message density |
| 4 | How should the system handle contacts whose industry doesn't match any TargetMarketConfig? | Out-of-ICP routing |
| 5 | Should Customer EBs from a different industry be usable, with a proximity score? | Social proof selection |
| 6 | What is the maximum number of outside-in signals to surface in a single message before it feels surveillance-y? | Trust / tone |

---

## 10. Implementation Notes

- **EB logic lives in:** `artifacts/contact-db/src/pages/HQ.tsx` — `VERB_FORMS`, `descriptionToVerbPhrase()`, `frequencyPhrase()`, `buildProductEBParts()`, `buildCustomerEBParts()`, `EBSummary`
- **Voice data lives in:** `DNAData.voice` — stored in `dna_profiles` table, retrieved via API
- **Contact/insight data lives in:** `ContactProfile.tsx` — `InsightItem`, `InsightCategory`
- **Blending logic (not yet implemented):** Will require a resolver function that accepts `{ contact, company, dna }` and returns a `MessageContext` object — the selected product, EB, pillar, proof point, and hook — before passing to a generation call.
