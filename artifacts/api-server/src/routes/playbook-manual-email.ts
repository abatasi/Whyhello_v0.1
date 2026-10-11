import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  sequencesTable, sequenceStepsTable, sequenceEnrollmentsTable, contactsTable, companiesTable,
  dnaProfilesTable, userEmailAccountsTable, usersTable, contactInsightsTable, companyInsightsTable,
  roleInsightsTable, industryInsightsTable, colleagueInsightsTable, counterpartInsightsTable, insightQuotesTable, insightRelevanceScoresTable,
} from "@workspace/db/schema";
import { eq, and, ne, desc, inArray } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getValidAccessToken, sendViaGmail, sendViaOutlook } from "./email-accounts.js";
import { assertFilledEmail, resolveEvidenceIds } from "../lib/manual-email-evidence.js";
import { EMAIL_INSIGHT_CATEGORIES, emailAnatomySchema, emailBodyFromAnatomy, manualEmailGuidance, resolveEmailShape } from "../lib/manual-email-guidance.js";
import { firstHandMeetingContext, playbookMessageContext, preserveFirstHandMeeting } from "../lib/playbook-message-context.js";
import { selectTopPlaybookInsight } from "../lib/playbook-insight-selection.js";
import { assertEmailCompactionSafe, fitManualEmailLength } from "../lib/manual-email-length-fit.js";
import { storedPlaybookNodes, multiContactCanvas, multiRecipientContext, BUYING_CENTER_MESSAGING_GUIDANCE } from "../lib/multi-contact-playbook.js";
import { resolveActiveHqVoice, resolveOutputVoice, voicePersonaOptions, VoicePersonaSelectionError, type OutputVoiceSelection } from "../lib/voice-personas.js";

export const timing = z.object({
  unit: z.enum(["immediately", "minutes", "hours", "days", "business-days", "specific"]),
  amount: z.number().int().min(1).max(525600), at: z.string().max(100),
});
const subjectLine = z.string().trim().min(1).max(255).regex(/^[^\r\n]*$/, "Email subjects must be a single line.");
const previewSchema = z.object({
  subject: subjectLine, body: z.string().trim().min(1).max(20000),
  personalization: z.string().max(4000), cta: z.string().max(2000), contactId: z.number().int().positive(),
  insightsUsed: z.array(z.object({
    id: z.string(), category: z.string(), title: z.string(), description: z.string(), url: z.string(),
  })).max(100),
  anatomy: emailAnatomySchema.optional(),
});
export const variantSchema = z.object({
  id: z.string().min(1).max(128), name: z.string().min(1).max(255),
  allocation: z.number().int().min(0).max(100), mode: z.enum(["assisted", "prompt", "template"]),
  emailType: z.enum(["Outreach", "Follow-up", "Last pitch"]),
  researchSources: z.array(z.enum(["company-news", "job-postings", "executive", "strategic", "personal", "company", "colleagues", "industry", "competitors", "role", "counterparts"])).max(11),
  tone: z.enum(["Default", "Direct", "Formal", "Casual", "Creative", "Custom", "Professional", "Friendly", "Warm", "Authoritative"]),
  length: z.enum(["short", "medium", "long"]).optional(),
  insightCategory: z.enum(EMAIL_INSIGHT_CATEGORIES).optional(),
  customTone: z.string().max(2000), inheritHqTone: z.boolean(),
  voicePersonaId: z.string().trim().min(1).max(100).nullable().optional(),
  contextSources: z.array(z.enum(["company", "products", "solutions", "customers", "competition", "value-propositions", "target-market", "buying-center", "custom"])).max(9),
  userContext: z.string().max(6000), guidelines: z.array(z.object({ id: z.string(), text: z.string().max(1000) })).max(30),
  generationMode: z.enum(["Standard", "Concise", "Detailed", "Experimental"]), prompt: z.string().max(8000),
  templateId: z.string().max(128), templateSubject: z.string().max(255).regex(/^[^\r\n]*$/), templateBody: z.string().max(20000),
  preview: previewSchema.optional(),
});
const configSchema = z.object({
  version: z.literal(1), enabled: z.boolean(), createTiming: timing, dueTiming: timing,
  variants: z.array(variantSchema).min(1).max(6),
});

export function manualEmailConfigurationError(value: unknown): string | null {
  const parsed = configSchema.safeParse(value);
  if (!parsed.success) return "Complete the Manual Email configuration.";
  const config = parsed.data;
  if (!config.enabled) return null;
  if (config.variants.reduce((sum, v) => sum + v.allocation, 0) !== 100) return "Manual Email traffic allocation must total 100%.";
  for (const t of [config.createTiming, config.dueTiming]) {
    if (t.unit === "specific" && (!t.at || Number.isNaN(Date.parse(t.at)))) return "Choose a valid task date and time.";
  }
  for (const v of config.variants.filter(v => v.allocation > 0)) {
    if (v.tone === "Custom" && !v.customTone.trim()) return "Add custom tone instructions.";
    if (v.mode === "prompt" && !v.prompt.trim()) return "Add email generation instructions.";
    if (v.mode === "template" && (!v.templateSubject.trim() || !v.templateBody.trim())) return "Complete the email template.";
    if (v.mode !== "template" && (!v.preview?.subject || !v.preview.body)) return "Generate and save a Manual Email preview before activating.";
  }
  return null;
}

export const manualEmailRouter: IRouter = Router({ mergeParams: true });
export const requireOwnedPlaybook: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  const userId = (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId;
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid Playbook" }); return; }
  try {
    const [record] = await db.select().from(sequencesTable).where(and(eq(sequencesTable.id, id), eq(sequencesTable.userId, userId)));
    if (!record) { res.status(404).json({ error: "Playbook not found" }); return; }
    res.locals.playbook = record;
    res.locals.userId = userId;
    next();
  } catch { res.status(500).json({ error: "Playbook could not be loaded." }); }
};
manualEmailRouter.use(requireOwnedPlaybook);

async function loadHqContext(userId: string, selection?: OutputVoiceSelection) {
  const [record] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId));
  const data = record ? JSON.parse(record.data) : {};
  const meaningful = (value: unknown): boolean => {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(meaningful);
    if (value && typeof value === "object") return Object.entries(value).some(([key, item]) => key !== "id" && meaningful(item));
    return typeof value === "number" || value === true;
  };
  const serialize = (value: unknown) => meaningful(value) ? JSON.stringify(value, null, 2).slice(0, 12000) : "";
  const liveMarket = (data.targetMarkets ?? []).find((v: { id: string }) => v.id === data.liveTargetMarketId);
  const liveCenter = (data.buyingCenters ?? []).find((v: { id: string }) => v.id === data.liveBuyingCenterId);
  const contextSources = [
    { id: "company", name: "Company", content: serialize(data.company) },
    { id: "products", name: "Products", content: serialize(data.products?.length ? data.products : null) },
    { id: "solutions", name: "Solutions", content: serialize((data.products ?? []).filter((v: { type?: string }) => v.type === "solution")) },
    { id: "customers", name: "Customers", content: serialize(data.customers?.length ? data.customers : null) },
    { id: "competition", name: "Competition", content: serialize(data.competitors?.length ? data.competitors : null) },
    { id: "value-propositions", name: "Value propositions", content: serialize({ valueWedge: data.company?.valueWedge, positioning: data.company?.positioning, pillars: data.company?.pillars }) },
    { id: "target-market", name: "Live Target Market", content: serialize(liveMarket) },
    { id: "buying-center", name: "Live Buying Center", content: serialize(liveCenter) },
  ];
  const output = selection ? resolveOutputVoice(data, selection) : null;
  return {
    contextSources,
    voice: output ? output.hqVoice : record ? serialize(resolveActiveHqVoice(data)) : "",
    ...voicePersonaOptions(data),
    ...(output ? { tone: output.tone } : {}),
  };
}

type HqContextResult = Awaited<ReturnType<typeof loadHqContext>>;
export function hqContext(userId: string, selection: OutputVoiceSelection): Promise<HqContextResult & { tone: string }>;
export function hqContext(userId: string): Promise<HqContextResult>;
export function hqContext(userId: string, selection?: OutputVoiceSelection): Promise<HqContextResult> {
  return loadHqContext(userId, selection);
}

manualEmailRouter.get("/context", async (_req, res) => {
  try {
    const id = res.locals.playbook.id as number;
    const userId = res.locals.userId as string;
    const assignedIds = multiContactCanvas(res.locals.playbook.description)?.seatSequences.map(seat => seat.contactId).filter((id): id is number => id !== null) ?? [];
    const assigned = assignedIds.length ? await db.select({ id: contactsTable.id, firstName: contactsTable.firstName, lastName: contactsTable.lastName, company: companiesTable.name })
      .from(contactsTable).leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id)).where(inArray(contactsTable.id, assignedIds)) : [];
    const [hq, enrolled, samples, mailboxes, templates] = await Promise.all([
      hqContext(userId),
      db.select({ id: contactsTable.id, firstName: contactsTable.firstName, lastName: contactsTable.lastName, company: companiesTable.name })
        .from(sequenceEnrollmentsTable).innerJoin(contactsTable, eq(sequenceEnrollmentsTable.contactId, contactsTable.id))
        .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id)).where(eq(sequenceEnrollmentsTable.sequenceId, id)),
      db.select({ id: contactsTable.id, firstName: contactsTable.firstName, lastName: contactsTable.lastName, company: companiesTable.name })
        .from(contactsTable).leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id)).orderBy(contactsTable.firstName).limit(600),
      db.select({ id: userEmailAccountsTable.id, email: userEmailAccountsTable.email, provider: userEmailAccountsTable.provider })
        .from(userEmailAccountsTable).where(eq(userEmailAccountsTable.userId, userId)),
      db.select({ id: sequenceStepsTable.id, name: sequencesTable.name, subject: sequenceStepsTable.subject, body: sequenceStepsTable.body })
        .from(sequenceStepsTable).innerJoin(sequencesTable, eq(sequenceStepsTable.sequenceId, sequencesTable.id))
        .where(eq(sequencesTable.userId, userId)).limit(100),
    ]);
    const seen = new Set<number>();
    const contacts = [...enrolled.map(v => ({ ...v, enrolled: true })), ...assigned.map(v => ({ ...v, enrolled: false })), ...samples.map(v => ({ ...v, enrolled: false }))]
      .filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; })
      .map(v => ({ id: v.id, name: `${v.firstName ?? ""} ${v.lastName ?? ""}`.trim(), company: v.company ?? "", enrolled: v.enrolled }));
    // Also expose genuinely saved inline drafts as reusable templates.
    const saved = await db.select({ id: sequencesTable.id, name: sequencesTable.name, description: sequencesTable.description })
      .from(sequencesTable).where(eq(sequencesTable.userId, userId)).limit(100);
    const inlineTemplates: { id: string; name: string; subject: string; body: string }[] = [];
    for (const record of saved) {
      if (!record.description?.trim().startsWith("{")) continue;
      let canvas: { nodes?: { id: string; data?: Record<string, unknown> }[] };
      try { canvas = { nodes: storedPlaybookNodes(record.description) }; } catch { continue; }
      for (const node of canvas.nodes ?? []) {
        const config = configSchema.safeParse(node.data?.configuration);
        if (!config.success) continue;
        for (const v of config.data.variants) {
          const subject = v.mode === "template" ? v.templateSubject : v.preview?.subject;
          const body = v.mode === "template" ? v.templateBody : v.preview?.body;
          if (subject && body) inlineTemplates.push({ id: `${record.id}:${node.id}:${v.id}`, name: `${record.name} / ${v.name}`, subject, body });
        }
      }
    }
    res.json({ ...hq, contacts, mailboxes,
      aiAvailable: Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL),
      templates: [...templates.filter(v => v.subject && v.body).map(v => ({ ...v, id: String(v.id), subject: v.subject!, body: v.body! })), ...inlineTemplates] });
  } catch { res.status(500).json({ error: "Could not load contacts, HQ context, or mailboxes." }); }
});

type Evidence = { id: string; category: string; title: string; description: string; url: string };
export async function collectPlaybookEvidence(contact: typeof contactsTable.$inferSelect, company: typeof companiesTable.$inferSelect | undefined, sources: string[]): Promise<Evidence[]> {
  const contactId = contact.id;
  const evidence: Evidence[] = [];
  const scoreRows = await db.select().from(insightRelevanceScoresTable)
    .where(eq(insightRelevanceScoresTable.contactId, contactId))
    .orderBy(desc(insightRelevanceScoresTable.computedAt), desc(insightRelevanceScoresTable.id));
  // The newest computation wins when legacy duplicate score rows exist.
  const scores = new Map(scoreRows.reverse().map(row => [`${row.signalType}:${row.signalId}`, row.score]));
  const add = (category: string, signalType: string, rows: { id: number; title: string; description: string | null; url: string }[]) => {
    const row = selectTopPlaybookInsight(rows, signalType, scores);
    if (row) evidence.push({ id: `${category}:${row.id}`, category, title: row.title, description: row.description ?? "", url: row.url });
  };
  const wanted = new Set(sources);
  if (wanted.has("personal") || wanted.has("executive")) {
    add("Personal / Executive Persona Research", "personal", await db.select().from(contactInsightsTable).where(eq(contactInsightsTable.contactId, contactId)));
  }
  if (company && ["company-news", "job-postings", "strategic", "company", "competitors"].some(s => wanted.has(s))) {
    const rows = await db.select().from(companyInsightsTable).where(eq(companyInsightsTable.companyId, company.id));
    const jobs = (r: typeof rows[number]) => /hiring|vacanc|job posting|recruit|career/i.test(`${r.title} ${r.description}`);
    if (wanted.has("job-postings")) add("Relevant Job Postings", "company", rows.filter(jobs));
    if (wanted.has("company-news") || wanted.has("strategic") || wanted.has("company")) add("Company / Strategic Company Research", "company", wanted.has("company") ? rows : rows.filter(r => !jobs(r)));
    if (wanted.has("competitors")) add("Competitors", "company", rows.filter(r => /competit|rival/i.test(`${r.title} ${r.description}`)));
  }
  if (wanted.has("role") && contact.roleId) add("Role", "role", await db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contact.roleId)));
  const industryId = contact.industryId ?? company?.industryId;
  if (wanted.has("industry") && industryId) add("Industry", "industry", await db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, industryId)));
  for (const category of ["colleagues", "counterparts"]) {
    if (!wanted.has(category)) continue;
    const table = category === "colleagues" ? colleagueInsightsTable : counterpartInsightsTable;
    const rows = await db.select({ id: table.id, title: table.title, description: table.description, url: table.url, firstName: contactsTable.firstName, lastName: contactsTable.lastName, companyId: contactsTable.companyId })
      .from(table).innerJoin(contactInsightsTable, eq(table.url, contactInsightsTable.url))
      .innerJoin(contactsTable, eq(contactInsightsTable.contactId, contactsTable.id))
      .where(and(eq(table.contactId, contactId), ne(contactsTable.id, contactId)));
    const validRows = rows.filter(row =>
      (row.title.trim() || row.description?.trim())
      && (category !== "colleagues" || row.companyId === contact.companyId));
    add(category, category === "colleagues" ? "colleague" : "counterpart", validRows.map(row => ({ ...row, description: `Source person: ${row.firstName} ${row.lastName}. ${row.description ?? ""}` })));
  }
  return evidence;
}
manualEmailRouter.post("/preview", async (req, res) => {
  const input = z.object({ variant: variantSchema, contactId: z.number().int().positive(), regeneration: z.string().max(1000).default("") }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Check the email configuration and select a real preview contact." }); return; }
  try {
    const { variant: v, contactId, regeneration } = input.data;
    if (v.tone === "Custom" && !v.customTone.trim()) { res.status(400).json({ error: "Add custom tone instructions." }); return; }
    if (v.mode === "prompt" && !v.prompt.trim()) { res.status(400).json({ error: "Add email generation instructions." }); return; }
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId));
    if (!contact) { res.status(404).json({ error: "Contact not found." }); return; }
    const audience = multiRecipientContext(res.locals.playbook.description, contactId, contact.companyId);
    if (audience.error) { res.status(400).json({ error: audience.error }); return; }
    const [company] = contact.companyId ? await db.select().from(companiesTable).where(eq(companiesTable.id, contact.companyId)) : [];
    if (v.mode === "template") {
      const fields: Record<string, string> = {
        firstName: contact.firstName ?? "", lastName: contact.lastName ?? "",
        fullName: `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
        company: company?.name ?? "", jobTitle: contact.jobTitle ?? "",
      };
      const render = (text: string) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
        if (!(key in fields) || !fields[key]) throw new Error(`Template field "${key}" is unavailable for this contact.`);
        return fields[key];
      });
      if (!v.templateSubject.trim() || !v.templateBody.trim()) { res.status(400).json({ error: "Add a template subject and body." }); return; }
      res.json({ subject: render(v.templateSubject), body: render(v.templateBody), contactId,
        personalization: `Template populated using ${fields.fullName}'s actual contact details.`, cta: "", insightsUsed: [] }); return;
    }
    const hq = await hqContext(res.locals.userId, v);
    const shape = resolveEmailShape(v);
    const evidence = await collectPlaybookEvidence(contact, company, [shape.insightCategory]);
    if (!evidence.length) {
      res.status(422).json({ error: `No usable ${shape.insightCategory} insights are available for this contact. Choose another category or preview contact. Your saved content has not been changed.` });
      return;
    }
    const quoteCategory = shape.insightCategory === "colleagues" ? "colleague" : shape.insightCategory === "counterparts" ? "counterpart" : shape.insightCategory;
    const quotes = (await db.select().from(insightQuotesTable).where(and(eq(insightQuotesTable.contactId, contactId), eq(insightQuotesTable.signalType, quoteCategory))))
      .filter(quote => evidence.some(item => Number(item.id.split(":").at(-1)) === quote.signalId))
      .map(quote => ({ quote: quote.quote, attribution: quote.attribution, attributionRole: quote.attributionRole, signalId: quote.signalId }));
    const { insideOut, additionalContext } = playbookMessageContext(hq.contextSources, v);
    const requiredFirstHandContext = firstHandMeetingContext(additionalContext);
    if (!insideOut.length && !additionalContext) {
      res.status(422).json({ error: "Select available seller HQ context or add additional context to ground the email's value and proof. Your saved content has not been changed." });
      return;
    }
    const messages = [
        { role: "system", content: manualEmailGuidance(shape.insightCategory, shape.length, Math.random() < 0.5 ? "inline" : "postscript") },
        { role: "system", content: BUYING_CENTER_MESSAGING_GUIDANCE },
        { role: "user", content: JSON.stringify({
          contact: { firstName: contact.firstName, lastName: contact.lastName, title: contact.jobTitle, company: company?.name },
          emailType: v.emailType, mode: v.mode, prompt: v.mode === "prompt" ? v.prompt : "",
          tone: hq.tone, hqVoice: hq.voice,
          guidelines: v.guidelines.map(g => g.text), length: shape.length, insightCategory: shape.insightCategory,
           insideOut, additionalContext, requiredFirstHandContext, evidence, quotes, regeneration, buyingCenterSeat: audience.seat,
        }) },
      ] as { role: "system" | "user" | "assistant"; content: string }[];
    const result = await openai.chat.completions.create({
      model: "gpt-5-mini", response_format: { type: "json_object" }, messages,
    }, { timeout: 120000, maxRetries: 0 });
    const raw = result.choices[0]?.message?.content;
    if (!raw) throw new Error("Generation returned no content.");
    const outputSchema = z.object({
      subject: subjectLine, anatomy: emailAnatomySchema,
      personalization: z.string().max(4000), insightIdsUsed: z.array(z.string()).min(1),
      postscript: z.string().max(2000).default(""),
    });
    const original = preserveFirstHandMeeting(outputSchema.parse(JSON.parse(raw)), requiredFirstHandContext);
    resolveEvidenceIds(evidence, original.insightIdsUsed);
    assertFilledEmail(original.subject, emailBodyFromAnatomy(original.anatomy, original.postscript));
    const generated = await fitManualEmailLength(original, shape.length, async instruction => {
      const edited = await openai.chat.completions.create({
        model: "gpt-5-mini", response_format: { type: "json_object" },
        messages: [...messages, { role: "assistant", content: JSON.stringify(original) }, { role: "user", content: instruction }],
      }, { timeout: 60000, maxRetries: 0 });
      const candidate = preserveFirstHandMeeting(outputSchema.parse(JSON.parse(edited.choices[0]?.message?.content ?? "")), requiredFirstHandContext);
      resolveEvidenceIds(evidence, candidate.insightIdsUsed);
      if (candidate.insightIdsUsed.some(id => !original.insightIdsUsed.includes(id))) throw new Error("Editing introduced a new evidence citation.");
      assertEmailCompactionSafe(original, candidate, quotes.map(source => source.quote));
      assertFilledEmail(candidate.subject, emailBodyFromAnatomy(candidate.anatomy, candidate.postscript));
      return candidate;
    });
    // Required anatomy/evidence still apply; length alone never rejects a preview.
    const body = emailBodyFromAnatomy(generated.anatomy, generated.postscript);
    const insightsUsed = resolveEvidenceIds(evidence, generated.insightIdsUsed);
    assertFilledEmail(generated.subject, body);
    res.json({ subject: generated.subject, body, anatomy: generated.anatomy, cta: generated.anatomy.cta,
      personalization: generated.personalization, contactId, insightsUsed });
  } catch (error) {
    if (error instanceof VoicePersonaSelectionError) { res.status(400).json({ error: error.message }); return; }
    const message = error instanceof Error && error.message.startsWith("Template field") ? error.message
      : error instanceof Error && /Generated (evidence citation|email contains)/.test(error.message)
      ? "The generated preview could not be verified. Generate again; your saved content has not been changed."
      : "Preview generation failed. Your saved content has not been changed.";
    res.status(message.startsWith("Template field") ? 400 : 502).json({ error: message });
  }
});

manualEmailRouter.post("/test", async (req, res) => {
  const input = z.object({ subject: subjectLine, body: z.string().trim().min(1).max(20000), accountId: z.number().int().positive() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Generate a preview and choose a connected mailbox first." }); return; }
  try {
    const userId = res.locals.userId as string;
    const [account] = await db.select().from(userEmailAccountsTable).where(and(eq(userEmailAccountsTable.id, input.data.accountId), eq(userEmailAccountsTable.userId, userId)));
    if (!account) { res.status(409).json({ error: "Connect your own mailbox before sending a test." }); return; }
    const [localUser] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
    let email = localUser?.email;
    if (!email) {
      const authId = getAuth(req).userId;
      if (authId) {
        const user = await clerkClient.users.getUser(authId);
        email = user.emailAddresses.find(v => v.id === user.primaryEmailAddressId)?.emailAddress ?? null;
      }
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(409).json({ error: "A valid signed-in user email is required. No message was sent." }); return; }
    const accessToken = await getValidAccessToken(account);
    if (!accessToken) { res.status(401).json({ error: "Reconnect your mailbox before sending a test." }); return; }
    const { subject, body } = input.data;
    if (account.provider === "gmail") await sendViaGmail(accessToken, email, null, subject, body);
    else if (account.provider === "outlook") await sendViaOutlook(accessToken, email, null, subject, body);
    else { res.status(400).json({ error: "This mailbox provider does not support test emails." }); return; }
    res.json({ success: true });
  } catch { res.status(502).json({ error: "The test email could not be sent. Check your mailbox connection." }); }
});