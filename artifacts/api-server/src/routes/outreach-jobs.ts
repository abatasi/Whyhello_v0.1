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
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

export const contactJobsRouter: IRouter = Router({ mergeParams: true });
export const jobsRouter: IRouter = Router({ mergeParams: true });

type InsightRow = { id: number; title: string; source: string; description?: string | null; publishedDate?: string | null };

function fmtInsight(i: InsightRow) {
  return `  • "${i.title}" (${i.source}${i.publishedDate ? ", " + i.publishedDate : ""})${i.description ? "\n    " + i.description : ""}`;
}

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

  const [[contact], personal, colleague, counterpart] = await Promise.all([
    db.select().from(contactsTable).where(eq(contactsTable.id, job.contactId)).limit(1),
    db.select().from(contactInsightsTable).where(and(eq(contactInsightsTable.contactId, job.contactId), eq(contactInsightsTable.category, "personal"))),
    db.select().from(colleagueInsightsTable).where(eq(colleagueInsightsTable.contactId, job.contactId)),
    db.select().from(counterpartInsightsTable).where(eq(counterpartInsightsTable.contactId, job.contactId)),
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

  const allSelected = [...fp.map(i => ({ ...i, prefix: "personal" })), ...fi.map(i => ({ ...i, prefix: "industry" })), ...fr.map(i => ({ ...i, prefix: "role" })), ...fc.map(i => ({ ...i, prefix: "colleague" })), ...fct.map(i => ({ ...i, prefix: "counterpart" })), ...fci.map(i => ({ ...i, prefix: "company" }))];

  const lengthMap: Record<string, string> = { short: "~100 words, one punchy paragraph", medium: "~200 words, intro + value prop + CTA", long: "~350 words, full context, value prop, and CTA" };
  const lengthDesc = lengthMap[params.length] ?? "~200 words";
  const tone = params.tone ?? "professional";
  const vp = params.voiceProfile;

  const insightsSection = allSelected.length > 0
    ? allSelected.map(i => fmtInsight(i)).join("\n")
    : "  No specific insights selected — use general professional context.";

  function buildVoiceGuide(v: NonNullable<typeof vp>): string {
    const lines: string[] = ["8. Write in the sender's defined voice — follow ALL constraints below with zero exceptions:"];
    if (v.toneTags.length > 0) lines.push(`   Tone descriptors: ${v.toneTags.join(", ")}`);
    if (v.communicationStyle) lines.push(`   Communication style: ${v.communicationStyle}`);
    if (v.writingNotes) lines.push(`   Voice notes (read carefully — may contain specific closing phrases, sign-offs, or verbal habits that MUST appear verbatim): ${v.writingNotes}`);
    if (v.suppressions.length > 0) lines.push(`   NEVER use any of these: ${v.suppressions.join(", ")}`);
    if (v.suppressionNotes) lines.push(`   Also avoid: ${v.suppressionNotes}`);
    if (v.trainingText) lines.push(`   Voice sample (match this register):\n   """\n   ${v.trainingText.slice(0, 600).replace(/\n/g, "\n   ")}\n   """`);
    lines.push(`   CRITICAL: If the voice notes mention a specific closing phrase or sign-off (e.g. "Thnx!", "Cheers,", "Talk soon"), use it EXACTLY — it must appear on its own line immediately before "[Your Name]".`);
    return lines.join("\n");
  }

  const toneRule = tone === "my_voice_profile" && vp
    ? buildVoiceGuide(vp)
    : `8. Match the tone: ${tone}`;

  const systemPrompt = `You are an expert B2B sales and relationship consultant helping craft high-converting first-touch intro emails.

CONTACT TO EMAIL
Name: ${contact.firstName} ${contact.lastName}
Title: ${contact.jobTitle ?? "Unknown"}${contact.department ? " — " + contact.department : ""}
Company: ${company?.name ?? "Unknown"}${company?.industry ? " (" + company.industry + ")" : ""}
Location: ${[contact.location, contact.country].filter(Boolean).join(", ") || "Not specified"}
Bio: ${contact.bio ?? "Not available"}

INTELLIGENCE TO WEAVE IN (selected by the user):
${insightsSection}

GENERATION PARAMETERS
- Length: ${lengthDesc}
- Tone: ${tone === "my_voice_profile" ? "Sender's custom voice profile (see rule 8)" : tone}

RULES
1. Output format — EXACTLY two sections, nothing else:
   Line 1:   Subject: <your subject line>
   Line 2:   (blank line)
   Line 3+:  The email body
   Do NOT add any other headers, labels, or preamble.
2. Subject line rules (all must be satisfied):
   a. Under 50 characters — be ruthlessly brief
   b. Provocative or curiosity-driving — make them want to open it
   c. Reference something hyper-specific to ${contact.firstName} (their work, company news, a shared context) — no generic "quick question" or "following up"
   d. Sound like it came from a real person, not marketing — sentence case, no ALL CAPS, no excessive punctuation
   e. Establish familiarity or relevance in the first 3 words where possible
3. Open the body with a hyper-specific, personalised hook that references one of the intelligence items above
4. Never open with "I hope this email finds you well" or any variation of that cliché
5. Tie the sender's value prop naturally to ${contact.firstName}'s context — don't pitch generically
6. One clear CTA at the end — suggest a 15-min call or reply to explore fit
7. ${tone === "my_voice_profile" ? `Sign off using the sender's preferred closing phrase from their voice profile (see rule 8) followed by "[Your Name]" — do NOT invent a different closing` : `Sign off with "[Your Name]" as a placeholder signature`}
8. Respect the length parameter strictly (body only, not counting the subject line)
${toneRule}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate the intro email to ${contact.firstName} ${contact.lastName}.` },
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
