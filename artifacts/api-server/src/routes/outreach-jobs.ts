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

  const params = job.params as { length: string; tone: string; selectedInsightKeys: string[] };
  const selectedSet = new Set(params.selectedInsightKeys ?? []);

  const [[contact], personal, industry, role, colleague, counterpart] = await Promise.all([
    db.select().from(contactsTable).where(eq(contactsTable.id, job.contactId)).limit(1),
    db.select().from(contactInsightsTable).where(and(eq(contactInsightsTable.contactId, job.contactId), eq(contactInsightsTable.category, "personal"))),
    db.select().from(industryInsightsTable).where(eq(industryInsightsTable.contactId, job.contactId)),
    db.select().from(roleInsightsTable).where(eq(roleInsightsTable.contactId, job.contactId)),
    db.select().from(colleagueInsightsTable).where(eq(colleagueInsightsTable.contactId, job.contactId)),
    db.select().from(counterpartInsightsTable).where(eq(counterpartInsightsTable.contactId, job.contactId)),
  ]);

  if (!contact) throw new Error("Contact not found");

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

  const insightsSection = allSelected.length > 0
    ? allSelected.map(i => fmtInsight(i)).join("\n")
    : "  No specific insights selected — use general professional context.";

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
- Tone: ${tone}

RULES
1. Write ONLY the email body — no subject line, no "Subject:", no headers
2. Open with a hyper-specific, personalised hook that references one of the intelligence items above
3. Never open with "I hope this email finds you well" or any variation of that cliché
4. Tie the sender's value prop naturally to ${contact.firstName}'s context — don't pitch generically
5. One clear CTA at the end — suggest a 15-min call or reply to explore fit
6. Sign off with "[Your Name]" as a placeholder signature
7. Respect the length parameter strictly
8. Match the tone: ${tone}`;

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

    const [job] = await db.insert(outreachJobsTable)
      .values({ contactId, type, title, params, status: "generating" })
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
