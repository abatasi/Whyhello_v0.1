import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { generateBattlecardBuffer } from "../lib/battlecard-generator.js";
import { db } from "@workspace/db";
import {
  contactsTable,
  companiesTable,
  contactInsightsTable,
  companyInsightsTable,
  industryInsightsTable,
  roleInsightsTable,
  outreachJobsTable,
  messagesTable,
  dnaProfilesTable,
  insightQuotesTable,
  insightRelevanceScoresTable,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { loadRelationshipInsights, type RelationshipKind, type RelationshipSourceContact } from "../lib/relationship-insights.js";

export const contactJobsRouter: IRouter = Router({ mergeParams: true });
export const jobsRouter: IRouter = Router({ mergeParams: true });

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

type InsightRow = {
  id: number;
  title: string;
  source: string | null;
  url?: string | null;
  description?: string | null;
  publishedDate?: string | null;
  mediaType?: string | null;
  contactId?: number;
};

function fmtInsight(i: InsightRow, showUrl = false) {
  const base = `  • ${i.title} (${i.source}${i.publishedDate ? ", " + i.publishedDate : ""})${i.description ? "\n    " + i.description : ""}`;
  return showUrl && i.url ? `${base}\n    URL: ${i.url}` : base;
}

function limitToSentences(text: string, maxSentences: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxSentences < 1) return "";

  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (!".!?".includes(trimmed[i])) continue;
    const next = trimmed[i + 1] ?? "";
    if (next && !/\s|["'”’)\]]/.test(next)) continue;

    let end = i + 1;
    while (end < trimmed.length && /["'”’)\]]/.test(trimmed[end])) end++;
    sentences.push(trimmed.slice(start, end).trim());
    start = end;
    while (start < trimmed.length && /\s/.test(trimmed[start])) start++;
    i = start - 1;
    if (sentences.length === maxSentences) return sentences.join(" ");
  }

  if (start < trimmed.length) sentences.push(trimmed.slice(start).trim());
  return sentences.slice(0, maxSentences).join(" ");
}

// ── DNA / seller-context types (mirrors HQ.tsx) ───────────────────────────

interface EconomicBenefit { id: string; description: string; amount: string; unit: string; frequency: string }
interface Product { id: string; name: string; tagline: string; features: string; outcomes: string; persona: string; economicBenefits: EconomicBenefit[] }
interface Customer {
  id: string;
  customerProfile: string;
  companyId: number | null;
  companyName: string;
  companyIndustry: string;
  companySize: string;
  companyHeadquarters: string;
  testimonialAttribution: "named" | "anonymized";
  anonymizedCustomerLabel: string;
  results: string;
  customerTransformation: string;
  customerQuote: string;
  economicBenefits: EconomicBenefit[];
}
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
        companyId: c.companyId ?? null,
        companyName: c.companyName ?? "",
        companyIndustry: c.companyIndustry ?? "",
        companySize: c.companySize ?? "",
        companyHeadquarters: c.companyHeadquarters ?? "",
        testimonialAttribution: c.testimonialAttribution === "named" ? "named" : "anonymized",
        anonymizedCustomerLabel: c.anonymizedCustomerLabel ?? "",
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
    const canNameCustomer = c.testimonialAttribution === "named";
    const safeCustomerLabel = canNameCustomer
      ? c.customerProfile
      : c.anonymizedCustomerLabel.trim() || "An anonymized customer";
    lines.push(`\nCustomer proof point:`);
    lines.push(
      canNameCustomer
        ? "  Attribution permission: NAMED — the customer/company name may be used."
        : "  Attribution permission: ANONYMIZED — never reveal the customer/company name or identifying details.",
    );
    if (safeCustomerLabel) lines.push(`  Safe attribution: ${safeCustomerLabel}`);
    if (c.customerTransformation) lines.push(`  Transformation: ${c.customerTransformation}`);
    if (c.results) lines.push(`  Results: ${c.results}`);
    const customerQuote = limitToSentences(c.customerQuote, 2);
    if (customerQuote) {
      lines.push(`  Quote (maximum 2 sentences): "${customerQuote}" — attribute only as ${safeCustomerLabel}`);
    }
  });

  return lines.length ? lines.join("\n") : "  No seller context configured — infer a credible value prop from the conversation context.";
}

// ── Core generation ────────────────────────────────────────────────────────

async function runGeneration(jobId: number) {
  const [job] = await db.select().from(outreachJobsTable).where(eq(outreachJobsTable.id, jobId)).limit(1);
  if (!job) return;

  // ── Battlecard: generate PPTX, store as base64, done ──────────────────
  if (job.type === "battlecard") {
    const buffer = await generateBattlecardBuffer(job.contactId);
    await db.update(outreachJobsTable)
      .set({ status: "completed", result: buffer.toString("base64"), updatedAt: new Date() })
      .where(eq(outreachJobsTable.id, jobId));
    return;
  }

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

  const [[contact], personal, dna] = await Promise.all([
    db.select().from(contactsTable).where(eq(contactsTable.id, job.contactId)).limit(1),
    db.select().from(contactInsightsTable).where(and(eq(contactInsightsTable.contactId, job.contactId), eq(contactInsightsTable.category, "personal"))),
    fetchSellerDNA(job.userId),
  ]);

  if (!contact) throw new Error("Contact not found");

  const [colleagueContext, counterpartContext] = await Promise.all([
    loadRelationshipInsights(job.contactId, "colleague"),
    loadRelationshipInsights(job.contactId, "counterpart"),
  ]);
  const colleague = colleagueContext.items;
  const counterpart = counterpartContext.items;
  const relationshipBySignal = new Map<number, {
    kind: RelationshipKind;
    sourceContact: RelationshipSourceContact | undefined;
    group?: 1 | 2;
  }>();
  for (const insight of colleague) {
    relationshipBySignal.set(insight.id, {
      kind: "colleague",
      sourceContact: colleagueContext.sourceContacts.get(insight.contactId),
    });
  }
  for (const insight of counterpart) {
    relationshipBySignal.set(insight.id, {
      kind: "counterpart",
      sourceContact: counterpartContext.sourceContacts.get(insight.contactId),
      group: counterpartContext.groups.get(insight.contactId),
    });
  }
  const quoteContactIds = [
    job.contactId,
    ...colleagueContext.sourceContactIds,
    ...counterpartContext.sourceContactIds,
  ];
  const quotes = quoteContactIds.length > 0
    ? await db.select().from(insightQuotesTable).where(inArray(insightQuotesTable.contactId, quoteContactIds))
    : [];

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

  // Signal IDs that have verbatim quotes extracted — used to tag personal insights below
  const quoteSignalIdSet = new Set(quotes.map(q => q.signalId));

  function formatRelationshipInsight(i: InsightRow, kind: RelationshipKind): string {
    const relationship = relationshipBySignal.get(i.id);
    const sourceContact = relationship?.sourceContact;
    const sourceDetails = sourceContact
      ? `\n    Source person: ${sourceContact.name}${sourceContact.jobTitle ? ` — ${sourceContact.jobTitle}` : ""}${sourceContact.companyName ? ` at ${sourceContact.companyName}` : ""}`
      : "";
    const groupDetails = kind === "counterpart" && relationship?.group
      ? `\n    Peer group: ${relationship.group === 1 ? "same industry" : "same role, adjacent industry"}`
      : "";
    const quoteTag = quoteSignalIdSet.has(i.id)
      ? `\n    ⚠ VERBATIM QUOTE AVAILABLE — use the exact text from the matching entry in the ATTRIBUTABLE QUOTES block. The title above is a filing label, not the quote.`
      : "";
    return fmtInsight(i) + sourceDetails + groupDetails + quoteTag;
  }

  // Group insights by type, each annotated with awareness posture + seller posture
  // so the AI knows its relationship to the buyer before framing each signal.
  function buildTypedInsightsSection(): string {
    const groups: string[] = [];

    if (fp.length > 0) {
      groups.push(
        `PERSONAL INSIGHTS  [Awareness: Certain — contact created/said/published the source | Posture: Attentive audience member]\n` +
        fp.map(i => {
          const base = fmtInsight(i);
          const quoteTag = quoteSignalIdSet.has(i.id)
            ? `\n    ⚠ VERBATIM QUOTE AVAILABLE — the exact text to use is in the ATTRIBUTABLE QUOTES block below. The title on the line above is a filing label; it is NOT the quote and must never be used as one.`
            : "";
          return base + quoteTag;
        }).join("\n")
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
        fc.map(i => formatRelationshipInsight(i, "colleague")).join("\n")
      );
    }
    if (fct.length > 0) {
      groups.push(
        `COUNTERPART INSIGHTS  [Awareness: Low for specific activity, high relevance of the peer's position | Posture: Cross-market pattern spotter]\n` +
        fct.map(i => formatRelationshipInsight(i, "counterpart")).join("\n")
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
        const relationship = relationshipBySignal.get(q.signalId);
        const sourceContact = relationship?.sourceContact;
        const relationshipLine = sourceContact
          ? `\n    Relationship: ${relationship.kind === "colleague" ? "colleague inside the contact's company" : "counterpart in a similar role at another company"}\n    Source person: ${sourceContact.name}${sourceContact.jobTitle ? ` — ${sourceContact.jobTitle}` : ""}${sourceContact.companyName ? ` at ${sourceContact.companyName}` : ""}`
          : "";
        return `[${i + 1}] "${q.quote}"\n    — ${q.attribution}${roleLine}${sourceLine}${relationshipLine}${bridgeLine}`;
      }).join("\n\n")
    : null;

  const sellerContext = buildSellerContext(dna);

  function buildVoiceGuide(v: NonNullable<typeof vp>): string {
    const lines: string[] = ["VOICE PROFILE — follow ALL constraints below with zero exceptions:"];
    if (v.toneTags.length > 0) lines.push(`  Tone descriptors: ${v.toneTags.join(", ")}`);
    if (v.communicationStyle) lines.push(`  Communication style: ${v.communicationStyle}`);
    if (v.writingNotes) lines.push(`  Voice notes (may contain specific verbal habits that MUST appear verbatim, but never add a personal signature or sender name): ${v.writingNotes}`);
    if (v.suppressions.length > 0) lines.push(`  NEVER use any of these words/phrases: ${v.suppressions.join(", ")}`);
    if (v.suppressionNotes) lines.push(`  Also avoid: ${v.suppressionNotes}`);
    if (v.trainingText) lines.push(`  Voice sample (match this register exactly):\n  """\n  ${v.trainingText.slice(0, 600).replace(/\n/g, "\n  ")}\n  """`);
    lines.push(`  CRITICAL: Do not add a sign-off phrase, personal signature, sender name, or "[Your Name]" placeholder. End the email with the CTA (or the permitted P.S. link note).`);
    return lines.join("\n");
  }

  const voiceSection = tone === "my_voice_profile" && vp
    ? buildVoiceGuide(vp)
    : `Tone: ${tone} — let this govern word choice and sentence rhythm. Do not add a sign-off phrase, personal signature, or sender name.`;

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
     : `PS — add a postscript after the CTA at the very end of the email.
  The PS must connect back to the specific signal you used as your HOOK — make it clear the link belongs to the piece already mentioned above, not a new reference.
  The raw URL must never appear in the PS. Hide it behind active verb anchor text using markdown: [anchor text](URL).
  Anchor text must describe what the piece does — not a generic "click here" or "read more".
  Examples of PS patterns (vary the phrasing — do not copy verbatim):
    "P.S. The piece I mentioned above is [worth reading in full](URL) if this is on your radar."
    "P.S. Full report — [digs into this in more detail](URL) if useful."
    "P.S. The article above [covers this in depth](URL) if you'd like more context."
    "P.S. [The full piece is here](URL) — goes deeper on the numbers if it's of interest."
   Place it on a new line after the CTA, preceded by a blank line.`
  }`;

  const quotesBlock = quotesSection ? `
═══════════════════════════════════════════
ATTRIBUTABLE QUOTES  (highest-priority HOOK material)
═══════════════════════════════════════════
These are verbatim quotes extracted from post bodies. Each entry includes the exact text to quote, its attribution, and the source platform.

CRITICAL: The "[quote]" in your HOOK must be copied character-for-character from the "quote" field in one of the entries below. Never use the insight title from SELECTED SIGNALS as the quote — the title is a label, not quotable text.

Recommended starters (always name the platform AND include a brief topic qualifier — never leave the opener as bare "your post on LinkedIn"):
  "Came across your post on [Source] on [topic]: '[verbatim quote from entry below]' I appreciated [one-sentence specific reaction]."
  "Came across your post on [Source] re: [topic]: '[verbatim quote from entry below]' That framing of [specific idea] stood out to me."
  "Saw your [Source] post on [topic]: '[verbatim quote from entry below]' Really appreciated the way you put [specific tension] into words."
  "Your [Source] piece on [topic] caught my eye: '[verbatim quote from entry below]' [one-sentence specific reaction]."

The [topic] must be a concise 2–5 word summary derived from the insight title — not the full title verbatim, not a vague word like "this". Examples: "on founder-market fit", "re: platform team models", "on AI in the clinic", "re: carbon reduction timelines".

The HQ Bridge note below each quote shows how to transition into VALUE.
Only use a quote when it genuinely elevates the message; never force one.

  RELATIONSHIP-SPECIFIC QUOTE FRAMING:
    • Colleague quote: attribute it to the named colleague and present it as an idea coming from inside the contact's company. After a short interpretation, add a natural segue question such as "Is this something you're seeing as well?" Do not imply internal agreement or a private referral.
    • Counterpart quote: attribute it to the named peer and present it as one comparable example from another company. After a short interpretation, add a natural comparison question such as "Is this resonating with you and your company as well?" or "Is this also on your radar?" Do not use competitor pressure, urgency, or unsupported market consensus.
    • These questions are part of the bridge, not the CTA. They should lead into the seller's relevance without asking for confidential information.

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

   RELATIONSHIP INSIGHT MESSAGE RULES — apply these when the chosen HOOK is Colleague or Counterpart:
     Assume the contact has not encountered the specific insight. Inform them about a relevant public observation rather than testing whether they already know it.
     If an attributable quote is available, include the exact quote and identify the source person before interpreting it. Never present the quote as the buyer's own view.
     COLLEAGUE: Make the source feel like a useful signal from inside the contact's own company. Name the colleague and their role/company when available, then segue with a natural, non-leading question such as "Is this something you're seeing as well?" or "Does that theme show up in your area too?" Do not turn one colleague's view into company-wide consensus.
     COUNTERPART: Make the source feel like a relevant signal from someone in a similar role at another company, including a competitor when that is the available context. Name the counterpart and role/company when available, then invite comparison with a question such as "Is this resonating with you and your company as well?" or "Is this also on your radar?" Treat it as one peer example, not proof that the contact is behind or that every competitor agrees.
     For both types, the segue question belongs immediately after the source/quote interpretation and before the seller's value claim. It should sound curious and useful, not like a challenge or a request for confidential information.

═══════════════════════════════════════════
THE WHYHELLO COLD OUTREACH FRAMEWORK
═══════════════════════════════════════════
Write the email in exactly these five layers in order. Do not label them in the output.

The underlying architecture of Layers 1–3 follows four stages:
  Signal (HOOK) → Interpretation (HOOK tail or BRIDGE opening) → Relevance bridge (BRIDGE) → Internal signal (VALUE)
The bridge is the most important piece. Without it, the message becomes two disconnected statements:
"I saw something about you" followed by "Here is what we sell." The bridge supplies the buyer implication.
${quotesBlock}
LAYER 1 — HOOK  (1–2 sentences)
  Purpose : Open with the single most specific signal. The hook must sound like something the sender
            would still send even if no pitch followed — genuine, human, low-ceremony.
            Most buyers won't know the sender. Establish brief context through tone and framing, not a bio.
  Priority: 1. A direct quote attributed to ${contact.firstName} (from Attributable Quotes above)
            2. Personal insight — recognize something they created, said, or published
            3. Company insight — acknowledge something happening around them
            4. Industry insight — surface something they may not have seen
            5. Role insight — surface a challenge or tension in their operating environment
            6. Colleague insight — introduce relevant activity through a recognizable peer
            7. Counterpart insight — surface what a comparable peer is doing or questioning

  TWO GOVERNING FORMULAS — use the one that matches the signal type:

  PERSONAL SIGNALS (including attributable quotes) — Formula: Recognition + specific evidence + genuine reaction
    The sender is the attentive audience member. Isolate a specific argument, detail, or quote.
    Say what stood out and why — briefly. "I" is allowed. 1–2 sentences.

    ⛔ HARD STOP — QUOTE SOURCE RULE:
    If a personal insight is tagged ⚠ VERBATIM QUOTE AVAILABLE in SELECTED SIGNALS, a quote from that
    signal's post body is listed in the ATTRIBUTABLE QUOTES block immediately above. You MUST use that
    exact text as the quoted passage — copied character-for-character, no rewording, no summarising.
    The insight title (the short label line in SELECTED SIGNALS) is a filing label. It is NOT a quote
    and must NEVER appear inside quotation marks in the email. Using the title as a quote is a
    critical error that breaks the message.

    Starters (vary — do not repeat verbatim):
      "Came across your [post/interview/podcast] on [topic]. Your point about [specific idea] really stood out."
      "Really enjoyed your perspective on [topic], particularly your observation that [specific point]."
      "Your recent [post/interview] on [topic] caught my attention — particularly the way you framed [specific idea]."
      "I appreciated your comments on [topic], especially the distinction you made between [X] and [Y]."
      "You made an interesting point recently about [specific idea]. It stayed with me because [brief interpretation]."
      "I came across your conversation with [interviewer/publication]. Your comment that '[short quotation]' was a sharp way of capturing [issue]."
      "Your post about [topic] stood out, especially the way you connected [X] with [Y] — that's a connection people often miss."
    For attributable quotes — always cite the source platform AND include a brief topic qualifier.
      Never write "Came across your post on LinkedIn:" without a topic — always follow the platform with a topic phrase.
      After invoking the quote, the reaction must be ONE short sentence naming the specific takeaway.
      No "— that stayed with me" preamble. No restatement of what the quote said.
      Correct patterns:
        "Came across your post on [Source] on [topic]: '[quote]' I really appreciated [key takeaway]."
        "Came across your [Source] post re: [topic]: '[quote]' Really appreciated the way you put [specific tension] into words."
        "Saw your [Source] note on [topic]: '[quote]' That framing of [specific idea] stood out to me."
        "Your [Source] piece on [topic] caught my eye: '[quote]' I thought the emphasis on [specific point] was sharp."
      Wrong:
        "Came across your post on LinkedIn: '[quote]'" (missing topic qualifier — never acceptable)
        "[quote] — that stayed with me. The way you highlighted X makes clear that Y." (too long, restates the quote)
      The [topic] must be a concise 2–5 word phrase derived from the insight title. Never use the full title verbatim or a vague word like "this".
    Avoid: generic praise ("great post"), wholesale summary of the source, fragment sentences with no human voice.

  COMPANY / INDUSTRY / ROLE / COLLEAGUE / COUNTERPART — Formula: Discovery + useful substance + reason for sharing
    Should sound like a thoughtful colleague dropping something relevant into Slack: low ceremony,
    immediately relevant, no premature sales tone. "I" is allowed. 1–2 sentences.
    Starters (vary — do not repeat verbatim):
      "Came across this piece on [topic] and thought it might be useful given your work around [relevant responsibility]."
      "Thought I'd pass this along — there's an interesting take on [specific issue] that seems relevant to [their world]."
      "Not sure if this has crossed your desk yet, but there's an interesting finding here around [specific finding]."
      "I found this analysis of [topic] particularly useful. The part about [specific detail] seemed especially relevant."
      "This may already be on your radar, but I thought the section on [specific issue] was worth sharing."
      "Passing this along because it puts some useful numbers behind [challenge or trend]."
      "This caught my attention because it connects [development] with [buyer responsibility or market implication]."
      "One finding in this [report/article] stood out: [concise finding]. I thought you might find it useful given [relevance]."
    Avoid: fragment sentences, bare link drops with no human voice, "I came across X" with nothing that follows.

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
  Styling : Bold the crux outcome phrase — the specific capability or result that delivers the value.
            Wrap the key predicate clause in **double asterisks**.
            Example: "That's exactly what [Company] was built for — **giving senior advisors the planning resources and open investment access needed to address complex life-change scenarios while preserving a differentiated, advisor-owned practice.**"
            Do not bold the entire sentence; bold only the outcome phrase that carries the weight of the value claim.

LAYER 4 — PROOF  (EB sentence + optional customer reference)
  Purpose : Back the value claim with one quantified economic benefit sentence.
            Add a customer reference sentence if a proof point closely matches ${contact.firstName}'s profile.
  EB framing for this contact: ${ebFramingHint}

  EB sentences must be full declarative sentences — never bare label fragments.
  Prefix with "Our [product name]" and write the verb phrase as a natural predicate.

  Gain EB format : "Our [product name] **[verb phrase], gaining on average [amount] [unit] [frequency].**"
    Example: "Our Advisor Partnership Platform **protects recurring revenue by successfully transferring client assets, gaining on average $9,000 per $1M of AUM retained yearly.**"
  Pain EB format : "Our [product name] **[verb phrase], saving on average [amount] [unit] [frequency].**"
    Example: "Our Advisor Partnership Platform **eliminates manual compliance reporting, saving on average $80K per advisor yearly.**"

  Chain frequency directly to the quantified amount and unit with no separating comma.
  Use compact terms such as "yearly", "monthly", "weekly", "one-time", or "per transaction" rather than "each year" or "every month".

  The "on average" qualifier is mandatory — it signals a typical or representative figure rather than a guarantee, which is both more honest and more credible to a sophisticated buyer.
  Bold covers the entire predicate — verb phrase through the final unit/frequency — so the full economic claim reads as a single emphatic unit.

  Company-level proof (credentials, scale, differentiators):
    Use first-person "We" — never repeat the company name.
    Correct  : "We are Canada's largest independent wealth manager…"
    Wrong    : "Richardson Wealth is Canada's largest independent wealth manager…"

  Customer ref   : Write the customer reference as its own paragraph:
                 "A [similar firm type] [transformation]."
                 If a customer quote is available, start the testimonial snippet on the next line as its own paragraph:
                 "[Safe attribution] described the change this way:

                 \"[customer quote]\""
                 Use no more than two sentences from any one customer quote. Never append the quote to the preceding
                 proof sentence, and never let a single testimonial take over the message.
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

  BLOCK 2 — The structure (append on a new line immediately after the email body, after the CTA and any permitted P.S.):
  [STRUCTURE_JSON]{"hook":"<verbatim HOOK sentence(s) from the email>","bridge":"<verbatim BRIDGE text>","value":"<verbatim VALUE text>","proof":"<verbatim PROOF text>","cta":"<verbatim CTA sentence>"}[/STRUCTURE_JSON]

  The JSON values must be verbatim extracts from the email body — not summaries or paraphrases.

SUBJECT LINE RULES
  • Under 50 characters — ruthlessly brief
  • Curiosity-driving — make ${contact.firstName} want to open it
  • Hyper-specific: reference their work, company news, or a shared context
  • Sentence case, no ALL CAPS, minimal punctuation — sounds like a real person
  • Opens with familiarity or relevance in the first 2–3 words

LENGTH: ${lengthDesc}

SIGN-OFF: Do not include a sign-off, closing phrase, personal signature, sender name, or "[Your Name]" placeholder. End with the CTA (or the permitted P.S. link note).

${voiceSection}
${linkPlacementBlock}

STYLING RULES
  • Bold all verbatim quoted text — any time you include a direct quote from the buyer or a named source inside quotation marks, wrap the entire quoted passage (including the quotation marks) in **double asterisks** so it renders as bold.
    Example: Your post on LinkedIn re: advisor independence: **"Advisor independence means little without the infrastructure to act on it."** — that stood out.
    Apply this only to genuine verbatim quotes set off in quotation marks. Do not bold paraphrases, summaries, or your own phrasing.
  • Bold the crux of the VALUE layer — wrap the key outcome phrase (the specific capability or result) in **double asterisks**.
    Example: "That's exactly what [Company] was built for — **giving senior advisors the planning resources and open investment access needed to address complex life-change scenarios while preserving a differentiated, advisor-owned practice.**"
  • Bold the entire EB sentence predicate in the PROOF layer — from the verb phrase through the final unit/frequency, so the full economic claim reads as one emphatic unit.
    Example: "Our Advisor Partnership Platform **protects recurring revenue by successfully transferring client assets, gaining on average $9,000 per $1M of AUM retained yearly.**"
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

  const rawResult = completion.choices[0]?.message?.content ?? "";
  const result = stripPersonalSignoff(rawResult);
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
// unused insight category, each using the highest-scoring insight from that
// category. This includes Colleague and Counterpart when those signals exist.
// Variant jobs are created immediately so the frontend shows them as
// "generating" without waiting.

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
  const [[contact], personal] = await Promise.all([
    db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1),
    db.select().from(contactInsightsTable).where(
      and(eq(contactInsightsTable.contactId, contactId), eq(contactInsightsTable.category, "personal"))
    ),
  ]);
  if (!contact) return;

  const [colleagueContext, counterpartContext] = await Promise.all([
    loadRelationshipInsights(contactId, "colleague"),
    loadRelationshipInsights(contactId, "counterpart"),
  ]);
  const colleague = colleagueContext.items;
  const counterpart = counterpartContext.items;

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
    // Keep one variant for every available category. In particular, do not
    // let the relationship categories be dropped by a fixed five-variant cap.
    if (variantSpecs.length === VARIANT_CATEGORIES.length) break;
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

/** Remove an accidental personal closing while preserving the optional P.S. and structure block. */
function stripPersonalSignoff(raw: string): string {
  const structureMatch = raw.match(/\[STRUCTURE_JSON\][\s\S]*?\[\/STRUCTURE_JSON\]/);
  const email = structureMatch?.index === undefined ? raw : raw.slice(0, structureMatch.index);
  const structure = structureMatch?.[0] ?? "";
  const psMatch = email.match(/\n\s*(P\.S\.[\s\S]*)$/i);
  const beforePs = psMatch ? email.slice(0, psMatch.index) : email;
  const ps = psMatch?.[1]?.trim() ?? "";
  const signaturePattern = /\n\s*(?:best|best regards|kind regards|warm regards|regards|sincerely|cheers|thanks|thank you|all the best|talk soon)[,!:\s]*(?:\n\s*(?:\[Your Name\]|[A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){1,3}))?\s*$/i;
  const cleanedBeforePs = beforePs.replace(signaturePattern, "").trimEnd();
  const cleanedEmail = ps ? `${cleanedBeforePs}\n\n${ps}` : cleanedBeforePs;
  return structure ? `${cleanedEmail}\n${structure}` : cleanedEmail;
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
    const uid = getUserId(req);
    const jobs = await db.select().from(outreachJobsTable)
      .where(and(eq(outreachJobsTable.contactId, contactId), eq(outreachJobsTable.userId, uid!)))
      .orderBy(desc(outreachJobsTable.createdAt));
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

    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

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
    const uid = getUserId(req);
    const [job] = await db.select().from(outreachJobsTable)
      .where(and(eq(outreachJobsTable.id, jobId), eq(outreachJobsTable.userId, uid!)))
      .limit(1);
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
    const uid = getUserId(req);
    const { title } = req.body ?? {};
    if (!title) { res.status(400).json({ error: "title is required" }); return; }
    const [job] = await db.update(outreachJobsTable)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(outreachJobsTable.id, jobId), eq(outreachJobsTable.userId, uid!)))
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
    const uid = getUserId(req);
    // First verify ownership
    const [parent] = await db.select({ id: outreachJobsTable.id })
      .from(outreachJobsTable)
      .where(and(eq(outreachJobsTable.id, jobId), eq(outreachJobsTable.userId, uid!)))
      .limit(1);
    if (!parent) { res.status(404).json({ error: "Job not found" }); return; }
    // Cascade-delete variant children (same user's variants)
    await db.delete(outreachJobsTable).where(
      and(
        sql`(${outreachJobsTable.params}->>'parentJobId')::integer = ${jobId}`,
        eq(outreachJobsTable.userId, uid!),
      )
    );
    await db.delete(outreachJobsTable).where(
      and(eq(outreachJobsTable.id, jobId), eq(outreachJobsTable.userId, uid!))
    );
    res.status(204).end();
  } catch (err) {
    console.error("Delete outreach job error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
