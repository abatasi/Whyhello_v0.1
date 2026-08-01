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
    short: "~100 words body (subject excluded) — one tight Observe→Interpret→Bridge→Offer arc",
    medium: "~200 words body — full OIBEO arc with one proof point",
    long: "~350 words body — complete OIBEO arc with developed Bridge, Educate, and Offer",
  };
  const lengthDesc = lengthMap[params.length] ?? "~200 words body";
  const tone = params.tone ?? "professional";
  const vp = params.voiceProfile;

  const insightsSection = allSelected.length > 0
    ? allSelected.map(i => fmtInsight(i)).join("\n")
    : "  No specific insights selected — use general professional context about their role and company.";

  const quotesSection = quotes.length > 0
    ? quotes.map((q, i) => {
        const bridge = q.hqBridge ? `\n    HQ Bridge: ${q.hqBridge}` : "";
        const role = q.attributionRole ? `, ${q.attributionRole}` : "";
        return `[${i + 1}] "${q.quote}"\n    — ${q.attribution}${role}${bridge}`;
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

  const quotesPromptBlock = quotesSection ? `
═══════════════════════════════════════════
ATTRIBUTABLE QUOTES  (use in OBSERVE when it fits)
═══════════════════════════════════════════
The following quotes are directly attributed to the buyer or people in their orbit.
When one fits naturally, open OBSERVE with it — e.g. "Came across your line on [topic]: '[quote]'..." or
"Noticed you said '[quote]' — that landed." The HQ Bridge below each quote hints at how to transition
into BRIDGE/VALUE. Only use a quote when it genuinely elevates the message; never force it.

${quotesSection}
` : "";

  const systemPrompt = `You are the AI message engine inside Whyhello, a B2B relationship intelligence platform.

Your job is to write a first-touch outreach email using the OIBEO™ Messaging Framework — a proprietary architecture that bridges outside-in intelligence (what we know about the buyer's world) with inside-out messaging (what the seller offers and why it matters).
${quotesPromptBlock}
═══════════════════════════════════════════
BUYER CONTEXT  (outside-in intelligence)
═══════════════════════════════════════════
Name: ${contact.firstName} ${contact.lastName}
Title: ${contact.jobTitle ?? "Unknown"}${contact.department ? " — " + contact.department : ""}
Company: ${company?.name ?? "Unknown"}${company?.industry ? " (" + company.industry + ")" : ""}
Location: ${[contact.location, contact.country].filter(Boolean).join(", ") || "Not specified"}
Bio: ${contact.bio ?? "Not available"}

SELECTED INTELLIGENCE (the raw material for OBSERVE and INTERPRET layers):
${insightsSection}

═══════════════════════════════════════════
SELLER CONTEXT  (inside-out intelligence)
═══════════════════════════════════════════
${sellerContext}

═══════════════════════════════════════════
THE OIBEO™ MESSAGING FRAMEWORK
═══════════════════════════════════════════
Every email you write must follow this five-layer structure in order.
Each layer has a distinct job — do not skip or collapse any of them.

LAYER 1 — OBSERVE  (Interrupt)
  Purpose : Earn attention by opening with one specific, verifiable fact from the
            selected intelligence above. Something ${contact.firstName} would immediately
            recognise as true about their world.
  Rules   : No opinions. No "I". Pure observation.
            Starters: "Saw...", "I noticed...", "One thing that stood out...",
            "Interesting to see...", "It was striking that..."

LAYER 2 — INTERPRET  (Engage)
  Purpose : Show understanding. Explain why that observation matters in their world —
            the business implication, the pressure it creates, the decision it forces.
  Rules   : Still zero self-reference. Talk about them.
            Starters: "That usually signals...", "I imagine that creates...",
            "Most [role]s at this stage find...", "That pace often introduces..."

LAYER 3 — BRIDGE  (Educate — transition)
  Purpose : Connect their reality to your expertise without pitching yet.
            Translate the observation into a pattern you've seen across other buyers.
  Rules   : Introduce a useful mental model or market observation.
            DO NOT mention your product or company name yet.
            Starters: "One pattern we've been seeing across...",
            "The firms that navigate this best tend to...",
            "What's interesting is that once [observation], the real constraint shifts to..."

LAYER 4 — VALUE  (Educate — resolution)
  Purpose : Only NOW introduce the seller. Not features — value.
            The company becomes a natural continuation of the conversation.
  Rules   : Use the seller context above. Be specific about the outcome, not the mechanism.
            Starters: "That's exactly the problem [Company] was built for...",
            "We help [persona] [achieve outcome] without [friction]...",
            "What we've seen with firms like [customer profile] is..."

LAYER 5 — OFFER  (Offer)
  Purpose : A low-friction next step that advances the conversation without demanding commitment.
  Rules   : NEVER say "Book a demo" or "Schedule a call".
            Instead: "Happy to share how other firms are approaching this if useful.",
            "Worth a quick exchange?", "I'd be glad to share some examples.",
            "We recently put together a benchmark — happy to send it over."

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════
Line 1:   Subject: <subject line>
Line 2:   (blank)
Line 3+:  Email body (OIBEO layers in order, no section labels)

SUBJECT LINE RULES
  • Under 50 characters — ruthlessly brief
  • Curiosity-driving — make them want to open it
  • Hyper-specific to ${contact.firstName}: reference their work, company news, or a shared context
  • Sentence case, no ALL CAPS, minimal punctuation — sounds like a real person
  • Opens with familiarity or relevance in the first 2–3 words where possible

LENGTH: ${lengthDesc}

SIGN-OFF: ${tone === "my_voice_profile" ? "Use the sender's preferred closing phrase from the voice profile below, followed by \"[Your Name]\" on the next line" : "Sign off with \"[Your Name]\" as a placeholder — no invented name"}

${voiceSection}

ABSOLUTE PROHIBITIONS
  • Never open with "I hope this email finds you well" or any variant
  • Never open the body with "I" as the first word
  • Never add section labels (OBSERVE:, BRIDGE:, etc.) to the output
  • Never fabricate statistics or claim specific results unless drawn from the seller context above`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write the OIBEO™ email to ${contact.firstName} ${contact.lastName}.` },
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

/** Extract subject and body from AI output that starts with "Subject: ..." */
function parseEmailResult(result: string): { subject: string; body: string } {
  const firstNewline = result.indexOf("\n");
  if (firstNewline === -1) return { subject: "", body: result };
  const firstLine = result.slice(0, firstNewline).trim();
  const rest = result.slice(firstNewline).replace(/^\n+/, "");
  if (firstLine.toLowerCase().startsWith("subject:")) {
    return { subject: firstLine.slice("subject:".length).trim(), body: rest };
  }
  return { subject: "", body: result };
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
