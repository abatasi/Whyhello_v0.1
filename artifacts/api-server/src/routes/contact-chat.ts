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
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
const router: IRouter = Router({ mergeParams: true });

type RawMessage = { role: string; content: string };

function parseMessages(body: unknown): { role: "user" | "assistant"; content: string }[] | null {
  if (!body || typeof body !== "object") return null;
  const msgs = (body as Record<string, unknown>).messages;
  if (!Array.isArray(msgs)) return null;
  const result: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of msgs) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as RawMessage;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    result.push({ role, content });
  }
  return result;
}

function parseSelectedIds(body: unknown): Set<string> | null {
  if (!body || typeof body !== "object") return null;
  const ids = (body as Record<string, unknown>).selectedIds;
  if (!Array.isArray(ids)) return null;
  return new Set(ids.filter((id): id is string => typeof id === "string"));
}

function filterBySelected<T extends { id: number }>(items: T[], prefix: string, selected: Set<string> | null): T[] {
  if (!selected) return items;
  return items.filter(i => selected.has(`${prefix}-${i.id}`));
}

function fmt(items: Array<{ title: string; source: string; publishedDate?: string | null; description?: string | null }>) {
  if (!items.length) return "  None available.";
  return items
    .map((i) => `  • "${i.title}" (${i.source}${i.publishedDate ? ", " + i.publishedDate : ""})\n    ${i.description ?? ""}`)
    .join("\n");
}

router.post("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) {
      res.status(400).json({ error: "Invalid contact ID" });
      return;
    }

    const messages = parseMessages(req.body);
    if (!messages) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const selectedIds = parseSelectedIds(req.body);

    const [[contact], personal, industry, role, colleague, counterpart] = await Promise.all([
      db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1),
      db.select().from(contactInsightsTable).where(and(eq(contactInsightsTable.contactId, contactId), eq(contactInsightsTable.category, "personal"))),
      db.select().from(industryInsightsTable).where(eq(industryInsightsTable.contactId, contactId)),
      db.select().from(roleInsightsTable).where(eq(roleInsightsTable.contactId, contactId)),
      db.select().from(colleagueInsightsTable).where(eq(colleagueInsightsTable.contactId, contactId)),
      db.select().from(counterpartInsightsTable).where(eq(counterpartInsightsTable.contactId, contactId)),
    ]);

    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

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

    const fp = filterBySelected(personal, "personal", selectedIds);
    const fi = filterBySelected(industry, "industry", selectedIds);
    const fr = filterBySelected(role, "role", selectedIds);
    const fc = filterBySelected(colleague, "colleague", selectedIds);
    const fct = filterBySelected(counterpart, "counterpart", selectedIds);
    const fci = filterBySelected(companyIns, "company", selectedIds);

    const systemPrompt = `You are an AI contact intelligence assistant embedded in Whyhello, a B2B relationship intelligence platform. Help the user deeply understand and engage with their contact.

CONTACT PROFILE
Name: ${contact.firstName} ${contact.lastName}
Title: ${contact.jobTitle ?? ""}${contact.department ? " — " + contact.department : ""}
Company: ${company?.name ?? "Unknown"}${company?.industry ? " (" + company.industry + ")" : ""}
Location: ${[contact.location, contact.country].filter(Boolean).join(", ") || "Not specified"}
Seniority: ${contact.seniority ?? "Not specified"}
Bio: ${contact.bio ?? "Not available"}

PERSONAL INSIGHTS (content directly about ${contact.firstName}):
${fmt(fp)}

INDUSTRY INSIGHTS (sector trends they operate in):
${fmt(fi)}

ROLE INSIGHTS (content relevant to their function):
${fmt(fr)}

COLLEAGUE INSIGHTS (their team and peers):
${fmt(fc)}

COUNTERPART INSIGHTS (competitor and partner perspectives):
${fmt(fct)}

COMPANY INSIGHTS (${company?.name ?? "their company"} news and press):
${fmt(fci)}

Your role:
- Answer any question about this contact's priorities, background, and professional context
- Suggest conversation openers and talking points grounded in the insights above
- Draft outreach messages (email subject lines, LinkedIn notes, cold emails)
- Summarise their recent activity and what it signals about their agenda
- Identify common ground and angles for building rapport

Be concise, specific, and actionable. Tie every response to the actual data above. Do not invent information not present in the profile.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? "";
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Contact chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
