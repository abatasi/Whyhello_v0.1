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

### 3.0 Core Principle: Proximity Governs Posture

> **The closer an insight sits to the buyer, the more familiarity Whyhello assumes. As the insight moves farther from the buyer, the seller earns more permission to introduce and explain it.**

This creates a natural progression across insight types:

| Stage | Posture | Applied to |
|---|---|---|
| **Recognize** | You noticed something they created or said | Personal insights |
| **Acknowledge** | You're aware of what's happening around them | Company insights |
| **Surface** | You found something they may not have seen | Industry / Role insights |
| **Introduce** | You're bringing activity from their orbit into view | Colleague / Counterpart insights |

---

### 3.1 Universal Outside-In Messaging Principles

These six rules apply to every outside-in signal, regardless of type.

#### 1. Respect the buyer's proximity to the signal
Never explain the buyer's own work back to them. Avoid treating company news as a revelation to an insider. Provide more context only as the signal moves farther from their immediate orbit.

#### 2. Prove relevance through specificity
Reference the particular quote, idea, event, finding, or decision that matters. `"I enjoyed your podcast"` is weak. `"Your point about advisors losing ownership of the client experience stayed with me"` proves attention.

#### 3. Interpret rather than merely summarize
Whyhello should explain what stood out or why the signal matters. The message should add a useful observation rather than repeat the source.

#### 4. Use the signal as a premise, not decoration
The insight should create a logical reason to introduce the seller's internal signal. It should not feel like personalization pasted onto an unrelated pitch.

#### 5. Avoid false familiarity
Do not imply that the seller knows what the buyer thinks, knows, or is currently prioritizing. Use language such as *"It made me wonder,"* *"This may be relevant,"* and *"I could see this affecting…"*

#### 6. Preserve conversational momentum
The outside-in section should usually occupy one or two sentences. Include only enough context to establish relevance and create the bridge to the seller's perspective.

---

### 3.2 Personal Insights

**Definition:** Insights originating directly from the contact — their posts, interviews, podcasts, articles, presentations, comments, awards, career milestones, or public statements.

**Assumed awareness:** Certain. The contact created, said, published, or participated in the source material.

**Seller posture:** Attentive audience member. The seller demonstrates genuine interest in the contact's thinking or work. They are not "informing" the contact about their own activity.

**Guiding principles:**
- Lead with recognition, appreciation, or thoughtful agreement
- Isolate a specific quote, argument, story, or detail
- Explain briefly why it stood out
- Prefer the contact's substantive ideas over superficial biography
- Use praise only when it is specific and credible
- Connect the idea expressed by the contact to the seller's internal signal
- Treat disagreements carefully: show curiosity before challenging the contact's view

**Recommended framing:**
- *"I enjoyed your point about…"*
- *"Your comment that '[short quote]' stood out to me."*
- *"I was glad to see you raise…"*
- *"Your distinction between X and Y was especially interesting."*
- *"The part that stayed with me was…"*

**Avoid:**
- Generic praise such as "Great post!"
- Long summaries of what the contact already said
- Claiming agreement without demonstrating understanding
- Excessive flattery
- Implying the buyer should be interested in their own content

**Internal bridge logic:**
> You expressed X → X has an implication for Y → we help address Y.

*Example: "Your point about advisors needing greater ownership of the client experience stood out to me. That same issue tends to surface when teams evaluate how much flexibility their current platform actually gives them."*

---

### 3.3 Company Insights

**Definition:** News, announcements, earnings calls, investor materials, leadership changes, product releases, hiring activity, strategic initiatives, regulatory developments, or other signals associated with the contact's company.

**Assumed awareness:** Probable awareness, uncertain depth. The contact likely understands the broader development but may not have seen the particular article, report, quote, or external interpretation.

**Seller posture:** Informed external observer. The seller acknowledges the buyer's proximity while contributing an outside perspective.

**Guiding principles:**
- Distinguish between the underlying event and the specific source
- Assume familiarity with the event, but not necessarily the article or interpretation
- Avoid explaining the company to someone who works there
- Focus on what the development could mean for the contact's function
- Use tentative language when drawing operational implications
- Treat sensitive developments — layoffs, missed targets, litigation, leadership departures — with restraint
- Avoid asking the contact to confirm confidential or non-public information

**Recommended framing:**
- *"You're likely already close to this, but I noticed…"*
- *"I imagine this is already well known internally, though this outside take caught my attention…"*
- *"Not sure whether this particular analysis crossed your desk…"*
- *"I saw the announcement about X and was interested in the emphasis on Y."*
- *"From the outside, it looks as though…"*

**Avoid:**
- *"Did you know your company…?"* / *"In case you weren't aware…"*
- Treating public speculation as confirmed fact
- Asking the buyer to disclose inside information
- Overstating what a single signal proves
- *"Congratulations"* when the development may create disruption for the buyer

**Internal bridge logic:**
> Your company is doing X → this may create pressure or opportunity around Y → our work is relevant to Y.

*Example: "You're likely already close to the expansion announcement, but I noticed how strongly the company emphasized advisor growth. From the outside, that would seem to increase the importance of giving new teams a transition experience that protects client continuity."*

---

### 3.4 Industry Insights

**Definition:** Industry reports, economic data, association research, regulatory changes, competitor developments, emerging trends, forecasts, market commentary, and broader industry news.

**Assumed awareness:** Possible general awareness, low assumed awareness of the specific source. The buyer may understand the trend but should not be expected to have encountered the particular insight.

**Seller posture:** Resourceful industry observer. The seller earns attention by finding, filtering, and interpreting useful information.

**Guiding principles:**
- Introduce the source naturally and provide a link when useful
- Distill the insight instead of assigning the buyer reading homework
- Explain why the finding may matter to their business or market
- Separate evidence from interpretation
- Prefer recent, credible, and decision-relevant sources
- Do not use generic industry facts as though they are discoveries
- Avoid manufacturing urgency from weak trend data
- When referencing competitors, focus on market implications rather than gossip

**Recommended framing:**
- *"I came across an interesting report on…"*
- *"This analysis of X may be worth a look…"*
- *"One finding in this industry report caught my attention…"*
- *"I thought you might find this useful given the shift toward…"*
- *"The headline is X, but the more interesting detail may be Y."*

**Avoid:**
- *"As you already know…"* unless the statement is genuinely foundational
- Dropping a link without explaining its relevance
- Summarizing an entire report
- Presenting a forecast as established fact
- Using a loosely related article merely to create an opening
- Turning helpful sharing immediately into a hard pitch

**Internal bridge logic:**
> The market is shifting toward X → companies may need to respond through Y → we enable or support Y.

*Example: "I came across a useful report showing that advisor mobility is increasingly being shaped by operating autonomy, not only compensation. The finding may be relevant to firms looking to differentiate their recruiting proposition beyond the economic package."*

---

### 3.5 Role Insights

**Definition:** Research, benchmarks, priorities, challenges, operating models, performance trends, or professional association material related to the contact's role.

**Assumed awareness:** Likely awareness of the underlying challenge, uncertain awareness of the specific evidence. The buyer lives the role, but may not have seen how the issue is being quantified or handled elsewhere.

**Seller posture:** Role-informed specialist. The seller demonstrates familiarity with the buyer's operating environment without claiming to understand the buyer's job better than they do.

**Guiding principles:**
- Validate lived experience rather than lecture the buyer about their role
- Use the source to quantify, contextualize, or reframe a familiar challenge
- Avoid reductive statements such as "CFOs care about cost"
- Focus on tensions, trade-offs, changing expectations, or emerging priorities
- Make clear whether the insight applies broadly or to a specific segment
- Invite the buyer to compare the research with their own experience
- Connect to an internal signal only when the seller has credible relevance

**Recommended framing:**
- *"I found this benchmark on how [role] leaders are approaching…"*
- *"This report puts some useful numbers behind…"*
- *"You'll know the challenge far better than I do, but this finding was interesting…"*
- *"One tension the report highlights is…"*
- *"I was curious whether this reflects what you're seeing…"*

**Avoid:**
- Telling the contact what people in their role care about
- Basic descriptions of their responsibilities
- Overconfident phrases such as *"Your biggest challenge must be…"*
- Treating broad survey results as individualized truth
- Using role stereotypes as personalization

**Internal bridge logic:**
> People in your role are confronting X → the difficult trade-off is Y → we help improve or resolve Y.

*Example: "I found a benchmark showing that investment-advisor recruiters are being asked to increase candidate volume without weakening fit. It puts some useful numbers behind the tension between scaling outreach and maintaining a genuinely personal recruiting experience."*

---

### 3.6 Colleague Insights

**Definition:** Public activity from someone inside the contact's organization — posts, interviews, podcasts, presentations, statements, awards, or announced initiatives.

**Assumed awareness:** Low assumed awareness of the particular content, high recognition of the person or function. The contact may not have seen the activity, but the colleague's name and organizational connection should create immediate relevance.

**Seller posture:** Connected organizational observer. The seller is bringing forward an idea already present somewhere inside the buyer's organization.

**Guiding principles:**
- Name the colleague and explain their relationship to the insight
- Do not imply the contact and colleague know each other personally unless verified
- Do not use one colleague's statement as proof of company-wide consensus
- Highlight organizational alignment, shared themes, or possible relevance
- Avoid creating awkwardness, triangulation, or internal political pressure
- Never imply that the colleague privately referred the seller unless that happened
- Treat the colleague's idea as a useful internal signal, not leverage against the contact

**Recommended framing:**
- *"I came across a conversation with your colleague [Name] about…"*
- *"[Name] made an interesting point recently about…"*
- *"Not sure if you caught [Name]'s discussion of…"*
- *"A theme raised by someone elsewhere in your organization caught my attention…"*
- *"Your colleague's distinction between X and Y seemed especially relevant to…"*

**Avoid:**
- *"Your company believes…"* based on one person's statement
- *"I've been speaking with your colleague…"* when that is untrue
- Suggesting the contact should already have seen the content
- Using senior leadership's comments to pressure a more junior contact
- Revealing or implying confidential conversations
- Name-dropping without a substantive connection

**Internal bridge logic:**
> Your colleague raised X → X may also touch your area through Y → we have a relevant perspective on Y.

*Example: "I came across Sarah Chen's interview on preserving advisor identity during a firm transition. Her point about continuity extending beyond account transfer seemed particularly relevant to the teams responsible for recruiting and onboarding new practices."*

---

### 3.7 Counterpart Insights

**Definition:** Public activity from someone performing a similar role in the same industry at another organization.

**Assumed awareness:** Low awareness of the specific activity, high relevance of the person's position. The buyer may not know the source but should recognize the practical relevance of someone confronting comparable responsibilities.

**Seller posture:** Cross-market pattern spotter. The seller helps the buyer see what peers are trying, questioning, or prioritizing elsewhere in the market.

**Guiding principles:**
- Establish why the person is a meaningful counterpart
- Focus on comparable decisions, experiments, or operating challenges
- Avoid presenting a single counterpart as representative of the whole market
- Use peers as evidence or inspiration, not as social pressure
- Distinguish a public statement from a verified business outcome
- Be cautious when the counterpart works for a direct competitor
- Never reveal confidential information from another company
- Frame the insight as "what one peer is doing," not "what everyone else knows"

**Recommended framing:**
- *"I came across an interesting perspective from another [role] in your space…"*
- *"[Name], who leads X at Y, recently described…"*
- *"One of your counterparts is taking an interesting approach to…"*
- *"This caught my attention because it came from someone dealing with a very similar mandate."*
- *"It is only one example, but their approach to X was interesting…"*

**Avoid:**
- *"Your competitors are all doing this."*
- *"You're falling behind."*
- Invented peer pressure or unsupported market consensus
- Sharing confidential client information
- Assuming two roles are equivalent based only on job title
- Treating a counterpart's stated initiative as a proven success

**Internal bridge logic:**
> A comparable leader is approaching X through Y → this suggests an emerging option or question → we can help the buyer evaluate or pursue it.

*Example: "I came across an interview with another head of advisor recruitment who is treating transition support as part of the recruiting proposition rather than a post-signature process. It is only one example, but it raises an interesting question about where firms can create differentiation before an advisor makes a decision."*

---

### 3.8 Signal-to-Message Architecture

Every outside-in lead follows a four-stage arc before connecting to inside-out content:

| Stage | Purpose | Core question |
|---|---|---|
| **Signal** (HOOK) | Introduce the outside-in insight with the correct awareness posture | What happened, and how should we assume the buyer relates to it? |
| **Interpretation** (HOOK tail / BRIDGE opening) | Identify what specifically matters | Why is this signal noteworthy? |
| **Relevance bridge** (BRIDGE) | Connect the insight to a buyer problem, priority, or opportunity | Why might this matter in the buyer's world? |
| **Internal signal** (VALUE) | Introduce the seller's capability, experience, evidence, or offer | Why is there a productive reason to speak? |

> **The bridge is the most important piece.** Without it, the message becomes two disconnected statements: *"I saw something about you"* followed by *"Here is what we sell."* The bridge supplies the buyer implication.

**Quality-control test:** *Because [outside-in signal] suggests [buyer implication], it may be productive for the buyer and seller to discuss [inside-out relevance].* If Whyhello cannot complete that sentence convincingly, the insight and internal signal probably should not be combined.

**Full example:**

| Stage | Example text |
|---|---|
| Signal | *I enjoyed your point that advisor independence means little without the infrastructure to act on it.* |
| Interpretation | *It captured the tension between offering autonomy and giving practices enough support to use it effectively.* |
| Relevance bridge | *That tension seems especially important when an advisor is comparing an independent firm with the institutional resources they already have at a bank.* |
| Internal signal | *Richardson Wealth has built its recruiting proposition around preserving that support while giving advisors more ownership over how they serve clients.* |
| Offer | *Would it be useful to compare how that model works in practice?* |

---

### 3.9 Recommended Signal Metadata

Each insight should carry structured messaging instructions to guide generation:

| Field | Purpose |
|---|---|
| Insight type | Personal, company, industry, role, colleague, or counterpart |
| Contact proximity | Direct, organizational, market, professional, internal peer, external peer |
| Assumed awareness | Certain, probable, possible, or unlikely |
| Seller posture | Fan, observer, resource, specialist, organizational connector, pattern spotter |
| Specific evidence | Quote, statistic, event, finding, decision, or action |
| Interpretation | What is interesting or consequential |
| Buyer implication | Potential problem, opportunity, tension, or priority |
| Confidence level | Confirmed fact, reasonable inference, or hypothesis |
| Sensitivity | Normal, delicate, or restricted |
| Source-link value | Necessary, helpful, optional, or unnecessary |
| Permitted framing | Recommended opening patterns |
| Prohibited framing | Awareness errors, exaggerations, or sensitive claims |
| Internal-signal match | Product benefit, customer evidence, company differentiator, expertise, or offer |
| Connection thesis | One sentence: *Because [signal] suggests [implication], it may be productive for buyer and seller to discuss [relevance].* |

---

### 3.10 Insight Items (Data Structure)

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
  type: string;    // "personal" | "company" | "industry" | "role" | "colleague" | "counterpart"
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

A message should open with the most specific outside-in signal available. Signal type determines both priority and the correct awareness posture (see Section 3.0):

1. **Personal quote** — a verbatim line attributed directly to the contact (highest trust; certain awareness)
2. **Personal insight** — something they published, said on stage, or was featured on (certain awareness)
3. **Company insight** — a recent event at their organization (probable awareness — acknowledge, don't reveal)
4. **Industry insight** — a sector report, trend, or regulatory shift they may not have seen (possible awareness — surface and distill)
5. **Role insight** — a benchmark or structural challenge in their operating environment (likely awareness of challenge, uncertain of this source — validate and contextualize)
6. **Colleague insight** — public activity from someone inside their organization (low content awareness, high person recognition — introduce by name)
7. **Counterpart insight** — activity from a peer at another organization in the same role (low activity awareness, high positional relevance — surface as a single peer example)
8. **No hook available** — open directly with value wedge + pillar

Each signal type requires a different opening posture. Applying a personal-insight opener to a company insight (or vice versa) will produce tone errors. Always match posture to signal type before writing the hook sentence.

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
[HOOK — outside-in signal, 1 sentence, framed per signal type (see §3.2–3.7)]
[BRIDGE — two stages:
    Stage A · Interpretation: what is specifically interesting or consequential about the signal
    Stage B · Relevance bridge: the buyer implication — what problem, priority, or opportunity this creates]
[VALUE — inside-out: value wedge or activated pillar, introduced as the natural resolution to BRIDGE]
[PROOF — EB sentence (gain or pain) + optional customer reference]
[CTA — specific, low-friction ask tied to HOOK or BRIDGE topic]
```

**Layer dependencies:**
- HOOK selects the signal and establishes posture (awareness level determines framing)
- BRIDGE must complete the logic: *outside-in signal → buyer implication → (sets up VALUE)*
- VALUE names the company and leads with outcomes, not features
- Without a coherent BRIDGE, HOOK and VALUE are two disconnected statements

**Tone rule by signal proximity:**
- Personal → warmer, more direct acknowledgment
- Company → observational, tentative on operational implications
- Industry / Role → informative, distilled, invitation to compare
- Colleague / Counterpart → connective, one-example framing, no peer pressure

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
