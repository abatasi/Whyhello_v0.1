import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contactsTable,
  companiesTable,
  contactInsightsTable,
  companyInsightsTable,
  industryInsightsTable,
  roleInsightsTable,
  colleagueInsightsTable,
  counterpartInsightsTable,
  outreachJobsTable,
  messagesTable,
  dnaProfilesTable,
  insightQuotesTable,
  insightRelevanceScoresTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

export const contactJobsRouter: IRouter = Router({ mergeParams: true });
export const jobsRouter: IRouter = Router({ mergeParams: true });

type InsightRow = { id: number; title: string; source: string; url?: string | null; description?: string | null; publishedDate?: string | null; mediaType?: string | null };

function fmtInsight(i: InsightRow, showUrl = false) {
  const base = `  • "${i.title}" (${i.source}${i.publishedDate ? ", " + i.publishedDate : ""})${i.description ? "\n    " + i.description : ""}`;
  return showUrl && i.url ? `${base}\n    URL: ${i.url}` : base;
}

// ── DNA / seller-context types (mirrors HQ.tsx) ───────────────────────────

interface EconomicBenefit { id: string; description: string; amount: string; unit: string; frequency: string }
interface Product { id: string; name: string; tagline: string; features: string; outcomes: string; persona: string; economicBenefits: EconomicBenefit[] }
interface Customer { id: string; customerProfile: string; results: string; customerTransformation: string; customerQuote: string; economicBenefits: EconomicBenefit[] }
interface SellerDNA {
  company: { name: string; valueWedge: string; positioning: string; differentiators: string; pillars: [string, string, string] };
  products: Product[];
  customers: Customer[];
}

async function fetchSellerDNA(userId: string | null): Promise<SellerDNA | null> {
  if (!userId) return null;
  try {
    const [row] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId)).limit(1);
    if (!row?.data) return null;
    const parsed = JSON.parse(row.data);
    return {
      company: {
        name: parsed.company?.name ?? "",
        valueWedge: parsed.company?.valueWedge ?? "",
        positioning: parsed.company?.positioning ?? "",
        differentiators: parsed.company?.differentiators ?? "",
        pillars: parsed.company?.pillars ?? ["", "", ""],
      },
      products: (parsed.products ?? []).map((p: Partial<Product>) => ({
        id: p.id ?? "", name: p.name ?? "", tagline: p.tagline ?? "",
        features: p.features ?? "", outcomes: p.outcomes ?? "", persona: p.persona ?? "",
        economicBenefits: p.economicBenefits ?? [],
      })),
      customers: (parsed.customers ?? []).map((c: Partial<Customer>) => ({
        id: c.id ?? "", customerProfile: c.customerProfile ?? "", results: c.results ?? "",
        customerTransformation: c.customerTransformation ?? "", customerQuote: c.customerQuote ?? "",
        economicBenefits: c.economicBenefits ?? [],
      })),
    };
  } catch { return null; }
}

function buildSellerContext(dna: SellerDNA | null): string {
  if (!dna) return "  No seller context configured — infer a credible value prop from the conversation context.";
  const lines: string[] = [];

  const co = dna.company;
  if (co.name) lines.push(`Seller company: ${co.name}`);
  if (co.valueWedge) lines.push(`Value wedge: ${co.valueWedge}`);
  if (co.positioning) lines.push(`Positioning: ${co.positioning}`);
  if (co.differentiators) {
    lines.push("Key differentiators:");
    co.differentiators.split("\n").filter(Boolean).forEach(d => lines.push(`  • ${d.trim()}`));
  }
  const activePillars = co.pillars.filter(Boolean);
  if (activePillars.length) lines.push(`Messaging pillars: ${activePillars.join(" | ")}`);

  dna.products.slice(0, 2).forEach(p => {
    if (!p.name) return;
    lines.push(`\nProduct: ${p.name}${p.tagline ? ` — ${p.tagline}` : ""}`);
    if (p.outcomes) lines.push(`  Outcomes: ${p.outcomes}`);
    if (p.features) lines.push(`  Features: ${p.features}`);
    p.economicBenefits.slice(0, 2).forEach(eb => {
      if (eb.description) lines.push(`  Economic benefit: ${eb.description}${eb.amount ? ` (${eb.amount} ${eb.unit})` : ""}`);
    });
  });

  dna.customers.slice(0, 2).forEach(c => {
    if (!c.customerProfile && !c.results) return;
    lines.push(`\nCustomer proof point:`);
    if (c.customerProfile) lines.push(`  Profile: ${c.customerProfile}`);
    if (c.customerTransformation) lines.push(`  Transformation: ${c.customerTransformation}`);
    if (c.results) lines.push(`  Results: ${c.results}`);
    if (c.customerQuote) lines.push(`  Quote: "${c.customerQuote}"`);
  });

  return lines.length ? lines.join("\n") : "  No seller context configured — infer a credible value prop from the conversation context.";
}

// ── Core generation ────────────────────────────────────────────────────────

async function runGeneration(jobId: number) {
  const [job] = await db.select().from(outreachJobsTable).where(eq(outreachJobsTable.id, jobId)).limit(1);
  if (!job) return;

  type VoiceProfileData = {
    toneTags: string[];
    communicationStyle: string;
    writingNotes: string;
    trainingText: string;
    suppressions: string[];
    suppressionNotes: string;
  };
  const params = job.params as { length: string; tone: string; selectedInsightKeys: string[]; voiceProfile?: VoiceProfileData };
  const selectedSet = new Set(params.selectedInsightKeys ?? []);

  const [[contact], personal, colleague, counterpart, dna, quotes] = await Promise.all([
    db.select().from(contactsTable).where(eq(contactsTable.id, job.contactId)).limit(1),
    db.select().from(contactInsightsTable).where(and(eq(contactInsightsTable.contactId, job.contactId), eq(contactInsightsTable.category, "personal"))),
    db.select().from(colleagueInsightsTable).where(eq(colleagueInsightsTable.contactId, job.contactId)),
    db.select().from(counterpartInsightsTable).where(eq(counterpartInsightsTable.contactId, job.contactId)),
    fetchSellerDNA(job.userId),
    db.select().from(insightQuotesTable).where(eq(insightQuotesTable.contactId, job.contactId)),
  ]);

  if (!contact) throw new Error("Contact not found");

  // industry_insights and role_insights are keyed by industryId/roleId, not contactId
  const [industry, role] = await Promise.all([
    contact.industryId
      ? db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, contact.industryId))
      : Promise.resolve([]),
    contact.roleId
      ? db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contact.roleId))
      : Promise.resolve([]),
  ]);

  let company: typeof companiesTable.$inferSelect | null = null;
  let companyIns: typeof companyInsightsTable.$inferSelect[] = [];
  if (contact.companyId) {
    const [[co], ci] = await Promise.all([
      db.select().from(companiesTable).where(eq(companiesTable.id, contact.companyId)).limit(1),
      db.select().from(companyInsightsTable).where(eq(companyInsightsTable.companyId, contact.companyId)),
    ]);
    company = co ?? null;
    companyIns = ci;
  }

  function filterSelected<T extends { id: number }>(items: T[], prefix: string): T[] {
    if (!selectedSet.size) return [];
    return items.filter(i => selectedSet.has(`${prefix}-${i.id}`));
  }

  const fp = filterSelected(personal, "personal");
  const fi = filterSelected(industry, "industry");
  const fr = filterSelected(role, "role");
  const fc = filterSelected(colleague, "colleague");
  const fct = filterSelected(counterpart, "counterpart");
  const fci = filterSelected(companyIns, "company");

  // Group insights by type, each annotated with awareness posture + seller posture
  // so the AI knows its relationship to the buyer before framing each signal.
  function buildTypedInsightsSection(): string {
    const groups: string[] = [];

    if (fp.length > 0) {
      groups.push(
        `PERSONAL INSIGHTS  [Awareness: Certain — contact created/said/published the source | Posture: Attentive audience member]\n` +
        fp.map(i => fmtInsight(i)).join("\n")
      );
    }
    if (fci.length > 0) {
      groups.push(
        `COMPANY INSIGHTS  [Awareness: Probable — contact knows the event, may not have seen this angle | Posture: Informed external observer]\n` +
        fci.map(i => fmtInsight(i, true)).join("\n")
      );
    }
    if (fi.length > 0) {
      groups.push(
        `INDUSTRY INSIGHTS  [Awareness: Possible general awareness, low assumed awareness of specific source | Posture: Resourceful industry observer]\n` +
        fi.map(i => fmtInsight(i, true)).join("\n")
      );
    }
    if (fr.length > 0) {
      groups.push(
        `ROLE INSIGHTS  [Awareness: Likely familiar with the challenge, uncertain of specific evidence | Posture: Role-informed specialist]\n` +
        fr.map(i => fmtInsight(i, true)).join("\n")
      );
    }
    if (fc.length > 0) {
      groups.push(
        `COLLEAGUE INSIGHTS  [Awareness: Low for specific content, high recognition of the person/function | Posture: Connected organizational observer]\n` +
        fc.map(i => fmtInsight(i)).join("\n")
      );
    }
    if (fct.length > 0) {
      groups.push(
        `COUNTERPART INSIGHTS  [Awareness: Low for specific activity, high relevance of the peer's position | Posture: Cross-market pattern spotter]\n` +
        fct.map(i => fmtInsight(i)).join("\n")
      );
    }

    return groups.length > 0
      ? groups.join("\n\n")
      : "  No specific insights selected — use general professional context about their role and company.";
  }

  const lengthMap: Record<string, string> = {
    short:  "~100 words body — HOOK + BRIDGE + VALUE + CTA; omit PROOF or compress to one EB clause",
    medium: "~200 words body — full HOOK / BRIDGE / VALUE / PROOF / CTA arc with one EB sentence",
    long:   "~350 words body — complete arc with an expanded VALUE paragraph, full PROOF with customer reference and EB, and a tailored CTA",
  };
  const lengthDesc = lengthMap[params.length] ?? "~200 words body";
  const tone = params.tone ?? "professional";
  const vp = params.voiceProfile;

  const insightsSection = buildTypedInsightsSection();

  // Map signalId → human-readable source platform for use in the quotes block
  function signalSourceLabel(mediaType: string | null | undefined): string {
    if (!mediaType) return "";
    if (mediaType === "linkedin" || mediaType === "linkedin_post") return "LinkedIn";
    if (mediaType === "blog_post" || mediaType === "blog") return "blog post";
    if (mediaType === "newsletter") return "newsletter";
    if (mediaType === "podcast") return "podcast";
    return mediaType;
  }
  const signalSourceMap = new Map<number, string>([
    ...personal.map(i => [i.id, signalSourceLabel(i.mediaType)] as [number, string]),
    ...colleague.map(i => [i.id, signalSourceLabel(i.mediaType)] as [number, string]),
    ...counterpart.map(i => [i.id, signalSourceLabel(i.mediaType)] as [number, string]),
    ...companyIns.map(i => [i.id, signalSourceLabel(i.mediaType)] as [number, string]),
    ...industry.map(i => [i.id, signalSourceLabel(i.mediaType)] as [number, string]),
    ...role.map(i => [i.id, signalSourceLabel(i.mediaType)] as [number, string]),
  ]);

  // Only surface quotes whose signal is actually selected for this job.
  // Prevents a Company-variant from showing Personal quotes as HOOK options, etc.
  const selectedSignalIds = new Set(
    (params.selectedInsightKeys ?? [])
      .map(k => parseInt(k.split("-")[1], 10))
      .filter(n => !isNaN(n))
  );
  const jobQuotes = selectedSignalIds.size > 0
    ? quotes.filter(q => selectedSignalIds.has(q.signalId))
    : quotes;

  const quotesSection = jobQuotes.length > 0
    ? jobQuotes.map((q, i) => {
        const source = signalSourceMap.get(q.signalId) ?? "";
        const sourceLine = source ? `\n    Source: ${source}` : "";
        const bridgeLine = q.hqBridge ? `\n    HQ Bridge: ${q.hqBridge}` : "";
        const roleLine = q.attributionRole ? `, ${q.attributionRole}` : "";
        return `[${i + 1}] "${q.quote}"\n    — ${q.attribution}${roleLine}${sourceLine}${bridgeLine}`;
      }).join("\n\n")
    : null;

  const sellerContext = buildSellerContext(dna);

  function buildVoiceGuide(v: NonNullable<typeof vp>): string {
    const lines: string[] = ["VOICE PROFILE — follow ALL constraints below with zero exceptions:"];
    if (v.toneTags.length > 0) lines.push(`  Tone descriptors: ${v.toneTags.join(", ")}`);
    if (v.communicationStyle) lines.push(`  Communication style: ${v.communicationStyle}`);
    if (v.writingNotes) lines.push(`  Voice notes (may contain specific closing phrases or verbal habits that MUST appear verbatim): ${v.writingNotes}`);
    if (v.suppressions.length > 0) lines.push(`  NEVER use any of these words/phrases: ${v.suppressions.join(", ")}`);
    if (v.suppressionNotes) lines.push(`  Also avoid: ${v.suppressionNotes}`);
    if (v.trainingText) lines.push(`  Voice sample (match this register exactly):\n  """\n  ${v.trainingText.slice(0, 600).replace(/\n/g, "\n  ")}\n  """`);
    lines.push(`  CRITICAL: If the voice notes mention a specific sign-off phrase, use it EXACTLY on its own line immediately before "[Your Name]".`);
    return lines.join("\n");
  }

  const voiceSection = tone === "my_voice_profile" && vp
    ? buildVoiceGuide(vp)
    : `Tone: ${tone} — let this govern word choice, sentence rhythm, and sign-off style.`;

  // 50/50 coin-flip for link placement style, decided once per generation run
  const linkStyle: "inline" | "ps" = Math.random() < 0.5 ? "inline" : "ps";

  // Only relevant when the HOOK draws from a Company, Industry, or Role signal
  // (those are the signal types whose URL appears in the insights section above).
  const linkPlacementBlock = `
═══════════════════════════════════════════
LINK PLACEMENT RULE  (Company / Industry / Role signals only)
═══════════════════════════════════════════
If your chosen HOOK signal is a Company, Industry, or Role insight, that signal's URL is listed
in the SELECTED SIGNALS section above as "URL: <url>". You MUST include that URL exactly once
in the message body, using the placement style below. Do not alter the URL.

Do NOT include a link if your HOOK is a Personal, Colleague, or Counterpart insight.

PLACEMENT STYLE FOR THIS EMAIL: ${linkStyle === "inline"
    ? `INLINE — embed the URL inside the HOOK sentence itself using active verb anchor text. The link should feel like a natural part of the sentence, not a call-to-action appended at the end.
  Anchor text must be an active verb phrase that describes what the piece does — not a generic prompt like "More here" or "Full piece here".
  The URL must be hidden behind the anchor text. The raw URL must never appear in the email body.
  Examples of well-embedded inline links (vary the phrasing — do not copy verbatim):
    "...a shift that [this Oliver Wyman report tracks closely](URL)."
    "...as [this Deloitte analysis explores](URL)."
    "...a tension [this piece digs into](URL) across a range of firms."
    "...a finding [this Fidelity research unpacks in detail](URL)."
    "...one [this study examines](URL) in the context of independent advisory growth."
    "...[worth reading in full](URL) if this is on your radar."
  Render as markdown: [anchor text](URL). Weave directly into the sentence — not added after a full stop as a standalone fragment.`
    : `PS — add a postscript after "[Your Name]" at the very end of the email.
  The PS must connect back to the specific signal you used as your HOOK — make it clear the link is for the piece already mentioned above, not a new reference.
  Examples of PS patterns (vary the phrasing — do not copy verbatim):
    "P.S. Full piece on the article I mentioned above, in case it's useful: <URL>"
    "P.S. Here's the full piece on what I referenced above if you'd like to read more: <URL>"
    "P.S. Link to the report I mentioned above, if you'd like to dig in: <URL>"
    "P.S. The piece I referenced above — full version here if it's of interest: <URL>"
  Place it on a new line after the sign-off, preceded by a blank line.`
  }`;

  const quotesBlock = quotesSection ? `
═══════════════════════════════════════════
ATTRIBUTABLE QUOTES  (highest-priority HOOK material)
═══════════════════════════════════════════
These are verbatim quotes from the buyer or people in their orbit. Each quote includes a "Source" label — always cite the source platform explicitly in the HOOK opener. Do not open with a quote and leave the reader guessing where it came from.

Recommended starters (use the Source label to name the platform):
  "Came across your post on [Source] re: [topic]: '[quote]' — that stood out."
  "Saw your [Source] post on [topic]: '[quote]' — that's a real tension."
  "Your [Source] note on [topic]: '[quote]' — that's a sharp framing."

The HQ Bridge note below each quote shows how to transition into VALUE.
Only use a quote when it genuinely elevates the message; never force one.

${quotesSection}
` : "";

  // Seniority/department framing hints for PROOF layer
  const seniority = contact.seniority ?? "";
  const dept = contact.department ?? "";
  const ebFramingHint = (() => {
    if (/c.suite|ceo|coo|cfo|cto|chief/i.test(seniority + contact.jobTitle)) return "lead with the highest-magnitude GAIN EB (strategic, revenue or growth framing)";
    if (/vp|vice president/i.test(seniority + contact.jobTitle)) return "lead with a GAIN EB; keep it concise and outcome-focused";
    if (/director|manager/i.test(seniority)) return "lead with a PAIN EB (efficiency, cost, or risk framing)";
    if (/finance|cfo|accounting/i.test(dept + contact.jobTitle)) return "prefer a $ or % GAIN EB";
    if (/operations|ops/i.test(dept)) return "prefer a PAIN EB (time, cost, or risk reduction)";
    return "use the most relevant EB from the seller context; default to gain before pain";
  })();

  const systemPrompt = `You are the AI message engine inside Whyhello, a B2B relationship intelligence platform.

Your job is to write a first-touch outreach email following the Whyhello Cold Outreach Framework — five ordered layers that move from a specific outside-in observation to a concrete inside-out value claim, backed by proof and closed with a precise ask.
${quotesBlock}
═══════════════════════════════════════════
BUYER CONTEXT  (outside-in)
═══════════════════════════════════════════
Name:     ${contact.firstName} ${contact.lastName}
Title:    ${contact.jobTitle ?? "Unknown"}${dept ? " — " + dept : ""}
Seniority:${seniority || " Not specified"}
Company:  ${company?.name ?? "Unknown"}${company?.industry ? " (" + company.industry + ")" : ""}
Location: ${[contact.location, contact.country].filter(Boolean).join(", ") || "Not specified"}
Bio:      ${contact.bio ?? "Not available"}

SELECTED SIGNALS — each group is labelled with the buyer's assumed awareness and your correct seller posture. Choose your HOOK from here. Priority: personal quote > personal insight > company insight > industry insight > role insight > colleague insight > counterpart insight.
${insightsSection}

═══════════════════════════════════════════
SELLER CONTEXT  (inside-out)
═══════════════════════════════════════════
${sellerContext}

═══════════════════════════════════════════
OUTSIDE-IN MESSAGING PRINCIPLES
═══════════════════════════════════════════
These six rules govern every outside-in signal, regardless of type. Internalize them before writing.

1. RESPECT PROXIMITY TO THE SIGNAL
   The closer an insight sits to the buyer, the more familiarity you assume and the less context you provide.
   Personal → recognize. Company → acknowledge. Industry/Role → surface. Colleague/Counterpart → introduce.
   Never explain the buyer's own work back to them. Never treat company news as a revelation to an insider.

2. PROVE RELEVANCE THROUGH SPECIFICITY
   Reference the particular quote, idea, event, finding, or decision that matters.
   "I enjoyed your podcast" is weak. "Your point about advisors losing ownership of the client experience stayed with me" proves attention.

3. INTERPRET, DO NOT MERELY SUMMARIZE
   Add a useful observation. Explain what stood out or why the signal matters. Do not repeat the source back.

4. USE THE SIGNAL AS A PREMISE, NOT DECORATION
   The outside-in insight must create a logical reason to introduce the seller's internal signal.
   It should not feel like personalization pasted onto an unrelated pitch.

5. AVOID FALSE FAMILIARITY
   Do not imply you know what the buyer thinks, knows, or is currently prioritizing.
   Use: "It made me wonder…", "This may be relevant…", "I could see this affecting…"
   Avoid: "You must be focused on…", "You're probably dealing with…", "As you know…" (unless genuinely foundational).

6. PRESERVE CONVERSATIONAL MOMENTUM
   The outside-in section occupies one or two sentences — enough to establish relevance and create the bridge.
   Do not let the hook become a summary. Get to the bridge.

PER-TYPE FRAMING RULES  (apply the rule set that matches your chosen signal)

  PERSONAL  — They created it. You are the attentive audience member.
    Lead with recognition or thoughtful appreciation. Isolate a specific quote, argument, or detail.
    Explain briefly why it stood out. Connect it to the seller's internal signal.
    Frame: "Your point about…" / "The part that stayed with me was…" / "Your distinction between X and Y…"
    Avoid: generic praise, long summaries of what they said, claiming agreement without demonstrating understanding.
    Bridge logic: You expressed X → X has an implication for Y → we help address Y.

  COMPANY  — They know the event. You are the informed external observer contributing an outside angle.
    Assume familiarity with the underlying development; do not assume they have seen this specific article or interpretation.
    Focus on what the development could mean for their function. Use tentative language for operational implications.
    Treat sensitive developments (layoffs, missed targets, departures) with restraint.
    Frame: "You're likely already close to this, but I noticed…" / "I saw the announcement about X and was interested in the emphasis on Y." / "From the outside, it looks as though…"
    Avoid: "Did you know your company…?", "In case you weren't aware…", treating speculation as confirmed fact.
    Bridge logic: Your company is doing X → this may create pressure or opportunity around Y → our work is relevant to Y.

  INDUSTRY  — They may know the trend. You are the resourceful observer who found, filtered, and interpreted it.
    Introduce the source naturally. Distill rather than summarize. Explain why the finding may matter to their business.
    Separate evidence from interpretation. Prefer recent, credible, decision-relevant sources.
    Frame: "I came across an interesting report on…" / "One finding caught my attention…" / "The headline is X, but the more interesting detail may be Y."
    Avoid: dropping a link without explaining relevance, presenting forecasts as established fact, using a loosely related article merely to create an opening.
    Bridge logic: The market is shifting toward X → companies may need to respond through Y → we enable or support Y.

  ROLE  — They live this challenge. You are the role-informed specialist who can quantify or reframe it.
    Validate lived experience; do not lecture them about their role. Use the source to quantify, contextualize, or reframe a familiar challenge.
    Invite comparison with their own experience. Connect to the seller only when relevance is credible.
    Frame: "I found a benchmark on how [role] leaders are approaching…" / "You'll know this far better than I do, but this finding was interesting…" / "One tension the report highlights is…"
    Avoid: telling them what their role cares about, overconfident phrases like "Your biggest challenge must be…", using role stereotypes as personalization.
    Bridge logic: People in your role are confronting X → the difficult trade-off is Y → we help improve or resolve Y.

  COLLEAGUE  — They recognize the person. You are the connected observer bringing an idea from inside their organization.
    Name the colleague and explain their connection to the insight. Do not imply the contact and colleague know each other personally.
    Do not use one colleague's statement as proof of company-wide consensus.
    Never imply the colleague privately referred the seller unless that happened.
    Frame: "I came across a conversation with your colleague [Name] about…" / "Not sure if you caught [Name]'s discussion of…" / "[Name] made an interesting point recently about…"
    Avoid: "Your company believes…" based on one person's statement, name-dropping without substance, triangulating internal politics.
    Bridge logic: Your colleague raised X → X may also touch your area through Y → we have a relevant perspective on Y.

  COUNTERPART  — They recognize the role context. You are the cross-market pattern spotter surfacing what peers are doing.
    Establish why this person is a meaningful peer. Focus on comparable decisions, experiments, or challenges.
    Frame as "what one peer is doing," not "what everyone else knows." Be cautious with direct competitors.
    Frame: "I came across an interesting perspective from another [role] in your space…" / "[Name] at [Company] recently described…" / "It is only one example, but their approach to X was interesting…"
    Avoid: "Your competitors are all doing this", "You're falling behind", invented peer pressure, treating a stated initiative as a proven success.
    Bridge logic: A comparable leader is approaching X through Y → this suggests an emerging option or question → we can help the buyer evaluate or pursue it.

═══════════════════════════════════════════
THE WHYHELLO COLD OUTREACH FRAMEWORK
═══════════════════════════════════════════
Write the email in exactly these five layers in order. Do not label them in the output.

The underlying architecture of Layers 1–3 follows four stages:
  Signal (HOOK) → Interpretation (HOOK tail or BRIDGE opening) → Relevance bridge (BRIDGE) → Internal signal (VALUE)
The bridge is the most important piece. Without it, the message becomes two disconnected statements:
"I saw something about you" followed by "Here is what we sell." The bridge supplies the buyer implication.

LAYER 1 — HOOK  (outside-in signal — 1 sentence)
  Purpose : Open with the single most specific signal, framed according to the per-type rules above.
            Something ${contact.firstName} would immediately recognise as true of their world right now.
  Priority: 1. A direct quote attributed to ${contact.firstName} (from Attributable Quotes above)
            2. Personal insight — recognize something they created, said, or published
            3. Company insight — acknowledge something happening around them
            4. Industry insight — surface something they may not have seen
            5. Role insight — surface a challenge or tension in their operating environment
            6. Colleague insight — introduce relevant activity through a recognizable peer
            7. Counterpart insight — surface what a comparable peer is doing or questioning
  Rules   : Exactly one sentence. No "I". No opinion. Purely observational.
            Apply the recommended framing patterns and avoid patterns from the per-type rules above.
            Quote starters (always cite the source platform — see "Source:" label in each quote above):
                          "Came across your post on [Source] re: [topic]: '[quote]'…"
                          "Saw your [Source] note on [topic]: '[quote]'…"
                          "Your [Source] post on [topic]: '[quote]' — that stood out."
            Personal starters: "Your point about…", "The part that stayed with me was…"
            Company starters: "You're likely already close to this, but…", "I noticed the emphasis on…"
            Industry/Role starters: "I came across a report on…", "One finding caught my attention…"
            Colleague starters: "I came across a conversation with your colleague [Name]…"
            Counterpart starters: "I came across an interesting perspective from another [role]…"

LAYER 2 — BRIDGE  (interpretation + relevance bridge — still entirely about them)
  Purpose : Complete the four-stage arc: interpret the signal, then connect it to a buyer implication.
            Stage A — Interpretation: explain what is specifically interesting or consequential about the signal.
              What stood out? What tension, decision, or pressure does it reveal?
            Stage B — Relevance bridge: translate the interpretation into a specific implication for ${contact.firstName}.
              What problem, opportunity, or priority might this create in their world?
            The bridge logic follows: outside-in signal → buyer implication → (sets up VALUE).
  Rules   : Zero self-reference. Still entirely about them.
            The bridge is a hypothesis, but it is an informed hypothesis — it draws on pattern recognition and domain expertise, not guesswork. Frame it with calibrated authority: confident enough to be useful, tentative enough to stay honest.
            Use starters from this library (vary across emails — do not repeat the same opener):
              "What we tend to see in situations like this is…"
              "A common pattern here is…"
              "When this comes up, the next challenge is often…"
              "This is often where [X] begins to affect [Y]."
              "The practical implication is often…"
              "That can create added pressure around…"
              "One likely consequence is…"
              "Depending on [relevant condition], that could mean…"
              "While every situation is different, we often see…"
              "It made me wonder whether this is also creating…"

LAYER 3 — VALUE  (inside-out: value wedge or activated pillar)
  Purpose : Introduce the seller as the natural resolution to what BRIDGE surfaced.
            Lead with the value wedge, or the messaging pillar most aligned with ${contact.firstName}'s implied priority.
  Rules   : Name the company. Speak in outcomes, not features. One or two sentences.
            Starters: "That's exactly what [Company] was built for...",
            "We help [persona] [achieve outcome]...", "The reason [type of firm] comes to us is..."

LAYER 4 — PROOF  (EB sentence + optional customer reference)
  Purpose : Back the value claim with one quantified economic benefit sentence.
            Add a customer reference sentence if a proof point closely matches ${contact.firstName}'s profile.
  EB framing for this contact: ${ebFramingHint}
  Gain EB format : "[label] [verb phrase] — [amount] [unit], [frequency]."
  Pain EB format : "[label] [verb phrase], saving [amount] [unit] [frequency]."
  Customer ref   : "[Similar firm type] [transformation] — [customer quote if available]."
  Rules   : Only use EBs and proof points from the seller context above. Never fabricate numbers.

LAYER 5 — CTA  (specific, low-friction ask)
  Purpose : One precise next step that advances the conversation without demanding commitment.
            Make it specific to the topic raised in HOOK or BRIDGE.
  Rules   : NEVER say "Book a demo", "Schedule a call", or "Get started".
            Options: "Happy to share how other [role type]s are handling [specific challenge] if useful.",
            "Worth a quick exchange on [topic from HOOK]?",
            "We recently put together a [resource] on [topic] — happy to send it over.",
            "If [challenge from BRIDGE] is on your radar, I'd be glad to share what we're seeing."

═══════════════════════════════════════════
OUTPUT FORMAT — produce exactly two blocks
═══════════════════════════════════════════
BLOCK 1 — The email:
  Line 1:   Subject: <subject line>
  Line 2:   (blank)
  Line 3+:  Email body (five layers in order, no section labels, no separators)

BLOCK 2 — The structure (append on a new line immediately after the email sign-off):
  [STRUCTURE_JSON]{"hook":"<verbatim HOOK sentence(s) from the email>","bridge":"<verbatim BRIDGE text>","value":"<verbatim VALUE text>","proof":"<verbatim PROOF text>","cta":"<verbatim CTA sentence>"}[/STRUCTURE_JSON]

  The JSON values must be verbatim extracts from the email body — not summaries or paraphrases.

SUBJECT LINE RULES
  • Under 50 characters — ruthlessly brief
  • Curiosity-driving — make ${contact.firstName} want to open it
  • Hyper-specific: reference their work, company news, or a shared context
  • Sentence case, no ALL CAPS, minimal punctuation — sounds like a real person
  • Opens with familiarity or relevance in the first 2–3 words

LENGTH: ${lengthDesc}

SIGN-OFF: ${tone === "my_voice_profile" ? "Use the sender's preferred closing phrase from the voice profile below, followed by \"[Your Name]\" on the next line" : "Sign off with \"[Your Name]\" as a placeholder — no invented name"}

${voiceSection}
${linkPlacementBlock}

STYLING RULES
  • Bold all verbatim quoted text — any time you include a direct quote from the buyer or a named source inside quotation marks, wrap the entire quoted passage (including the quotation marks) in **double asterisks** so it renders as bold.
    Example: Your post on LinkedIn: **"Advisor independence means little without the infrastructure to act on it."** — that stayed with me.
  • Apply this only to genuine verbatim quotes set off in quotation marks. Do not bold paraphrases, summaries, or your own phrasing.
  • Always separate HOOK, BRIDGE, VALUE, PROOF, and CTA with a blank line between each section — this means two line breaks between sections, producing a visible paragraph gap. This applies regardless of email length. Never compress sections into a single-spaced block.

ABSOLUTE PROHIBITIONS
  • Never open with "I hope this email finds you well" or any variant
  • Never open the body with "I" as the first word
  • Never add section labels (HOOK:, BRIDGE:, etc.) to the email body
  • Never fabricate statistics or claim specific results unless drawn from the seller context above`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write the outreach email to ${contact.firstName} ${contact.lastName}.` },
    ],
    stream: false,
  });

  const result = completion.choices[0]?.message?.content ?? "";
  // Store enriched source keys: "category-id|Title|mediaType|score"
  // The frontend parses the pipe-separated format for the Sources tab display.
  // Old jobs without pipes fall back to showing the raw key.
  const relevanceRows = await db.select().from(insightRelevanceScoresTable)
    .where(eq(insightRelevanceScoresTable.contactId, job.contactId));
  const relevanceMap = new Map<string, number>();
  for (const r of relevanceRows) relevanceMap.set(`${r.signalType}-${r.signalId}`, r.score);

  const usedKeys = [
    ...fp.map(i  => `personal-${i.id}|${i.title}|${i.mediaType ?? ""}|${relevanceMap.get(`personal-${i.id}`) ?? ""}`),
    ...fci.map(i => `company-${i.id}|${i.title}|${i.mediaType ?? ""}|${relevanceMap.get(`company-${i.id}`) ?? ""}`),
    ...fi.map(i  => `industry-${i.id}|${i.title}|${i.mediaType ?? ""}|${relevanceMap.get(`industry-${i.id}`) ?? ""}`),
    ...fr.map(i  => `role-${i.id}|${i.title}|${i.mediaType ?? ""}|${relevanceMap.get(`role-${i.id}`) ?? ""}`),
    ...fc.map(i  => `colleague-${i.id}|${i.title}|${i.mediaType ?? ""}|${relevanceMap.get(`colleague-${i.id}`) ?? ""}`),
    ...fct.map(i => `counterpart-${i.id}|${i.title}|${i.mediaType ?? ""}|${relevanceMap.get(`counterpart-${i.id}`) ?? ""}`),
  ];

  await db.update(outreachJobsTable)
    .set({ status: "completed", result, prompt: systemPrompt, sources: usedKeys, updatedAt: new Date() })
    .where(eq(outreachJobsTable.id, jobId));

  // Save a draft to the Message Center automatically (main emails only, not variants)
  if (job.userId && contact.email && job.type !== "intro_email_variant") {
    const { subject: parsedSubject, body: parsedBody } = parseEmailResult(result);
    await db.insert(messagesTable).values({
      userId: job.userId,
      contactId: job.contactId,
      toEmail: contact.email,
      toName: `${contact.firstName} ${contact.lastName}`.trim(),
      subject: parsedSubject || job.title,
      body: parsedBody,
      status: "draft",
    });
  }
}

// ── Variant generation ─────────────────────────────────────────────────────
// After a main intro_email job completes, automatically generate one email per
// unused insight category (up to 5), each using the highest-scoring insight
// from that category. Variant jobs are created immediately so the frontend
// shows them as "generating" without waiting.

const VARIANT_CATEGORIES = ["personal", "company", "industry", "role", "colleague", "counterpart"] as const;
type VariantCategory = (typeof VARIANT_CATEGORIES)[number];

async function generateVariants(parentJobId: number) {
  const [parentJob] = await db.select().from(outreachJobsTable)
    .where(eq(outreachJobsTable.id, parentJobId)).limit(1);
  if (!parentJob) return;

  type ParentParams = {
    length: string;
    tone: string;
    selectedInsightKeys: string[];
    voiceProfile?: Record<string, unknown>;
  };
  const parentParams = parentJob.params as ParentParams;

  // Determine which categories were already covered in the main email
  const usedSources: string[] = Array.isArray(parentJob.sources) ? (parentJob.sources as string[]) : [];
  const usedCategories = new Set(usedSources.map(s => s.split("-")[0]));

  // Load all available insights for this contact (same logic as runGeneration)
  const contactId = parentJob.contactId;
  const [[contact], personal, colleague, counterpart] = await Promise.all([
    db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1),
    db.select().from(contactInsightsTable).where(
      and(eq(contactInsightsTable.contactId, contactId), eq(contactInsightsTable.category, "personal"))
    ),
    db.select().from(colleagueInsightsTable).where(eq(colleagueInsightsTable.contactId, contactId)),
    db.select().from(counterpartInsightsTable).where(eq(counterpartInsightsTable.contactId, contactId)),
  ]);
  if (!contact) return;

  const [industry, role] = await Promise.all([
    contact.industryId
      ? db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, contact.industryId))
      : Promise.resolve([]),
    contact.roleId
      ? db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contact.roleId))
      : Promise.resolve([]),
  ]);

  let companyIns: typeof companyInsightsTable.$inferSelect[] = [];
  if (contact.companyId) {
    companyIns = await db.select().from(companyInsightsTable)
      .where(eq(companyInsightsTable.companyId, contact.companyId));
  }

  const allByCategory: Record<VariantCategory, { id: number }[]> = {
    personal,
    company: companyIns,
    industry,
    role,
    colleague,
    counterpart,
  };

  // Load relevance scores so we can pick the highest-scoring insight per category
  const scores = await db.select().from(insightRelevanceScoresTable)
    .where(eq(insightRelevanceScoresTable.contactId, contactId));
  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    scoreMap.set(`${s.signalType}-${s.signalId}`, s.score);
  }

  // For each unused category (in priority order), pick the top-scoring insight
  const variantSpecs: { category: VariantCategory; insightKey: string }[] = [];
  for (const cat of VARIANT_CATEGORIES) {
    if (usedCategories.has(cat)) continue;
    const insights = allByCategory[cat];
    if (!insights || insights.length === 0) continue;

    const sorted = [...insights].sort((a, b) => {
      const sa = scoreMap.get(`${cat}-${a.id}`) ?? 0;
      const sb = scoreMap.get(`${cat}-${b.id}`) ?? 0;
      return sb - sa;
    });

    variantSpecs.push({ category: cat, insightKey: `${cat}-${sorted[0].id}` });
    if (variantSpecs.length === 5) break;
  }

  if (variantSpecs.length === 0) return;

  // Create all variant job rows immediately — frontend sees them as "generating" right away
  const variantJobs = await Promise.all(
    variantSpecs.map(({ category, insightKey }) => {
      const label = category.charAt(0).toUpperCase() + category.slice(1);
      return db.insert(outreachJobsTable)
        .values({
          contactId,
          userId: parentJob.userId,
          type: "intro_email_variant",
          title: `${label} Variant`,
          params: {
            ...parentParams,
            selectedInsightKeys: [insightKey],
            parentJobId,
            variantCategory: category,
          },
          status: "generating",
        })
        .returning()
        .then(rows => rows[0]);
    })
  );

  // Fire all variant generations concurrently (non-blocking)
  for (const variantJob of variantJobs) {
    if (!variantJob) continue;
    runGeneration(variantJob.id).catch(async (err) => {
      console.error(`Variant generation failed for job ${variantJob.id}:`, err);
      await db.update(outreachJobsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(outreachJobsTable.id, variantJob.id))
        .catch(console.error);
    });
  }
}

/** Strip the [STRUCTURE_JSON]...[/STRUCTURE_JSON] block from the raw AI result */
function stripStructureBlock(raw: string): string {
  return raw.replace(/\s*\[STRUCTURE_JSON\][\s\S]*?\[\/STRUCTURE_JSON\]/g, "").trimEnd();
}

/** Extract subject and body from AI output that starts with "Subject: ..." */
function parseEmailResult(result: string): { subject: string; body: string } {
  const clean = stripStructureBlock(result);
  const firstNewline = clean.indexOf("\n");
  if (firstNewline === -1) return { subject: "", body: clean };
  const firstLine = clean.slice(0, firstNewline).trim();
  const rest = clean.slice(firstNewline).replace(/^\n+/, "");
  if (firstLine.toLowerCase().startsWith("subject:")) {
    return { subject: firstLine.slice("subject:".length).trim(), body: rest };
  }
  return { subject: "", body: clean };
}

contactJobsRouter.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const jobs = await db.select().from(outreachJobsTable).where(eq(outreachJobsTable.contactId, contactId)).orderBy(desc(outreachJobsTable.createdAt));
    res.json(jobs);
  } catch (err) {
    console.error("List outreach jobs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

contactJobsRouter.post("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    const { type, title, params } = req.body ?? {};
    if (!type || !title || !params) { res.status(400).json({ error: "type, title, and params are required" }); return; }

    const userId =
      (req as typeof req & { user?: { id: string } }).user?.id ??
      // Dev-only: allow passing userId via header when not in production
      (process.env.NODE_ENV !== "production" ? (req.headers["x-dev-user-id"] as string | undefined) ?? null : null);

    const [job] = await db.insert(outreachJobsTable)
      .values({ contactId, userId, type, title, params, status: "generating" })
      .returning();

    res.status(201).json(job);

    runGeneration(job.id)
      .then(async () => {
        // After the main email completes, automatically generate entry-point variants
        if (type === "intro_email") {
          await generateVariants(job.id).catch(err => {
            console.error(`Variant setup failed for parent job ${job.id}:`, err);
          });
        }
      })
      .catch(async (err) => {
        console.error(`Generation failed for job ${job.id}:`, err);
        await db.update(outreachJobsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(outreachJobsTable.id, job.id))
          .catch(console.error);
      });
  } catch (err) {
    console.error("Create outreach job error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

jobsRouter.get("/:jobId", async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job ID" }); return; }
    const [job] = await db.select().from(outreachJobsTable).where(eq(outreachJobsTable.id, jobId)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    res.json(job);
  } catch (err) {
    console.error("Get outreach job error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

jobsRouter.patch("/:jobId", async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job ID" }); return; }
    const { title } = req.body ?? {};
    if (!title) { res.status(400).json({ error: "title is required" }); return; }
    const [job] = await db.update(outreachJobsTable)
      .set({ title, updatedAt: new Date() })
      .where(eq(outreachJobsTable.id, jobId))
      .returning();
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    res.json(job);
  } catch (err) {
    console.error("Update outreach job error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

jobsRouter.delete("/:jobId", async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job ID" }); return; }
    // Cascade-delete any variant children whose parentJobId matches this job
    await db.delete(outreachJobsTable).where(
      sql`(${outreachJobsTable.params}->>'parentJobId')::integer = ${jobId}`
    );
    await db.delete(outreachJobsTable).where(eq(outreachJobsTable.id, jobId));
    res.status(204).end();
  } catch (err) {
    console.error("Delete outreach job error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
