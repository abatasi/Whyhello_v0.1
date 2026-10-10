import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  contactsTable,
  companiesTable,
  contactInsightsTable,
  companyInsightsTable,
  industryInsightsTable,
  roleInsightsTable,
  insightRelevanceScoresTable,
  insightQuotesTable,
  dnaProfilesTable,
} from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { loadRelationshipInsights, type RelationshipKind, type RelationshipSourceContact } from "../lib/relationship-insights.js";
import { resolveOutputVoice, VoicePersonaSelectionError } from "../lib/voice-personas.js";

const router: IRouter = Router({ mergeParams: true });

type RawMessage = { role: string; content: string };
type SourceRef = { signalType: string; id: number; title: string; source: string; url?: string | null; publishedDate?: string | null };

type RelevanceInfo = { score: number; description: string };
type QuoteInfo     = { quote: string; hqBridge: string | null };
type RelationshipInfo = {
  kind: RelationshipKind;
  sourceContact?: RelationshipSourceContact;
  group?: 1 | 2;
};

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

function relevanceLabel(score: number): string {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

/**
 * Build a numbered reference block for the system prompt.
 * Items are sorted by relevance score descending (unscored last).
 * Each entry is annotated with its relevance label + score, relevance note, and any quotable.
 */
function buildRefSection(
  items: Array<{ id: number; title: string; source: string | null; url?: string | null; publishedDate?: string | null; description?: string | null }>,
  signalType: string,
  index: SourceRef[],
  scoreMap: Map<string, RelevanceInfo>,
  quoteMap: Map<string, QuoteInfo>,
  relationshipMap: Map<string, RelationshipInfo>,
): string {
  if (!items.length) return "  None available.";

  // Sort HIGH → MEDIUM → LOW → unscored
  const sorted = [...items].sort((a, b) => {
    const sa = scoreMap.get(`${signalType}-${a.id}`)?.score ?? -1;
    const sb = scoreMap.get(`${signalType}-${b.id}`)?.score ?? -1;
    return sb - sa;
  });

  return sorted.map((i) => {
    const key = `${signalType}-${i.id}`;
    index.push({ signalType, id: i.id, title: i.title, source: i.source ?? "", url: i.url ?? null, publishedDate: i.publishedDate ?? null });
    const n = index.length; // 1-based ref number

    const rel = scoreMap.get(key);
    const qt  = quoteMap.get(key) ?? (
      (signalType === "colleague" || signalType === "counterpart")
        ? quoteMap.get(`personal-${i.id}`)
        : undefined
    );
    const relationship = relationshipMap.get(key);

    const relTag    = rel ? `[${relevanceLabel(rel.score)}] ` : "";
    const sourceStr = `${i.source ?? "Unknown"}${i.publishedDate ? ", " + i.publishedDate : ""}`;

    let entry = `  [${n}] ${relTag}"${i.title}" (${sourceStr})`;
    if (i.description) entry += `\n      ${i.description}`;
    if (rel)           entry += `\n      ↳ Relevance ${rel.score}/100: ${rel.description}`;
    if (qt) {
      entry += `\n      ★ QUOTABLE (verbatim — use exact wording): "${qt.quote}"`;
      if (qt.hqBridge) entry += `\n      ↳ Bridge to your pitch: ${qt.hqBridge}`;
    }
    if (relationship?.sourceContact) {
      const source = relationship.sourceContact;
      entry += `\n      ↳ Source person: ${source.name}${source.jobTitle ? ` — ${source.jobTitle}` : ""}${source.companyName ? ` at ${source.companyName}` : ""}`;
      if (relationship.kind === "colleague") {
        entry += `\n      ↳ Relationship to contact: ${source.name} is the contact's colleague inside the contact's company${source.companyName ? ` (${source.companyName})` : ""}`;
      } else {
        entry += `\n      ↳ Relationship to contact: ${source.name} is a counterpart in a similar role at another company${source.companyName ? ` (${source.companyName})` : ""}${relationship.group === 1 ? " in the same industry" : ""}`;
      }
      if (i.url) entry += `\n      ↳ Insight URL: ${i.url}`;
    }

    return entry;
  }).join("\n\n");
}

// Parse [CITED: 1, 3, 5] from the tail of the accumulated response.
function parseCitations(content: string): number[] {
  const match = content.match(/\[CITED:\s*([\d,\s]+)\]\s*$/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);
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
    const selection = z.object({
      tone: z.string().trim().min(1).max(2000).optional(),
      voicePersonaId: z.string().trim().min(1).max(100).nullable().optional(),
    }).safeParse(req.body);
    if (!selection.success) { res.status(400).json({ error: "Choose a valid tone or saved voice persona." }); return; }
    let styleInstructions = "";
    if (selection.data.tone || selection.data.voicePersonaId) {
      const auth = getAuth(req);
      const userId = (auth.sessionClaims as { userId?: string } | null)?.userId ?? auth.userId;
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      const needsHq = !!selection.data.voicePersonaId || selection.data.tone === "my_voice_profile";
      const [profile] = needsHq
        ? await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId))
        : [];
      const voice = resolveOutputVoice(profile ? JSON.parse(profile.data) : {}, selection.data);
      styleInstructions = `\n\nOUTPUT STYLE FOR THIS RESPONSE ONLY:
${voice.hqVoice ? `Follow this selected HQ voice definition: ${voice.hqVoice}` : `Tone: ${voice.tone}`}
Voice controls wording and register only, not identity or facts. Never copy factual claims from style examples, imply the persona name is the sender, or let style override source attribution, relationship safeguards, citations, or the requested output structure. Do not rewrite earlier messages.`;
    }

    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const [personal, industry, role, relevanceRows] = await Promise.all([
      db.select().from(contactInsightsTable).where(and(eq(contactInsightsTable.contactId, contactId), eq(contactInsightsTable.category, "personal"))),
      contact.industryId
        ? db.select().from(industryInsightsTable).where(eq(industryInsightsTable.industryId, contact.industryId))
        : Promise.resolve([]),
      contact.roleId
        ? db.select().from(roleInsightsTable).where(eq(roleInsightsTable.roleId, contact.roleId))
        : Promise.resolve([]),
      // Relevance scores for this contact (all signal types)
      db.select().from(insightRelevanceScoresTable).where(eq(insightRelevanceScoresTable.contactId, contactId)),
    ]);

    const [colleagueContext, counterpartContext] = await Promise.all([
      loadRelationshipInsights(contactId, "colleague"),
      loadRelationshipInsights(contactId, "counterpart"),
    ]);
    const colleague = colleagueContext.items;
    const counterpart = counterpartContext.items;
    const quoteContactIds = [
      contactId,
      ...colleagueContext.sourceContactIds,
      ...counterpartContext.sourceContactIds,
    ];
    const quoteRows = quoteContactIds.length > 0
      ? await db.select().from(insightQuotesTable).where(inArray(insightQuotesTable.contactId, quoteContactIds))
      : [];

    let company: typeof companiesTable.$inferSelect | null = null;
    let companyIns: typeof companyInsightsTable.$inferSelect[] = [];
    if (contact.companyId) {
      const [[co], ci] = await Promise.all([
        db.select().from(companiesTable).where(eq(companiesTable.id, contact.companyId)).limit(1),
        db.select().from(companyInsightsTable).where(eq(companyInsightsTable.companyId, contact.companyId)),
      ]);
      company   = co ?? null;
      companyIns = ci;
    }

    const fp  = filterBySelected(personal,    "personal",    selectedIds);
    const fi  = filterBySelected(industry,    "industry",    selectedIds);
    const fr  = filterBySelected(role,        "role",        selectedIds);
    const fc  = filterBySelected(colleague,   "colleague",   selectedIds);
    const fct = filterBySelected(counterpart, "counterpart", selectedIds);
    const fci = filterBySelected(companyIns,  "company",     selectedIds);

    // ── Build lookup maps: "signalType-signalId" → info ──────────────────
    const scoreMap = new Map<string, RelevanceInfo>();
    for (const r of relevanceRows) {
      scoreMap.set(`${r.signalType}-${r.signalId}`, { score: r.score, description: r.description });
    }

    const quoteMap = new Map<string, QuoteInfo>();
    for (const q of quoteRows) {
      quoteMap.set(`${q.signalType}-${q.signalId}`, { quote: q.quote, hqBridge: q.hqBridge ?? null });
    }
    const relationshipMap = new Map<string, RelationshipInfo>();
    for (const insight of colleague) {
      relationshipMap.set(`colleague-${insight.id}`, {
        kind: "colleague",
        sourceContact: colleagueContext.sourceContacts.get(insight.contactId),
      });
    }
    for (const insight of counterpart) {
      relationshipMap.set(`counterpart-${insight.id}`, {
        kind: "counterpart",
        sourceContact: counterpartContext.sourceContacts.get(insight.contactId),
        group: counterpartContext.groups.get(insight.contactId),
      });
    }

    const hasRelevanceScores = scoreMap.size > 0;
    const hasQuotables       = quoteMap.size > 0;

    // ── Build numbered source index (1-based) for citation tracking ───────
    const sourceIndex: SourceRef[] = [];
    const personalSection    = buildRefSection(fp,  "personal",    sourceIndex, scoreMap, quoteMap, relationshipMap);
    const industrySection    = buildRefSection(fi,  "industry",    sourceIndex, scoreMap, quoteMap, relationshipMap);
    const roleSection        = buildRefSection(fr,  "role",        sourceIndex, scoreMap, quoteMap, relationshipMap);
    const colleagueSection   = buildRefSection(fc,  "colleague",   sourceIndex, scoreMap, quoteMap, relationshipMap);
    const counterpartSection = buildRefSection(fct, "counterpart", sourceIndex, scoreMap, quoteMap, relationshipMap);
    const companySection     = buildRefSection(fci, "company",     sourceIndex, scoreMap, quoteMap, relationshipMap);

    const relevanceInstructions = hasRelevanceScores ? `
RELEVANCE SCORING
Each source above may carry a relevance tag set by an AI scoring engine comparing the signal against the seller's value proposition:
  • [HIGH]   score ≥ 70 — directly connects to your ICP and offering. These sources should anchor your answers; lead with them.
  • [MEDIUM] score 40–69 — adds useful context. Use to round out a response.
  • [LOW]    score < 40 — general background. Draw on only when nothing better applies.
  • (untagged) — not yet scored. Treat as neutral context.

When composing outreach, talking points, or conversation openers, prioritise [HIGH] sources first. Always explain *why* a source is relevant using the ↳ Relevance note beneath it.` : "";

    const quotableInstructions = hasQuotables ? `
QUOTABLES
Sources marked ★ QUOTABLE contain a verbatim sentence the contact actually published. These are gold:
  • When drafting a cold email, LinkedIn note, or conversation opener, weave in the exact quoted wording — do not paraphrase.
  • The ↳ Bridge line tells you how that quote connects to the seller's pitch; use it to frame your angle.
  • A well-placed quotable shows the contact you have genuinely read their work — it is the single strongest personalisation signal available.` : "";

    const relationshipInstructions = `
RELATIONSHIP INSIGHT FRAMING
When using a COLLEAGUE insight, assume the contact has not encountered that specific public activity. Explicitly say that the named source is the contact's colleague inside the contact's company; never assume the contact will infer that from the name or title. Use the exact source quote when one is marked ★ QUOTABLE, include the exact Insight URL once behind natural markdown anchor text as optional further reading, and then segue with a natural question such as "Is this something you're seeing as well?" Do not imply company-wide agreement, a private referral, or confidential knowledge.
When using a COUNTERPART insight, assume the contact has not encountered that specific activity. Explicitly say that the named source is a counterpart or peer in a similar role at another company, including a competitor when that is the available context; never assume the contact will infer that from the name or title. Use the exact source quote when one is marked ★ QUOTABLE, include the exact Insight URL once behind natural markdown anchor text as optional further reading, and then invite comparison with a question such as "Is this resonating with you and your company as well?" or "Is this also on your radar?" Treat it as one peer example, never as proof that the contact is behind or that everyone else agrees.
For both types, the question is a bridge into the seller's relevance, not the CTA. Keep it curious and do not ask for confidential information.`;

    const systemPrompt = `You are an AI contact intelligence assistant embedded in Whyhello, a B2B relationship intelligence platform. Help the user deeply understand and engage with their contact.

CONTACT PROFILE
Name: ${contact.firstName} ${contact.lastName}
Title: ${contact.jobTitle ?? ""}${contact.department ? " — " + contact.department : ""}
Company: ${company?.name ?? "Unknown"}${company?.industry ? " (" + company.industry + ")" : ""}
Location: ${[contact.location, contact.country].filter(Boolean).join(", ") || "Not specified"}
Seniority: ${contact.seniority ?? "Not specified"}
Bio: ${contact.bio ?? "Not available"}

PERSONAL INSIGHTS (content directly about ${contact.firstName}):
${personalSection}

INDUSTRY INSIGHTS (sector trends they operate in):
${industrySection}

ROLE INSIGHTS (content relevant to their function):
${roleSection}

COLLEAGUE INSIGHTS (their team and peers):
${colleagueSection}

COUNTERPART INSIGHTS (competitor and partner perspectives):
${counterpartSection}

COMPANY INSIGHTS (${company?.name ?? "their company"} news and press):
${companySection}
    ${relevanceInstructions}${quotableInstructions}${relationshipInstructions}

Your role:
- Answer any question about this contact's priorities, background, and professional context
- Suggest conversation openers and talking points grounded in the insights above
- Draft outreach messages (email subject lines, LinkedIn notes, cold emails)
- Summarise their recent activity and what it signals about their agenda
- Identify common ground and angles for building rapport

Be concise, specific, and actionable. Tie every response to the actual data above. Do not invent information not present in the profile.${hasRelevanceScores ? " Anchor responses in [HIGH] relevance sources." : ""}${hasQuotables ? " Deploy ★ QUOTABLE verbatim wording in any outreach drafts." : ""}

CITATION REQUIREMENT:
After your response, on a new line by itself, write exactly this — and nothing else on that line:
[CITED: N, M, ...]
Replace N, M, ... with the reference numbers (shown in [brackets] above) of the specific sources you drew from for this answer. Only include sources you actually used. If you used none, write [CITED: ].`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "system", content: systemPrompt + styleInstructions }, ...messages],
      stream: true,
    });

    // Stream content to client while buffering server-side for citation parsing
    let accumulated = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? "";
      if (content) {
        accumulated += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Parse which sources the AI actually cited
    const citedNums = parseCitations(accumulated);
    const citedSources: SourceRef[] = citedNums
      .map(n => sourceIndex[n - 1])
      .filter((s): s is SourceRef => !!s);

    // Tell the client the citation tag text to strip, plus the cited sources
    res.write(`data: ${JSON.stringify({ sources: citedSources, citationTag: accumulated.match(/\n*\[CITED:[^\]]*\]\s*$/)?.[0] ?? "" })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    if (err instanceof VoicePersonaSelectionError && !res.headersSent) { res.status(400).json({ error: err.message }); return; }
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
