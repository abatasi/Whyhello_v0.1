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
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

export const contactJobsRouter: IRouter = Router({ mergeParams: true });
export const jobsRouter: IRouter = Router({ mergeParams: true });

type InsightRow = { id: number; title: string; source: string; description?: string | null; publishedDate?: string | null };

function fmtInsight(i: InsightRow) {
  return `  • "${i.title}" (${i.source}${i.publishedDate ? ", " + i.publishedDate : ""})${i.description ? "\n    " + i.description : ""}`;
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

  const allSelected = [
    ...fp.map(i => ({ ...i, prefix: "personal" })),
    ...fi.map(i => ({ ...i, prefix: "industry" })),
    ...fr.map(i => ({ ...i, prefix: "role" })),
    ...fc.map(i => ({ ...i, prefix: "colleague" })),
    ...fct.map(i => ({ ...i, prefix: "counterpart" })),
    ...fci.map(i => ({ ...i, prefix: "company" })),
  ];

  const lengthMap: Record<string, string> = {
    short:  "~100 words body — HOOK + BRIDGE + VALUE + CTA; omit PROOF or compress to one EB clause",
    medium: "~200 words body — full HOOK / BRIDGE / VALUE / PROOF / CTA arc with one EB sentence",
    long:   "~350 words body — complete arc with an expanded VALUE paragraph, full PROOF with customer reference and EB, and a tailored CTA",
  };
  const lengthDesc = lengthMap[params.length] ?? "~200 words body";
  const tone = params.tone ?? "professional";
  const vp = params.voiceProfile;

  const insightsSection = allSelected.length > 0
    ? allSelected.map(i => fmtInsight(i)).join("\n")
    : "  No specific insights selected — use general professional context about their role and company.";

  const quotesSection = quotes.length > 0
    ? quotes.map((q, i) => {
        const bridgeLine = q.hqBridge ? `\n    HQ Bridge: ${q.hqBridge}` : "";
        const roleLine = q.attributionRole ? `, ${q.attributionRole}` : "";
        return `[${i + 1}] "${q.quote}"\n    — ${q.attribution}${roleLine}${bridgeLine}`;
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

  const quotesBlock = quotesSection ? `
═══════════════════════════════════════════
ATTRIBUTABLE QUOTES  (highest-priority HOOK material)
═══════════════════════════════════════════
These are verbatim quotes from the buyer or people in their orbit. When one fits, open the HOOK with it:
  "Came across your line on [topic]: '[quote]' — that's a real tension."
  "Noticed you said '[quote]' — that's the crux of it."
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

SELECTED SIGNALS — choose your HOOK from here (personal quote > personal insight > company insight > industry > role):
${insightsSection}

═══════════════════════════════════════════
SELLER CONTEXT  (inside-out)
═══════════════════════════════════════════
${sellerContext}

═══════════════════════════════════════════
THE WHYHELLO COLD OUTREACH FRAMEWORK
═══════════════════════════════════════════
Write the email in exactly these five layers in order. Do not label them in the output.

LAYER 1 — HOOK  (outside-in lead — 1 sentence)
  Purpose : Open with the single most specific signal you have. Something ${contact.firstName}
            would immediately recognise as true of their world right now.
  Priority: 1. A direct quote attributed to ${contact.firstName} (from Attributable Quotes above)
            2. A personal insight — something they published, said on stage, or was featured on
            3. A company insight — a recent event (funding, launch, M&A, earnings beat/miss)
            4. An industry signal — a sector shift or regulatory move they are living inside
            5. A role-level truth — a structural pressure facing this function right now
  Rules   : Exactly one sentence. No "I". No opinion. Purely observational.
            Quote starters: "Came across your line on [topic]: '[quote]'..."
            Signal starters: "Noticed...", "Saw that...", "Interesting timing on...", "One thing that stood out..."

LAYER 2 — BRIDGE  (connect hook to the contact's implied priority)
  Purpose : Show that you understand the business consequence of the HOOK — the pressure it
            represents, the decision it forces, or the tension it creates for ${contact.firstName}.
  Rules   : Zero self-reference. Still entirely about them.
            Starters: "That usually means...", "For most ${contact.jobTitle ?? "leaders"} at this stage...",
            "That pace typically surfaces...", "The challenge that tends to follow..."

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
  const usedKeys = allSelected.map(i => `${i.prefix}-${i.id}`);

  await db.update(outreachJobsTable)
    .set({ status: "completed", result, prompt: systemPrompt, sources: usedKeys, updatedAt: new Date() })
    .where(eq(outreachJobsTable.id, jobId));

  // Save a draft to the Message Center automatically
  if (job.userId && contact.email) {
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

    const userId = (req as typeof req & { user?: { id: string } }).user?.id ?? null;

    const [job] = await db.insert(outreachJobsTable)
      .values({ contactId, userId, type, title, params, status: "generating" })
      .returning();

    res.status(201).json(job);

    runGeneration(job.id).catch(async (err) => {
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
    await db.delete(outreachJobsTable).where(eq(outreachJobsTable.id, jobId));
    res.status(204).end();
  } catch (err) {
    console.error("Delete outreach job error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
