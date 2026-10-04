# ☪ The Messaging Quran
## Whyhello Messaging Logic — Master Reference

> بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
> *In the name of relevance, the compassionate, the specific.*

> **Status:** Living scripture. Reflects logic implemented in `artifacts/contact-db/src/pages/HQ.tsx`, `ContactProfile.tsx`, and `artifacts/api-server/src/routes/` as of August 2026. All future messaging changes must be revealed here first, before they descend into code.

> **Scope:** "Messaging" in Whyhello is an umbrella for every customer-facing or seller-enablement output the platform generates — not just emails. Current output types: Cold Outreach Email, Battlecard (PPTX). Forthcoming: One-page PDF, Talk Track, LinkedIn Message, Meeting Prep Brief. Each output type shares the same signal selection philosophy and inside-out/outside-in blend engine, but renders it through a format-appropriate structure and register.

---

<div align="center">❊ ❊ ❊</div>

## Surah 1 · Al-Falsafa — The Philosophy
### *The Inside-Out / Outside-In Blend*

### 1.1 The Blend

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

### 1.2 Output Type Taxonomy

Every output Whyhello generates is an expression of the same underlying blend — outside-in signal selection applied against inside-out positioning — rendered through a format appropriate to its audience and use case.

| Output Type | Format | Primary Audience | Register | Purpose |
|---|---|---|---|---|
| **Cold Outreach Email** | Text / Markdown | Buyer | Conversational, direct | Open a new relationship or reactivate a dormant one |
| **Battlecard** | PPTX (one slide) | Seller | Informational, structured | Pre-meeting intelligence brief — what to lead with and why |
| **LinkedIn Message** | Plain text | Buyer | Informal, brief | Create an initial connection or bridge from email |
| **Talk Track** | Structured prose | Seller | Spoken-word, natural cadence | Prepare the seller for a live conversation or discovery call |
| **One-Page PDF** | PDF | Buyer / Seller | Clean, visual | Leave-behind or send-ahead summary of the value proposition |
| **Meeting Prep Brief** | Text / Markdown | Seller | Analytical | Contextualise the meeting: who is in the room, what signals are live, what to say |

> **Governing rule:** Every output type shares the same signal selection engine (Surah 3–5) and the same inside-out content model (Surah 2, 6). What differs across types is the **rendering layer** — how the blend is expressed in structure, length, register, and format. Format does not change what is true; it changes how that truth is presented.

**Buyer-facing outputs** (Email, LinkedIn, One-Page PDF) must comply with all hook framing rules in Surah 3 — they are messages the contact will read, so posture, tone, and awareness accuracy are non-negotiable.

**Seller-facing outputs** (Battlecard, Talk Track, Meeting Prep Brief) surface the same underlying intelligence but in a reference format — dense, scannable, labelled. They are not bound by email hook conventions, but the signal selection and relevance logic that governs what to surface is identical.

---

<div align="center">❊ ❊ ❊</div>

## Surah 2 · Al-Dakhili — The Internal
### *Inside-Out Inputs: The HQ Data Model*

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
  companyId: number | null;      // optional link to Whyhello's company database
  companyName: string;
  companyIndustry: string;
  companySize: string;
  companyHeadquarters: string;
  testimonialAttribution: "named" | "anonymized";
  anonymizedCustomerLabel: string; // safe replacement, e.g. "a large retailer in North America"
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

#### Law of Testimonial Attribution

Every customer proof point must carry an explicit attribution permission:

- **Named** — messaging may identify the company using the stored customer profile.
- **Anonymized** — messaging must never reveal the company name or identifying details. It must use `anonymizedCustomerLabel`; if that label is blank, use the generic phrase “an anonymized customer.”

Attribution permission governs the transformation, results, economic benefits, and direct quote as one indivisible proof point. A verbatim quote does not override an anonymization requirement.

When a customer is matched to Whyhello's company database, Industry, Company Size, and Headquarters are copied into the proof point. These attributes generate the default anonymous description in the form:

> A [size] [industry company type] headquartered in [location]

For example: “A large technology firm headquartered in the United States.” The user may edit this description, but generated messaging must use the stored anonymous description rather than reconstructing or exposing the linked company name.

After testimonial extraction, the system should use the explicitly stated company name to search Whyhello's company database automatically. Link only an exact case-insensitive name match. When no exact match exists, retain the extracted name and present search candidates for user correction; never silently link a merely similar company.

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

<div align="center">❊ ❊ ❊</div>

## Surah 3 · Al-Khariji — The External
### *Outside-In Inputs: Platform Signal Types*

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

These six principles apply to every outside-in signal, regardless of type.

**Ayah 1. Respect the buyer's proximity to the signal.**
Never explain the buyer's own work back to them. Avoid treating company news as a revelation to an insider. Provide more context only as the signal moves farther from their immediate orbit.

**Ayah 2. Prove relevance through specificity.**
Reference the particular quote, idea, event, finding, or decision that matters. `"I enjoyed your podcast"` is weak. `"Your point about advisors losing ownership of the client experience stayed with me"` proves attention.

**Ayah 3. Interpret rather than merely summarize.**
Whyhello should explain what stood out or why the signal matters. The message should add a useful observation rather than repeat the source.

**Ayah 4. Use the signal as a premise, not decoration.**
The insight should create a logical reason to introduce the seller's internal signal. It should not feel like personalization pasted onto an unrelated pitch.

**Ayah 5. Avoid false familiarity.**
Do not imply that the seller knows what the buyer thinks, knows, or is currently prioritizing. Use language such as *"It made me wonder,"* *"This may be relevant,"* and *"I could see this affecting…"*

**Ayah 6. Preserve conversational momentum.**
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

**Governing formula:** Recognition + specific evidence + genuine reaction. 1–2 sentences. "I" is permitted. The hook must sound like something the sender would still send even if no pitch followed.

**Recommended framing:**
- *"Came across your [post/interview/podcast] on [topic]. Your point about [specific idea] really stood out."*
- *"Really enjoyed your perspective on [topic], particularly your observation that [specific point]."*
- *"Your recent [post/interview] on [topic] caught my attention — particularly the way you framed [specific idea]."*
- *"I appreciated your comments on [topic], especially the distinction you made between [X] and [Y]."*
- *"You made an interesting point recently about [specific idea]. It stayed with me because [brief interpretation]."*
- *"I came across your conversation with [interviewer/publication]. Your comment that '[short quotation]' was a sharp way of capturing [issue]."*
- *"Your post about [topic] stood out, especially the way you connected [X] with [Y] — that's a connection people often miss."*

For attributable quotes — always cite the source platform. After invoking the quote, a single short reaction sentence names the specific takeaway. No "— that stayed with me" preamble. No restating what the quote said.
- *"Came across your post on [Source]: '[quote]' I really appreciated the highlight on [key takeaway]."*
- *"Saw your [Source] note on [topic]: '[quote]' That framing of [specific idea] stood out to me."*
- *"Came across your [Source] piece: '[quote]' Really appreciated the way you put [specific tension] into words."*
- *"Your [Source] post caught my eye: '[quote]' I thought the emphasis on [specific point] was sharp."*
- Wrong: *"[quote] — that stayed with me. The way you highlighted X makes clear that Y."* — too long, restates the quote.

**Avoid:**
- Fragment sentences or bare observations with no human voice ("A post that discusses X.")
- Generic praise such as "Great post!"
- Long summaries of what the contact already said
- Claiming agreement without demonstrating understanding
- Excessive flattery
- Implying the buyer should be interested in their own content

**Internal bridge logic:**
> You expressed X → X has an implication for Y → we help address Y.

*Example: "Your point about advisors needing greater ownership of the client experience stood out to me. That same issue tends to surface when teams evaluate how much flexibility their current platform actually gives them."*

---

### 3.2.1 Engaged LinkedIn Posts — A Weaker Personal Signal

Some personal LinkedIn records point to a post authored by someone else that the contact commented on, liked, or otherwise engaged with. These are not equivalent to the contact's own posts.

**Required distinction:**
- Treat the third-party post as background context, not as the contact's viewpoint.
- Use the contact's own visible comment as the primary evidence when it is substantive.
- A short social response such as “congratulations,” “well done,” “happy anniversary,” or “welcome” is not an actionable insight.
- If the contact's comment is not visible or contains no business substance, say so plainly and lower confidence rather than inferring priorities from the post.
- A third-party post may be useful when it directly quotes the contact, but it remains one step removed from a contact-authored post.

**Seller posture:** Contextual observer. Acknowledge the contact's interaction only when it creates a credible bridge to the seller's HQ; do not imply that the contact endorsed the third-party post or shares its author's perspective.

**Governing formula:** Contact interaction + evidence-strength assessment + conditional HQ bridge. If the interaction is merely social, the correct conclusion may be that there is no actionable personal signal.

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

**Governing formula:** Discovery + useful substance + reason for sharing. Should sound like a thoughtful colleague dropping something relevant into Slack — low ceremony, immediately relevant, no premature sales tone.

**Recommended framing:**
- *"Thought I'd pass this along — there's an interesting take on [specific issue] that seems relevant to [their world]."*
- *"Not sure if this has crossed your desk yet, but there's an interesting finding here around [specific development]."*
- *"You're likely already close to this, but I thought this outside perspective was worth sharing."*
- *"This caught my attention because it connects [development] with [buyer responsibility or implication]."*
- *"You may have already seen the broader news, but this particular take on [topic] seemed worth passing along."*

**Avoid:**
- *"Did you know your company…?"* / *"In case you weren't aware…"*
- Fragment sentences or bare observations with no human voice
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

**Governing formula:** Discovery + useful substance + reason for sharing. The sender earns attention by finding, filtering, and interpreting. Should feel like a useful drop into someone's inbox, not a manufactured entry point.

**Recommended framing:**
- *"Came across this piece on [topic] and thought it might be useful given your work around [relevant responsibility]."*
- *"Not sure if this has crossed your desk yet, but there's an interesting finding here around [specific finding]."*
- *"I found this analysis of [topic] particularly useful. The part about [specific detail] seemed especially relevant."*
- *"Passing this along because it puts some useful numbers behind [challenge or trend]."*
- *"One finding in this [report/article] stood out: [concise finding]. I thought you might find it useful given [relevance]."*
- *"This may already be on your radar, but I thought the section on [specific issue] was worth sharing."*

**Avoid:**
- Fragment sentences that function as link labels, not hooks ("A report that [explores X].")
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

**Governing formula:** Discovery + useful substance + reason for sharing. Validate lived experience; quantify or reframe a familiar tension. Invite comparison with the buyer's own reality.

**Recommended framing:**
- *"Came across this benchmark on how [role] leaders are approaching [challenge] — thought it might be useful."*
- *"Passing this along because it puts some useful numbers behind [challenge or trade-off]."*
- *"You'll know this far better than I do, but this finding was interesting given [context]."*
- *"Not sure if this has crossed your desk, but there's an interesting tension flagged here around [specific issue]."*
- *"I found this [report/study] worth sharing — particularly the section on [specific finding]."*

**Avoid:**
- Fragment sentences or bare link labels with no human voice
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

Configured Manual Email previews resolve a colleague's current identity through the original contact-insight URL and confirm that the source still belongs to the recipient's company. If the named source cannot be resolved, omit that peer evidence instead of producing anonymous or recipient-attributed personalization.

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

**Governing formula:** Discovery + useful substance + reason for sharing. Bring forward an idea already present inside the buyer's organization — low ceremony, no manufactured significance.

**Recommended framing:**
- *"Came across [Name]'s [interview/post] on [topic] and thought it might be worth passing along given your work on [relevant area]."*
- *"[Name] made an interesting point recently about [topic] — thought it might be relevant to you."*
- *"Not sure if you caught [Name]'s discussion of [topic], but there's a useful angle here on [specific issue]."*
- *"A theme raised by someone elsewhere in your organization caught my attention — particularly the point about [specific idea]."*

**Avoid:**
- *"Your company believes…"* based on one person's statement
- *"I've been speaking with your colleague…"* when that is untrue
- Suggesting the contact should already have seen the content
- Using senior leadership's comments to pressure a more junior contact
- Revealing or implying confidential conversations
- Name-dropping without a substantive connection

**Internal bridge logic:**
> Your colleague raised X → X may also touch your area through Y → we have a relevant perspective on Y.

**Direct-quote and segue rule:**
- Assume the contact has not encountered the specific colleague insight, even if they may recognize the colleague or the broader topic.
- Explicitly identify the source as the contact's colleague inside the contact's company; do not assume the contact will infer that relationship from the person's name or title.
- When a verified direct quote is available, name the colleague and use the exact quote before adding a short interpretation.
- Include the colleague insight's exact public URL once behind natural anchor text, framed as optional further reading so the contact can look into the source if they want more context. Do not use a bare URL or make the link the CTA.
- Follow the interpretation with a natural, non-leading question such as *"Is this something you're seeing as well?"* or *"Does that theme show up in your area too?"*
- The question is a bridge into relevance, not a CTA. It must not imply company-wide agreement, a private referral, or a request for confidential internal information.

*Example: "I came across Sarah Chen's interview on preserving advisor identity during a firm transition. Her point about continuity extending beyond account transfer seemed particularly relevant to the teams responsible for recruiting and onboarding new practices."*

---

### 3.7 Counterpart Insights

Configured Manual Email previews likewise resolve the named source person dynamically before using counterpart evidence. Their CTA asks whether a broader industry observation resonates; it must not imply that the recipient knows the source person or has already discussed the observation.

Every generated preview citation must resolve to supplied evidence before the preview is returned. A shortened numeric citation may be accepted only if it uniquely identifies one supplied source, and is then rewritten to that source's canonical ID. Unknown or ambiguous citations fail generation instead of silently hiding used evidence.

The platform name is not the seller's identity. Use only a supplied seller identity, omit an unknown sender's named signature, and reject unfilled sender/contact placeholders in AI output. Research summaries may be paraphrased but are not verified verbatim quotations.

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

**Governing formula:** Discovery + useful substance + reason for sharing. Surface what peers are trying or questioning — frame as one example, not market consensus.

**Recommended framing:**
- *"Came across an interesting perspective from another [role] in your space — thought it might be worth sharing."*
- *"Passing this along because it came from someone dealing with a very similar mandate to yours."*
- *"[Name], who leads X at Y, recently described an approach to [challenge] that caught my attention."*
- *"It is only one example, but their take on [topic] raised an interesting question I thought might be relevant to you."*
- *"Not sure if this has crossed your desk, but one of your counterparts is taking an interesting approach to [problem]."*

**Avoid:**
- *"Your competitors are all doing this."*
- *"You're falling behind."*
- Invented peer pressure or unsupported market consensus
- Sharing confidential client information
- Assuming two roles are equivalent based only on job title
- Treating a counterpart's stated initiative as a proven success

**Internal bridge logic:**
> A comparable leader is approaching X through Y → this suggests an emerging option or question → we can help the buyer evaluate or pursue it.

**Direct-quote and segue rule:**
- Assume the contact has not encountered the specific counterpart insight. Present it as one public example from a comparable role, including a competitor when that is the available context.
- Explicitly identify the source as a counterpart or peer in a similar role at another company, naming the company and same-industry or adjacent-industry context when available; do not assume the contact will infer that relationship from the person's name or title.
- When a verified direct quote is available, name the counterpart and use the exact quote before interpreting what is relevant about it.
- Include the counterpart insight's exact public URL once behind natural anchor text, framed as optional further reading so the contact can look into the source if they want more context. Do not use a bare URL or make the link the CTA.
- Follow the interpretation with a natural comparison question such as *"Is this resonating with you and your company as well?"* or *"Is this also on your radar?"*
- Treat the counterpart as one peer signal, never as proof that the contact is behind or that all competitors agree. The question should invite reflection without manufacturing pressure or asking for confidential information.

*Example: "I came across an interview with another head of advisor recruitment who is treating transition support as part of the recruiting proposition rather than a post-signature process. It is only one example, but it raises an interesting question about where firms can create differentiation before an advisor makes a decision."*

---

### 3.7.1 Single Message Variant Coverage

When a user runs a Single Message job, Whyhello may generate one additional message for each insight category that was not used by the primary message. Variant coverage includes Personal, Company, Industry, Role, Colleague, and Counterpart signals whenever that category has an available insight.

Colleague and Counterpart are not optional or lower-priority variants. If relevant relationship signals exist, each receives its own entry-point message using the highest-scoring available insight for that category and the relationship-specific framing rules above. A fixed total-variant cap must not silently remove either relationship category.

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

**The authority posture of the bridge**

The bridge is a hypothesis, not a confirmed fact — but it is an *informed* hypothesis, grounded in pattern recognition and domain expertise. It should not read like guesswork or hedging, nor should it read like certainty the sender cannot justify. The right register is calibrated authority: the voice of someone who has seen this pattern before and is offering a considered observation, not claiming to know the buyer's situation better than they do.

**Bridge Starter Library**

Use one of the following frames to open the bridge. Vary the opener across emails — the same frame should not appear in consecutive messages from the same sender.

| Starter | When to use |
|---|---|
| *"What we tend to see in situations like this is…"* | Pattern-based inference from a recurring dynamic |
| *"A common pattern here is…"* | Similar to above; slightly more direct |
| *"When this comes up, the next challenge is often…"* | Sequential pressure — one event typically triggers another |
| *"This is often where [X] begins to affect [Y]."* | Two functions or forces whose interaction is predictable |
| *"The practical implication is often…"* | Grounding an abstract signal in an operational consequence |
| *"That can create added pressure around…"* | A development that compounds an existing tension |
| *"One likely consequence is…"* | A single downstream effect stated with measured confidence |
| *"Depending on [relevant condition], that could mean…"* | Conditional framing — acknowledges context without abandoning the hypothesis |
| *"While every situation is different, we often see…"* | Explicitly signals expertise while respecting the buyer's uniqueness |
| *"It made me wonder whether this is also creating…"* | Softest frame — invites rather than asserts; use when the inference is more speculative |

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

### 3.11 Source Link Inclusion — Company, Industry, and Role Signals

When a message opens with a Company, Industry, or Role insight as the HOOK, Whyhello includes the source URL in the buyer-facing email body. This is an expression of the awareness posture these signal types carry: the seller is surfacing something the buyer may not have seen, and offering them the chance to go deeper is consistent with that posture. It adds generosity without adding friction.

**Why these three types — and not Personal, Colleague, or Counterpart:**

- **Personal** — the buyer created or said it. Linking back to their own content would be unnecessary at best and condescending at worst.
- **Colleague / Counterpart** — the content belongs to someone else in their orbit. Passing along a colleague's LinkedIn post or a peer's interview introduces a third party in a way that can feel awkward. The link is omitted.
- **Company / Industry / Role** — the buyer may not have encountered this specific article, report, or data source. Offering the link is genuinely useful and positions the seller as a resourceful observer rather than someone who merely name-drops a source.

**Placement — two styles, distributed evenly across generated emails:**

The placement style is selected randomly at generation time, with equal probability between the two options. This prevents the link from feeling like a templated feature.

**Style A — Inline (within the HOOK sentence)**

The link is embedded directly inside the HOOK sentence using **active verb anchor text** — a short phrase that describes what the source does, woven naturally into the grammar of the sentence. The raw URL must never appear in the email body; it must always be hidden behind the anchor text.

The anchor text must be an active verb phrase, not a generic call-to-action. Standalone fragments like *"More here."*, *"Full piece here."*, or *"Read more."* are not permitted — they feel tacked on, make the URL visible or ominous in plain-text clients, and interrupt the sentence's rhythm.

**Correct — active verb, embedded in the sentence:**
- *"...a shift that [this Oliver Wyman report tracks closely](URL)."*
- *"...as [this Deloitte analysis explores](URL)."*
- *"...a tension [this piece digs into](URL) across a range of firms."*
- *"...a finding [this Fidelity research unpacks in detail](URL)."*
- *"...one [this study examines](URL) in the context of independent advisory growth."*
- *"...[worth reading in full](URL) if this is on your radar."*

**Incorrect — standalone fragments or passive anchors:**
- ~~*"More here."*~~
- ~~*"You can read more about it here."*~~
- ~~*"Full piece here if it's useful."*~~

Rendered as markdown: `[anchor text](URL)`. Placed mid-sentence or at the clause boundary — not after a full stop as a standalone fragment. Only appears in HOOK, not in BRIDGE or VALUE.

**Style B — Postscript (after the CTA)**

The link appears as a P.S. on a new line after the CTA, preceded by a blank line. Whyhello messages do not include a personal sign-off, signature, or sender name. The P.S. must connect back to the specific source referenced in the HOOK, and the raw URL must never appear — it must always be hidden behind active verb anchor text using markdown: `[anchor text](URL)`.

Anchor text must describe what the piece does. Generic prompts like *"click here"*, *"read more"*, or bare URLs are not permitted.

**Correct — active verb anchor, URL hidden:**
- *"P.S. The piece I mentioned above is [worth reading in full](URL) if this is on your radar."*
- *"P.S. Full report — [digs into this in more detail](URL) if useful."*
- *"P.S. The article above [covers this in depth](URL) if you'd like more context."*
- *"P.S. [The full piece is here](URL) — goes deeper on the numbers if it's of interest."*

**Incorrect — raw URL exposed:**
- ~~*"P.S. Full piece on the article I mentioned above, in case it's useful: https://..."*~~
- ~~*"P.S. Link to the report I mentioned above: https://..."*~~

**Constraints:**

- The URL is used exactly once. It does not appear in both the body and the P.S.
- The URL is used verbatim — it must not be modified, shortened, or substituted.
- The link must be absent if the HOOK signal is Personal, Colleague, or Counterpart.
- The link must be absent if no URL is available for the chosen signal.
- The phrasing around the link must vary between messages; the same anchor text or P.S. opener should not appear in consecutive emails from the same sender.

---

<div align="center">❊ ❊ ❊</div>

## Surah 4 · Al-Iqtibas — The Quotation
### *Attributable Quotes*

Attributable quotes are a distinct enrichment layer extracted from insight content. They are not signals in themselves — they are **the most usable surface of a signal**: a verbatim or near-verbatim statement that a named person actually said, wrote, or was quoted saying, ready to open a message without further interpretation.

### 4.1 What Qualifies as an Attributable Quote

A quote is valid if it meets all three criteria:

1. **Directly attributed** — a named person (the contact, a colleague, a counterpart, a company spokesperson, or an industry voice) is the speaker or source
2. **Specific enough to open a message** — it must be usable as a conversation opener in a B2B outreach email without feeling generic
3. **Verbatim or near-verbatim** — not a paraphrase or headline summary; it must feel like something a real person actually said

Quotes that fail these criteria are discarded. Generic headlines, summary sentences, and paraphrased conclusions do not qualify.

### 4.2 Extraction Process

Quote extraction is triggered automatically once per contact when insights finish loading and no quotes have been stored yet. It can be manually re-triggered at any time via the Quotables panel in the contact sidebar.

**Signal scope (current):** Only the contact's personal LinkedIn posts (`media_type = linkedin` or `linkedin_post`) are scanned. The post body text is fetched live at extraction time directly from the LinkedIn URL — the stored `description` field is not used, as it is often unpopulated. This scope is intentionally narrow while the extraction quality is being validated; additional signal types (blog posts, newsletters, podcasts, third-party coverage) will be added once LinkedIn extraction is confirmed reliable.

**Priority within extraction:** Quotes from or about the contact are surfaced first. Colleague and counterpart quotes follow. Company, industry, and role sources are included but ranked lower.

**Maximum output:** 8 quotes per extraction run. Quality over quantity — the extraction rejects anything that does not meet the validity criteria above.

**Upsert behaviour:** Each extraction run deletes the existing stored quotes for that contact and inserts a fresh set. Quotes do not accumulate across runs.

### 4.3 AI Extraction Prompt

The extraction uses a single AI call with the following instructions:

- Scan the numbered signal blocks (title + description per signal) for directly attributable statements
- For each valid quote: record the verbatim text, the full name of the speaker, their role if known, the signal type, and the signal ID
- Write an `hqBridge` sentence (max 25 words) connecting what the speaker said to one concrete aspect of the seller's HQ profile — naming actual products, pillars, or differentiator phrases, not generic categories
- List `matchedHqSignals`: the specific HQ items referenced (product names, pillar names, differentiator phrases)
- If a signal contains no clearly attributable statement, omit it entirely — fabrication is prohibited
- Return a JSON array; empty array if nothing qualifies

The HQ context passed to the extraction prompt includes: company name, value wedge, positioning, differentiators, pillars, and the first two products with their outcomes.

### 4.4 Data Model

Stored in the `insight_quotes` table, scoped to `contactId`.

```typescript
interface InsightQuote {
  id: number;
  contactId: number;         // FK → contacts.id
  signalType: string;        // "personal" | "company" | "industry" | "role" | "colleague" | "counterpart"
  signalId: number;          // ID of the source insight row
  quote: string;             // verbatim or near-verbatim text
  attribution: string;       // full name of the person quoted
  attributionRole: string | null;    // their title or role at time of quote
  hqBridge: string | null;           // one sentence connecting quote to seller HQ messaging
  matchedHqSignals: string[];        // specific HQ items referenced (JSON-serialised in DB)
  computedAt: Date;
}
```

**`hqBridge` examples:**
- *"Your point about advisory independence maps directly to how Richardson Wealth positions its practice-ownership model."*
- *"This tension — autonomy vs. infrastructure — is exactly what Whyhello's relationship intelligence layer is built to resolve."*

The `hqBridge` is the bridge that converts a cold quote into a warm opener: the AI reads it to know how to transition from the HOOK into VALUE without an abrupt pivot.

### 4.5 Use in Message Generation

When `runGeneration` executes an outreach job, it loads the stored quotes for that contact alongside the insights. Quotes are injected into the system prompt as a dedicated **ATTRIBUTABLE QUOTES** section — positioned before the SELECTED SIGNALS section and labelled as the highest-priority HOOK material.

**Prompt placement:** Above all other outside-in content, clearly separated.

**Formatting in prompt:**
```
[1] "The real risk isn't the move — it's the 90 days after."
    — Sarah Chen, Head of Advisor Recruiting
    Source: LinkedIn
    HQ Bridge: This directly maps to the transition continuity gap Richardson Wealth's onboarding model addresses.

[2] "Advisors don't leave firms, they leave constraints."
    — James Park, Director of Practice Development
    Source: LinkedIn
    HQ Bridge: Aligns with the autonomy pillar and the platform's advisor-ownership positioning.
```

**Instructions given to the AI:**
- When a quote fits, open the HOOK with it — do not use it mid-email
- Always cite the source platform explicitly in the opener — the contact should immediately know where the quote came from. Each stored quote carries a `Source` label (e.g. "LinkedIn") that the AI uses to name the platform.
- Recommended starters:
  - *"Came across your post on LinkedIn re: [topic]: '[quote]' — that stood out."*
  - *"Saw your [source] post on [topic]: '[quote]' — that's a real tension."*
  - *"Your [source] note on [topic]: '[quote]' — that's a sharp framing."*
- Read the HQ Bridge note to know how to transition into VALUE
- Only use a quote when it genuinely elevates the message; never force one

**Priority in hook selection:** A direct quote attributed to the contact outranks every other outside-in signal type (personal insight, company insight, industry insight, etc.).

### 4.6 UI: Quotables Panel

The Quotables panel appears in the contact profile sidebar when at least one quote has been extracted or extraction is in progress.

Each quote card displays:
- Quote text (verbatim, with a quotation mark icon)
- Attribution line: speaker name · role
- Signal type badge (Personal / Company / Industry / Role / Colleague / Counterpart)
- HQ Bridge sentence (violet callout)
- Matched HQ signal tags (product names, pillar names, differentiators)

A **Re-extract** button re-runs the extraction against the current signal set. This is useful after new insights are added or after the HQ profile is updated (which would change the HQ bridges).

### 4.7 Quote Quality Rules

**What makes a quote worth using:**
- It expresses a tension, a belief, a frustration, or a priority — not a fact
- It could plausibly start a meaningful conversation with this person
- It contains enough specificity to signal genuine research
- The speaker's identity is relevant to the contact (they said it, or someone in their orbit said it)

**What disqualifies a quote:**
- Generic statements the contact would not recognise as distinctively theirs (*"Digital transformation is a priority"*)
- Statements pulled from headline summaries rather than direct speech
- Quotes where the speaker cannot be identified
- Quotes that require private or confidential context to interpret
- Statements that would embarrass, expose, or pressure the contact

### 4.8 Relationship to Outside-In Framing Rules

Quotes are subject to the same per-type framing rules as other signals (Surah 3.2–3.7) but with one additional constraint: because the quote is the most personal signal type, the **Personal framing rules apply by default** regardless of which signal type the quote was extracted from.

The only exception: if a quote is attributed to a colleague or counterpart (not the contact), apply the **Colleague** or **Counterpart** framing rules respectively when opening with it.

---

<div align="center">❊ ❊ ❊</div>

## Surah 5 · Al-Mazj — The Blend
### *Signal Resolution Rules*

When generating a message, the engine resolves outside-in signals into inside-out selections using the following priority order.

### 5.1 Product Selection

1. Match contact's buying center seat (from HQ `BuyingCenterConfig`) to the product whose `persona` field best aligns.
2. If no direct seat match, fall back to `TargetMarketConfig` — choose the product associated with the matched target market.
3. If still ambiguous, default to the first product.

### 5.2 Economic Benefit Selection

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

### 5.3 Messaging Pillar Selection

Map the contact's role archetype to the most relevant messaging pillar:

1. Scan the three `company.pillars` for semantic alignment with the contact's inferred priorities.
2. Select the pillar whose language most closely reflects what the outside-in signals indicate this person cares about.
3. Use the selected pillar as the **thematic anchor** of the message body — it should be present, not necessarily quoted verbatim.

### 5.4 Social Proof Selection

From the `customers` array, select the proof point where `customerProfile` most closely matches the contact's company profile (industry + size + role type). Use that customer's:
- `customerTransformation` as the "before/after" narrative
- `results` as the supporting detail
- `customerQuote` as optional close
- Customer EBs as past-tense quantified validation of the product EB claim

When a customer quote is used, begin the testimonial snippet on its own line and keep it to a maximum of two sentences from that customer. The quote must follow the preceding customer-reference sentence as a separate paragraph; it must never be appended inline in the same paragraph or allowed to take over the message.

Before rendering the proof, enforce `testimonialAttribution`:
- For `named`, the customer/company may be identified.
- For `anonymized`, replace the identity with `anonymizedCustomerLabel` and suppress all stored names or identifying details. If no safe label exists, say “an anonymized customer.”

### 5.5 Hook Selection (Outside-In Lead)

A message should open with the most specific outside-in signal available. Signal type determines both priority and the correct awareness posture (see Surah 3.0):

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

<div align="center">❊ ❊ ❊</div>

## Surah 6 · Al-Qima — The Value
### *Economic Benefit Sentence Construction*

This is the core quantified-value rendering logic, implemented as a verb-extraction pipeline.

### 6.1 Verb Normalisation (`VERB_FORMS`)

All recognised verbs are registered in `VERB_FORMS` as a dictionary mapping **any surface form** (base, 3sg present, past, participle, gerund) to a `[present-3sg, simple-past]` tuple.

```
generate → generates / generated
reduce   → reduces   / reduced
eliminate → eliminates / eliminated
```

Coverage includes ~40 gain verbs and ~20 pain verbs. Any verb not in the dictionary falls back to the default:
- **Gain fallback:** `realizes` / `realized`
- **Pain fallback:** `eliminates` / `eliminated`

### 6.2 Verb Extraction (`descriptionToVerbPhrase`)

The description field is a free-text verb phrase written by the user (e.g. *"generates revenue from assets under management"*).

The algorithm:
1. Lowercase the description
2. Scan words left-to-right for the first word present in `VERB_FORMS`
3. If the verb is at position 0: the predicate is `conjugated_verb + rest_of_phrase`
4. If the verb is mid-phrase (e.g. *"revenue generated from assets"*): restructure as `conjugated_verb + pre-verb_words + post-verb_words` → *"generates revenue from assets"*
5. Apply tense: **present** for Products, **simple past** for Customers

### 6.3 Frequency Rendering (`frequencyPhrase`)

| Key | Rendered phrase |
|---|---|
| `yearly` | `yearly` |
| `monthly` | `monthly` |
| `weekly` | `weekly` |
| `one-time` | `one-time` |
| `per-transaction` | `per transaction` |

Frequency is chained directly to the amount and unit without a separating comma: **“$120,000 per $100M in AUM yearly”**, not **“$120,000 per $100M in AUM, each year.”**

### 6.4 Sentence Assembly

EB sentences must be **full declarative sentences**, not bare label fragments. Prefix with "Our [product name]" so the sentence reads naturally in an email.

**Gain (Product — present tense):**
```
Our [product name] {predicate}, gaining **{amount} {unit}** {freq}.
```
Example: *Our Advisor Partnership Platform protects recurring revenue by successfully transferring client assets, gaining **$9,000 per $1M of AUM retained** yearly.*

**Pain (Product — present tense):**
```
Our [product name] {predicate}, saving **{amount} {unit}** {freq}.
```
Example: *Our Advisor Partnership Platform eliminates manual compliance reporting, saving **$80K per advisor** yearly.*

**Gain (Customer — simple past):**
```
[permitted customer identity] {predicate}, gaining **{amount} {unit}** {freq}.
```
Named example: *Acme Corp generated revenue from assets under management, gaining **1.2% per $1M of net-new AUM** yearly.*

Anonymized example: *A large technology firm headquartered in North America generated revenue from assets under management, gaining **1.2% per $1M of net-new AUM** yearly.*

**Pain (Customer — simple past):**
```
[permitted customer identity] {predicate}, saving **{amount} {unit}** {freq}.
```
Named example: *Acme Corp eliminated manual compliance reporting, saving **$80K per advisor** yearly.*

Anonymized example: *A large technology firm headquartered in North America eliminated manual compliance reporting, saving **$80K per advisor** yearly.*

For every Customer EB sentence, the subject must be the linked company name when attribution is `named`, or the saved anonymous description when attribution is `anonymized`. If the anonymous description is blank, use “An anonymized customer.” Never begin an anonymized Customer EB sentence with the stored company name.

**Company-level proof (credentials, scale, differentiators):**
Use first-person "We" — never repeat the company name once the email is underway.
- Correct: *"We are Canada's largest independent wealth manager…"*
- Wrong: *"Richardson Wealth is Canada's largest independent wealth manager…"*

### 6.5 Unit Normalisation

- Leading `"Per"` → lowercased to `"per"` in sentence context
- All other unit casing preserved as entered

---

<div align="center">❊ ❊ ❊</div>

## Surah 7 · Al-Haykal — The Structure
### *Message Structure Templates*

### 7.1 Cold Outreach (Email / LinkedIn)

```
[HOOK — 1–2 sentences, framed per signal type (see Surah 3.2–3.7 and the two governing formulas below)]
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

### 7.2 Follow-Up / Nurture

```
[CALLBACK — reference prior interaction or shared context]
[RELEVANCE — new outside-in signal that has emerged since]
[DEPTH — go deeper on the previously introduced pillar]
[EB — second EB if first was gain, use pain; if first was pain, use gain]
[CTA]
```

### 7.3 Meeting Prep Briefing

```
[CONTACT SNAPSHOT — role, seniority, recent signals]
[COMPANY SNAPSHOT — industry, size, recent events]
[RECOMMENDED ANGLE — pillar + EB set to lead with]
[COMPETITIVE ALERT — any known competitor in play + avoid-claiming notes]
[SUGGESTED QUESTIONS — derived from customerPriorities field]
```

### 7.4 Competitive Response

```
[ACKNOWLEDGE — what the competitor is genuinely good at (theirStrengths)]
[REFRAME — shift to terrain where we win (ourStrengths / advantagesOverTime)]
[AVOID — suppress any claims in avoidClaiming]
[PROOF — customer EB that directly addresses the competitor's claimed strength]
```

### 7.5 Email Styling Rules

Whyhello emails use selective markdown formatting to guide the reader's eye toward the most signal-dense moments. Styling is intentional, not decorative — every bolded element must earn its weight.

**Current rules:**

**Rule S-1 — Bold all verbatim quoted text**
Any time a message includes a direct quote from the buyer or a named source, the quoted passage — including its surrounding quotation marks — is wrapped in `**double asterisks**` so it renders as bold.

*Applies to:* direct quotes drawn from the contact's own words (LinkedIn posts, interviews, articles, podcasts) or from a named colleague, counterpart, or industry source, set off in quotation marks inside the email body.

*Does not apply to:* paraphrases, summaries, the sender's own phrasing, or CTA option text.

Example:
> Came across your post on LinkedIn: **"Advisor independence means little without the infrastructure to act on it."** — that stayed with me.

*Rationale:* The quoted snippet is the single most credible element in the HOOK — it is the buyer's own words. Bolding it separates evidence from commentary, gives the eye a landing point, and signals that the sender actually read the source rather than skimming a headline.

**Rule S-2 — Double-space between all sections**
Every layer boundary — between HOOK and BRIDGE, BRIDGE and VALUE, VALUE and PROOF, PROOF and CTA — is separated by a blank line, producing a visible paragraph gap in the rendered email. This applies unconditionally: short emails, medium emails, and long emails all use the same spacing. Length setting controls how much each layer develops, not the spacing between them.

*Rationale:* Single-spaced sections create visual crowding and blur the four-stage arc. The blank line between sections gives each layer room to land before the next one begins. This is especially important on shorter emails, where compact layers can otherwise feel compressed.

**Future rules will be added to this section as the styling strategy develops.**

### 7.6 Single-Email Lengths

Length controls the depth of each message layer, not just the total number of words. Every single-email draft and its variants retain HOOK → BRIDGE → VALUE → PROOF → CTA, with blank lines between layers. Use verified proof only; do not invent a claim to fill a length target. The figures below count **visible email body copy only**, excluding the subject line and signature. Markdown emphasis and hidden source-link URLs are formatting, not visible body copy.

| Setting | Body target | Acceptable body range | Approx. words | Intended feel |
| --- | ---: | ---: | ---: | --- |
| Short | 450 characters | 350–550 | 60–90 | Punchy and highly skimmable |
| Medium | 750 characters | 600–900 | 100–145 | Conversational, enough room to develop an argument |
| Long | 1,150 characters | 950–1,300 | 160–210 | Insight-rich, more context and proof |

| Component | Short (~450) | Medium (~750) | Long (~1,150) |
| --- | ---: | ---: | ---: |
| HOOK | 70–100 | 100–140 | 130–180 |
| BRIDGE | 50–70 | 80–110 | 110–150 |
| VALUE | 120–150 | 190–240 | 280–350 |
| PROOF | 70–100 | 120–160 | 180–240 |
| CTA | 40–60 | 50–70 | 50–80 |

The component allocations are approximate proportions, not hard caps: their upper bounds do not sum to the medium and long overall targets. The **overall acceptable range takes priority**. Develop the value and proof (or grounded context when proof is limited) rather than adding filler or repeating the same email at greater length. Short still includes concise proof; medium develops the argument; long makes room for meaningful insight and evidence. Generated bodies outside the selected range are revised before they are saved, including a refreshed verbatim structure block.

---

<div align="center">❊ ❊ ❊</div>

## Surah 8 · Al-Sawt — The Voice
### *Voice & Tone Application Rules*

1. `toneTags` constrain word choice and sentence rhythm — applied globally to every output.
2. `communicationStyle` is passed as a system instruction to the generation layer.
3. `writingNotes` override defaults at the phrase level (e.g. "never use the word 'leverage'").
4. `suppressions` are enforced as a post-generation filter — any suppressed term triggers a rewrite pass.
5. `trainingText` is used as few-shot exemplar material — extract 2–3 representative passages as style anchors.

---

<div align="center">❊ ❊ ❊</div>

## Surah 9 · Al-Hukm — The Judgment
### *Constraint Hierarchy*

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

<div align="center">❊ ❊ ❊</div>

## Surah 10 · Al-Masa'il — The Questions
### *Open Questions & Future Decisions*

| # | Question | Impact |
|---|---|---|
| 1 | Should the buying center seat match override persona match when they conflict? | Product selection |
| 2 | How should the system behave when zero EBs are defined for the selected product? | EB sentence fallback |
| 3 | Should multiple pillars ever be combined in one message, or always one at a time? | Message density |
| 4 | How should the system handle contacts whose industry doesn't match any TargetMarketConfig? | Out-of-ICP routing |
| 5 | Should Customer EBs from a different industry be usable, with a proximity score? | Social proof selection |
| 6 | What is the maximum number of outside-in signals to surface in a single message before it feels surveillance-y? | Trust / tone |

---

<div align="center">❊ ❊ ❊</div>

## Surah 11 · Al-Tatbiq — The Implementation
### *Implementation Notes*

#### 11.1 Seller-reviewed Playbook email configuration

Manual Email remains a seller task, never an automatic send. Its inline step editor saves task creation/due timing separately, enabled state, and named A/B variants with integer traffic allocations totaling 100%. Disabled steps are excluded from activation readiness. Configuration changes remain unsaved until Save Changes; previews are not implicitly sent or activated.

Assisted, Prompt, and Template modes preserve compatible fields when switching. Assisted generation respects the selected email type, research sources, tone or HQ voice, inspected HQ context, and ordered guidelines. Only the signed-in user's explicitly live Target Market and Buying Center are included when selected; drafts and editor tabs do not activate audience context. Template previews resolve supported placeholders from the actual selected contact and fail explicitly for unavailable fields.

Preview generation is read-only against an owned Playbook and uses actual contacts, their selected research categories, and selected seller HQ inputs. Directory contacts may be used as clearly labeled samples without enrolling them. Outputs include subject, plain-text body, CTA, personalization rationale, and inspectable evidence actually cited by the model. Evidence IDs are checked against supplied research; invented insights are not displayed. Colleague/counterpart attribution is dynamically resolved through the original contact insight URL to a named source person; unresolved peer identity is omitted, not attributed to the recipient.

Regeneration changes the preview only, not the generation settings. Replacing an existing preview requires explicit confirmation. Generating does not block other editor controls. The explicit test-email action sends the current preview only to the signed-in user's server-resolved email address through that user's connected Gmail/Outlook mailbox. The client cannot choose an external test recipient. Missing preview, mailbox, identity, or provider authorization must fail explicitly without a send.

Activation checks each enabled variant's mode, timing, traffic allocation, and required content. Activation changes Playbook status only; this editor does not claim scheduled task execution or automatically deliver previews to enrolled prospects.

- **EB logic lives in:** `artifacts/contact-db/src/pages/HQ.tsx` — `VERB_FORMS`, `descriptionToVerbPhrase()`, `frequencyPhrase()`, `buildProductEBParts()`, `buildCustomerEBParts()`, `EBSummary`
- **Voice data lives in:** `DNAData.voice` — stored in `dna_profiles` table, retrieved via API
- **Contact/insight data lives in:** `ContactProfile.tsx` — `InsightItem`, `InsightCategory`
- **Blending logic (not yet implemented):** Will require a resolver function that accepts `{ contact, company, dna }` and returns a `MessageContext` object — the selected product, EB, pillar, proof point, and hook — before passing to a generation call.

---

<div align="center">❊ ❊ ❊</div>

---

<div align="center">❊ ❊ ❊</div>

## Surah 12 · Al-Haykal Al-Maktub — The Written Brief
### *Battlecard: Seller-Facing Intelligence Output*

The Battlecard is Whyhello's first non-email output type. It is a one-slide PowerPoint (PPTX) that surfaces the highest-relevance insight per signal category alongside the contact's details and relevance scores — formatted for a seller to scan before a call, share with a team, or print for a meeting.

> **Primary distinction from email:** The Battlecard is not a message the buyer reads. It is a reference tool the seller uses. The register shifts from conversational to informational. Hook framing rules (Surah 3) do not apply to the content rendered on the card. Signal selection rules (Surah 5) do apply — the same relevance logic that would select a hook for an email selects the lead insight for each card.

---

### 12.1 Purpose and Use Cases

| Use case | What the Battlecard provides |
|---|---|
| Pre-call prep | The single best insight per category and its relevance score — tells the seller which angle to lead with |
| Team briefing | A single file to share with a manager, solution engineer, or co-seller before a meeting |
| Account handover | A snapshot of what is known about the contact at the time of transfer |
| Pipeline review | A visual summary of signal depth — how many categories have live intelligence |

The Battlecard answers two questions for the seller:
1. **What do I know about this person?** — Contact details, signal categories, source titles.
2. **What should I lead with?** — The relevance score and matched HQ signals tell the seller which category is the strongest angle for this specific contact against this specific HQ profile.

---

### 12.2 Signal Selection Logic

Each of the four insight cards (Personal, Company, Industry, Role) shows the **single highest-relevance insight** for that category. Selection follows this logic:

1. Fetch all insights for the category.
2. Join against `insight_relevance_scores` for this contact.
3. Select the row with the highest `score`.
4. **Fallback:** If no relevance scores have been computed yet for this contact, select the first row in the category.

This is the same relevance signal that drives hook selection in email generation (Surah 5.5). The seller sees the same answer to "which insight should I lead with?" — whether they are composing an email or opening a PPTX.

> **Quotable boost effect on Battlecard selection:** When relevance scores are (re-)computed, insights with extracted Quotables receive a deterministic bonus on top of their HQ alignment score (provided the base HQ score is ≥ 20). The bonus is tiered by attribution proximity: **+35** when the quote is the contact's own words, **+20** when attributed to a third party. This means an insight carrying a direct quote from the contact is very likely to win its card slot — the Battlecard surfaces the most *actionable* signal per category, not merely the most topically adjacent one. See the Scoring Bible, Libro Cuarto-Bis for the full Quotable Bonus doctrine.

---

### 12.3 Slide Structure

The single slide is divided into four zones:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER BAND (dark navy)                              [BATTLECARD pill]  │
│  Contact full name (large)                           [Whyhello logo]     │
│  Job title · Company                                                     │
│  Seniority | Department | Industry                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  DETAILS BAR (light grey)                                                │
│  ✉ email   ✆ phone   ⌖ location   in linkedin   ⊕ website               │
├─────────────────────────────────────────────────────────────────────────┤
│  KEY INSIGHTS label                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  PERSONAL    │ │  COMPANY     │ │  INDUSTRY    │ │  ROLE        │   │
│  │  [title]     │ │  [title]     │ │  [title]     │ │  [title]     │   │
│  │  ──────────  │ │  ──────────  │ │  ──────────  │ │  ──────────  │   │
│  │  SUMMARY     │ │  SUMMARY     │ │  SUMMARY     │ │  SUMMARY     │   │
│  │  [desc]      │ │  [desc]      │ │  [desc]      │ │  [desc]      │   │
│  │  ──────────  │ │  ──────────  │ │  ──────────  │ │  ──────────  │   │
│  │  RELEVANCE   │ │  RELEVANCE   │ │  RELEVANCE   │ │  RELEVANCE   │   │
│  │  [score]     │ │  [score]     │ │  [score]     │ │  [score]     │   │
│  │  [signals]   │ │  [signals]   │ │  [signals]   │ │  [signals]   │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                                              Generated by Whyhello       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 12.4 Zone Rules

#### Header Band
- Background: dark navy (`#0F172A`)
- Contact name: large, white, bold
- Title line: `jobTitle · companyName` — muted slate
- Meta line: `seniority | department | industry` — darker slate, smaller
- **BATTLECARD pill:** red (`#E11D48`), top-right, white caps text — identifies the document type at a glance
- **Whyhello logo:** placed directly below the BATTLECARD pill, same width — co-brands the output without competing with the contact name

#### Details Bar
- Background: light grey (`#E2E8F0`)
- Fields: email, phone, location, LinkedIn, website — distributed evenly across the bar width
- **Clickable fields** (rendered as hyperlinks in the PPTX): email uses `mailto:`, LinkedIn uses the full URL from the database (not a stripped username), website uses the full URL
- Non-clickable fields (phone, location): rendered in dark text without hyperlink styling
- Clickable fields: rendered in blue (`#1E40AF`) to signal interactivity

#### KEY INSIGHTS Label
- Small, uppercase, tracked, muted — a visual section header only; no messaging content

#### Insight Cards
- Four cards, equal width, side by side
- Each card: coloured background + accent border, both keyed to signal type (see §12.5)

#### Footer
- `Generated by Whyhello` — right-aligned, small, muted — attribution only

---

### 12.5 Insight Card Anatomy

Each card has three content sections, separated by thin accent-coloured rules:

**1. Category label**
Uppercase, bold, in the category's accent colour. Values: `PERSONAL`, `COMPANY`, `INDUSTRY`, `ROLE`.

**2. Title**
The insight's title — rendered as a **blue hyperlink** to the source URL when available. Truncated to 120 characters. Bold, slightly larger than body text.

> The title is a **filing label** for the insight, not a hook or a headline the seller reads aloud. Its job is to identify the source so the seller can click through and verify.

**3. SUMMARY section**
- Section label: `SUMMARY` — small, uppercase, tracked, grey
- Thin accent rule beneath the label
- Content: the insight's `description` field, truncated to ~340 characters
- If no description is available: `"No summary available."` in muted italic
- Register: informational — this is the seller reading a summary of what the source says, not a hook

**4. RELEVANCE section**
- Section label: `RELEVANCE` — small, uppercase, tracked, grey
- Thin accent rule beneath the label
- **Score** (large, bold, colour-coded — see §12.6) followed by `/100` in muted small text
- **Relevance description** — why this insight scored highly against the HQ profile (generated by the relevance engine)
- **Matched HQ signals** — a dot-prefixed list of the specific HQ items that drove the score (product names, pillar names, differentiator phrases)
- If no relevance score has been computed: `"No relevance score computed yet."` in muted italic

**5. Source + date footer**
- Small, italic, muted — `source · publishedDate`
- At the bottom of the card; present only when the data is available

---

### 12.6 Relevance Score Colour Coding

The score number on each card is colour-coded to give the seller an immediate read on signal strength:

| Score range | Colour | Meaning |
|---|---|---|
| 75–100 | Green (`#16A34A`) | Strong signal — lead with this category |
| 50–74 | Amber (`#D97706`) | Relevant — worth mentioning |
| 25–49 | Orange (`#EA580C`) | Weak relevance — use with caution |
| 0–24 | Slate grey (`#94A3B8`) | Low relevance — not recommended as lead angle |

> **Seller instruction (implied by colour):** Lead with the green cards. Amber cards are supporting material. Orange and grey cards are available but should not anchor the opening.

---

### 12.7 Signal Type Colour System

Each insight category has a consistent colour identity used for the card background, border, category label, and matched HQ signal tags:

| Category | Background | Border | Label / Tag colour |
|---|---|---|---|
| PERSONAL | Indigo 50 (`#EEF2FF`) | Indigo 400 (`#818CF8`) | Indigo 700 (`#4338CA`) |
| COMPANY | Amber 50 (`#FFFBEB`) | Amber 400 (`#F59E0B`) | Amber 800 (`#92400E`) |
| INDUSTRY | Green 50 (`#F0FDF4`) | Emerald 400 (`#34D399`) | Emerald 800 (`#065F46`) |
| ROLE | Violet 50 (`#F5F3FF`) | Violet 400 (`#A78BFA`) | Violet 900 (`#4C1D95`) |

These colours mirror the signal-type colour system used in the contact profile UI — a seller who uses both surfaces will develop the same colour-to-category associations across the platform.

---

### 12.8 Generation Flow

The Battlecard is generated as an outreach job — it enters the same `outreach_jobs` queue as email generation and appears in the Generated list with the same status lifecycle (`generating` → `completed` | `failed`).

**Generation steps:**
1. Seller clicks "Generate Battlecard" in the Battlecard modal on a contact profile
2. A job is created immediately with `type: "battlecard"`, `status: "generating"`, `title: "Battlecard — [Contact Name]"`
3. The modal closes; the Generated list shows an animated "Building your battlecard…" card
4. The server's `runGeneration()` detects `type === "battlecard"` and calls `generateBattlecardBuffer(contactId)`
5. The PPTX buffer is base64-encoded and stored in the job's `result` field; status is set to `"completed"`
6. The Generated list card transitions to a "Download PPTX" button
7. Clicking "Download PPTX" decodes the base64 result in the browser and saves a `.pptx` file

**Key constraint:** The PPTX is generated server-side and stored as base64 in the DB. No temporary file path is used. The Whyhello logo is loaded from disk once at module initialisation as a base64 data URI and embedded into the PPTX at generation time — it is never resolved at request time.

---

### 12.9 What the Battlecard Is Not

| It is not… | Because… |
|---|---|
| A buyer-facing message | The hook framing rules (Surah 3) do not apply — the insight titles and summaries are displayed as raw intelligence, not as crafted openers |
| A competitive battlecard | Despite the name, it does not currently contain competitor objection handling or displacement plays — it is a signal intelligence summary. Competitive content (Surah 2.6) is a planned addition. |
| A replacement for the email | The Battlecard and the email serve different moments — the card preps the seller before a call; the email opens the relationship with the buyer |
| A permanent record | The Battlecard reflects the best available signals at generation time. Relevance scores may change as the HQ profile evolves. Re-generate before any significant meeting. |

---

### 12.10 Future Additions to the Battlecard

| Addition | What it adds |
|---|---|
| Competitive section | A card per relevant competitor: their strengths, when they win, what to avoid claiming, and the HQ counter-position |
| Talk track | A prose block suggesting how to open the conversation based on the top-scoring insight |
| Buyer sentiment summary | A short AI-generated paragraph synthesising all four signal categories into a single "what we know about this contact" statement |
| Multi-contact version | A briefing slide per contact in a buying committee — for complex deals with multiple stakeholders |

---

*The Messaging Quran is a living scripture. It does not describe what Whyhello once did — it prescribes what Whyhello must do. Revise it before revising the code.*
