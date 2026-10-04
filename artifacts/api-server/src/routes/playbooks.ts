import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  sequencesTable,
  sequenceStepsTable,
  sequenceEnrollmentsTable,
  contactsTable,
  companiesTable,
  messagesTable,
  userEmailAccountsTable,
  contactInsightsTable,
  companyInsightsTable,
  industryInsightsTable,
  roleInsightsTable,
  colleagueInsightsTable,
  counterpartInsightsTable,
  dnaProfilesTable,
  insightQuotesTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getValidAccessToken, sendViaGmail, sendViaOutlook } from "./email-accounts.js";
import crypto from "node:crypto";

export const playbooksRouter: IRouter = Router();

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function bodyToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_: string, t: string, u: string) =>
    `<a href="${u}" style="color:#4f46e5;text-decoration:underline">${t}</a>`);
  html = html.replace(/(^|[\s])(https?:\/\/[^\s<"]+)/g, (_: string, pre: string, u: string) =>
    `${pre}<a href="${u}" style="color:#4f46e5;text-decoration:underline">${u}</a>`);
  html = html.replace(/\n/g, "<br>\n");
  return html;
}

function injectTracking(html: string, token: string, baseUrl: string): string {
  const wrapped = html.replace(/href="(https?:\/\/[^"]+)"/g, (_: string, url: string) => {
    if (url.includes("/api/track/")) return `href="${url}"`;
    const encoded = Buffer.from(url).toString("base64url");
    return `href="${baseUrl}/api/track/click/${token}?url=${encoded}"`;
  });
  const pixel = `<img src="${baseUrl}/api/track/open/${token}" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0.01;border:0" alt="">`;
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1f2937;max-width:600px">${wrapped}</div>${pixel}`;
}

// ── Sequences list + create ────────────────────────────────────────────────

playbooksRouter.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const seqs = await db
      .select({
        id: sequencesTable.id,
        name: sequencesTable.name,
        description: sequencesTable.description,
        status: sequencesTable.status,
        createdAt: sequencesTable.createdAt,
        updatedAt: sequencesTable.updatedAt,
        stepCount: sql<number>`(SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = sequences.id)::int`,
        enrollmentCount: sql<number>`(SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = sequences.id AND status = 'active')::int`,
        pausedCount: sql<number>`(SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = sequences.id AND status = 'paused')::int`,
        finishedCount: sql<number>`(SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = sequences.id AND status = 'completed')::int`,
        sentCount: sql<number>`(SELECT COUNT(*) FROM messages WHERE sequence_id = sequences.id AND status = 'sent')::int`,
        dueCount: sql<number>`(
          SELECT COUNT(*) FROM sequence_enrollments se
          JOIN sequence_steps ss ON ss.sequence_id = se.sequence_id AND ss.position = se.current_step
          WHERE se.sequence_id = sequences.id
            AND se.status = 'active'
            AND se.enrolled_at + (
              SELECT COALESCE(SUM(ss2.delay_days), 0) || ' days'
              FROM sequence_steps ss2
              WHERE ss2.sequence_id = se.sequence_id AND ss2.position <= se.current_step
            )::interval <= NOW()
            AND NOT EXISTS (
              SELECT 1 FROM messages m
              WHERE m.sequence_id = se.sequence_id
                AND m.sequence_step_id = ss.id
                AND m.contact_id = se.contact_id
                AND m.status = 'sent'
            )
        )::int`,
      })
      .from(sequencesTable)
      .where(eq(sequencesTable.userId, userId))
      .orderBy(desc(sequencesTable.updatedAt));
    res.json(seqs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch playbooks" });
  }
});

playbooksRouter.post("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const { name, description, status } = req.body as { name: string; description?: string; status?: string };
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    if (status !== undefined && status !== "draft" && status !== "active") {
      res.status(400).json({ error: "New playbooks must be draft or active" }); return;
    }
    const [seq] = await db.insert(sequencesTable).values({
      userId,
      name: name.trim(),
      description: description?.trim() ?? null,
      status: status ?? "active",
    }).returning();
    res.status(201).json(seq);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create playbook" });
  }
});

// ── Single sequence ────────────────────────────────────────────────────────

playbooksRouter.get("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(String(req.params.id));
  try {
    const [seq] = await db.select().from(sequencesTable)
      .where(and(eq(sequencesTable.id, id), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    res.json(seq);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sequence" });
  }
});

playbooksRouter.patch("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(String(req.params.id));
  try {
    const { name, description, status } = req.body as { name?: string; description?: string; status?: string };
    if (status === "active") {
      const [current] = await db.select().from(sequencesTable)
        .where(and(eq(sequencesTable.id, id), eq(sequencesTable.userId, userId)));
      if (!current) { res.status(404).json({ error: "Sequence not found" }); return; }
      const canvasText = description ?? current.description;
      if (canvasText?.trim().startsWith("{")) {
        let canvas: { nodes?: { data?: Record<string, unknown> }[] };
        try { canvas = JSON.parse(canvasText); }
        catch { res.status(400).json({ error: "Save a valid playbook workflow before activating." }); return; }
        if (Array.isArray(canvas.nodes)) {
          const structural = new Set(["placeholder", "prospect-added", "trigger-detected", "added-to-playbook", "company-added", "list-entry", "manual-enrollment"]);
          const steps = canvas.nodes.filter(node => typeof node.data?.blockType === "string" && !structural.has(node.data.blockType));
          if (!steps.length) { res.status(400).json({ error: "Add and save at least one step before activating this playbook." }); return; }
          if (steps.some(node => node.data?.blockType === "split-path" && !String(node.data.condition ?? "").trim())) {
            res.status(400).json({ error: "Configure every split-path condition before activating." }); return;
          }
          if (steps.some(node => node.data?.blockType === "time-delay" && !(Number(node.data.delayAmount) > 0))) {
            res.status(400).json({ error: "Set a positive duration for every time delay before activating." }); return;
          }
          if (steps.some(node => node.data?.blockType === "send-email")) {
            const [mailbox] = await db.select({ id: userEmailAccountsTable.id }).from(userEmailAccountsTable)
              .where(eq(userEmailAccountsTable.userId, userId)).limit(1);
            if (!mailbox) { res.status(400).json({ error: "Connect a mailbox before activating an email playbook." }); return; }
          }
        }
      }
    }
    const updates: Partial<typeof sequencesTable.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim() || null;
    if (status !== undefined) updates.status = status;
    const [seq] = await db.update(sequencesTable).set(updates)
      .where(and(eq(sequencesTable.id, id), eq(sequencesTable.userId, userId))).returning();
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    res.json(seq);
  } catch (err) {
    res.status(500).json({ error: "Failed to update playbook" });
  }
});

playbooksRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(String(req.params.id));
  try {
    await db.delete(sequencesTable).where(and(eq(sequencesTable.id, id), eq(sequencesTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete playbook" });
  }
});

// ── Steps ──────────────────────────────────────────────────────────────────

playbooksRouter.get("/:id/steps", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    const steps = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.sequenceId, seqId))
      .orderBy(sequenceStepsTable.position);
    res.json(steps);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch steps" });
  }
});

playbooksRouter.post("/:id/steps", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    const { position, delayDays, subject, body } = req.body as {
      position?: number; delayDays?: number; subject?: string; body?: string;
    };
    // Auto-assign position if not given
    const [{ maxPos }] = await db.select({ maxPos: sql<number>`COALESCE(MAX(position), -1)::int` })
      .from(sequenceStepsTable).where(eq(sequenceStepsTable.sequenceId, seqId));
    const [step] = await db.insert(sequenceStepsTable).values({
      sequenceId: seqId,
      position: position ?? (maxPos + 1),
      delayDays: delayDays ?? 0,
      subject: subject ?? "",
      body: body ?? "",
    }).returning();
    // Touch parent
    await db.update(sequencesTable).set({ updatedAt: new Date() }).where(eq(sequencesTable.id, seqId));
    res.status(201).json(step);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create step" });
  }
});

playbooksRouter.patch("/:id/steps/:stepId", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  const stepId = parseInt(String(req.params.stepId));
  try {
    // Verify ownership
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    const { delayDays, subject, body, position } = req.body as {
      delayDays?: number; subject?: string; body?: string; position?: number;
    };
    const updates: Partial<typeof sequenceStepsTable.$inferInsert> = { updatedAt: new Date() };
    if (delayDays !== undefined) updates.delayDays = delayDays;
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (position !== undefined) updates.position = position;
    const [step] = await db.update(sequenceStepsTable).set(updates)
      .where(and(eq(sequenceStepsTable.id, stepId), eq(sequenceStepsTable.sequenceId, seqId)))
      .returning();
    if (!step) { res.status(404).json({ error: "Step not found" }); return; }
    await db.update(sequencesTable).set({ updatedAt: new Date() }).where(eq(sequencesTable.id, seqId));
    res.json(step);
  } catch (err) {
    res.status(500).json({ error: "Failed to update step" });
  }
});

playbooksRouter.delete("/:id/steps/:stepId", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  const stepId = parseInt(String(req.params.stepId));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    await db.delete(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.id, stepId), eq(sequenceStepsTable.sequenceId, seqId)));
    // Re-number positions
    const remaining = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.sequenceId, seqId))
      .orderBy(sequenceStepsTable.position);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        await db.update(sequenceStepsTable).set({ position: i })
          .where(eq(sequenceStepsTable.id, remaining[i].id));
      }
    }
    await db.update(sequencesTable).set({ updatedAt: new Date() }).where(eq(sequencesTable.id, seqId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete step" });
  }
});

playbooksRouter.post("/:id/steps/reorder", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    const { stepIds } = req.body as { stepIds: number[] };
    if (!Array.isArray(stepIds)) { res.status(400).json({ error: "stepIds must be an array" }); return; }
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(sequenceStepsTable).set({ position: i, updatedAt: new Date() })
        .where(and(eq(sequenceStepsTable.id, stepIds[i]), eq(sequenceStepsTable.sequenceId, seqId)));
    }
    const steps = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.sequenceId, seqId))
      .orderBy(sequenceStepsTable.position);
    await db.update(sequencesTable).set({ updatedAt: new Date() }).where(eq(sequencesTable.id, seqId));
    res.json(steps);
  } catch (err) {
    res.status(500).json({ error: "Failed to reorder steps" });
  }
});

// ── Step generation ────────────────────────────────────────────────────────

playbooksRouter.post("/:id/steps/:stepId/generate", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  const stepId = parseInt(String(req.params.stepId));

  try {
    const [[seq], [step]] = await Promise.all([
      db.select().from(sequencesTable).where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId))),
      db.select().from(sequenceStepsTable).where(and(eq(sequenceStepsTable.id, stepId), eq(sequenceStepsTable.sequenceId, seqId))),
    ]);
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    if (!step) { res.status(404).json({ error: "Step not found" }); return; }

    const totalSteps = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(sequenceStepsTable).where(eq(sequenceStepsTable.sequenceId, seqId));
    const total = totalSteps[0]?.count ?? 1;
    const pos = step.position;

    // Determine step type label for the prompt
    let stepLabel: string;
    if (pos === 0) stepLabel = "Intro / first touch";
    else if (pos >= total - 1 && total > 1) stepLabel = "Breakup / final email";
    else stepLabel = `Follow-up ${pos} (of ${total - 2} follow-ups)`;

    // Load optional contact context
    const { contactId: rawContactId } = req.body as { contactId?: number };
    let contactContext = "";
    if (rawContactId) {
      const [[contact], [company]] = await Promise.all([
        db.select().from(contactsTable).where(eq(contactsTable.id, rawContactId)),
        db.select({ name: companiesTable.name, industry: companiesTable.industry })
          .from(companiesTable)
          .innerJoin(contactsTable, eq(contactsTable.companyId, companiesTable.id))
          .where(eq(contactsTable.id, rawContactId)),
      ]);
      if (contact) {
        contactContext = `\nContact: ${contact.firstName} ${contact.lastName}, ${contact.jobTitle ?? "Unknown title"} at ${company?.name ?? "Unknown company"}${company?.industry ? ` (${company.industry})` : ""}`;
      }
    }

    // Seller DNA
    let sellerContext = "No seller context configured.";
    try {
      const [dna] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId)).limit(1);
      if (dna?.data) {
        const parsed = JSON.parse(dna.data);
        const co = parsed.company ?? {};
        const parts: string[] = [];
        if (co.name) parts.push(`Seller: ${co.name}`);
        if (co.valueWedge) parts.push(`Value wedge: ${co.valueWedge}`);
        if (co.positioning) parts.push(`Positioning: ${co.positioning}`);
        if ((parsed.products ?? []).length > 0) {
          const p = parsed.products[0];
          if (p.name) parts.push(`Product: ${p.name}${p.tagline ? ` — ${p.tagline}` : ""}`);
          if (p.outcomes) parts.push(`Outcomes: ${p.outcomes}`);
        }
        sellerContext = parts.join("\n") || sellerContext;
      }
    } catch { /* ignore */ }

    const systemPrompt = `You are an expert B2B email copywriter building an email sequence.
Write a single email for a multi-step outreach sequence. Output ONLY:
Subject: <subject line>
<blank line>
<email body>

Rules:
- This is step ${pos + 1} of ${total}: ${stepLabel}
- Sequence name/purpose: "${seq.name}"${seq.description ? `\nSequence description: ${seq.description}` : ""}${contactContext}
- Seller context:\n${sellerContext}
- For intro: open with specific outside-in observation, bridge to value, end with a single low-friction CTA
- For follow-ups: reference prior email briefly, add new angle or proof point, lighter ask
- For breakup: respectful, concise, leave door open
- No placeholder brackets like [Name] — use generic "you" if no contact given
- Body: plain text with **bold** for emphasis, no HTML; 80–150 words
- Sign off with "[Your Name]" on its own line`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: systemPrompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const lines = raw.split("\n");
    let subject = "";
    let bodyLines: string[] = [];
    let inBody = false;
    for (const line of lines) {
      if (!inBody && line.toLowerCase().startsWith("subject:")) {
        subject = line.replace(/^subject:\s*/i, "").trim();
      } else if (!inBody && subject && line.trim() === "") {
        inBody = true;
      } else if (inBody) {
        bodyLines.push(line);
      }
    }
    // Fallback: if parsing failed, use full output as body
    if (!subject) {
      const match = raw.match(/^subject:\s*(.+)/im);
      subject = match?.[1]?.trim() ?? `Step ${pos + 1}: ${seq.name}`;
      bodyLines = raw.replace(/^subject:.+\n?/im, "").trim().split("\n");
    }
    const body = bodyLines.join("\n").trim();

    const [updated] = await db.update(sequenceStepsTable)
      .set({ subject, body, updatedAt: new Date() })
      .where(eq(sequenceStepsTable.id, stepId))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("Step generation error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Generation failed" });
  }
});

// ── Enrollments ────────────────────────────────────────────────────────────

playbooksRouter.get("/:id/enrollments", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }

    const enrollments = await db
      .select({
        id: sequenceEnrollmentsTable.id,
        sequenceId: sequenceEnrollmentsTable.sequenceId,
        contactId: sequenceEnrollmentsTable.contactId,
        currentStep: sequenceEnrollmentsTable.currentStep,
        status: sequenceEnrollmentsTable.status,
        enrolledAt: sequenceEnrollmentsTable.enrolledAt,
        updatedAt: sequenceEnrollmentsTable.updatedAt,
        contactFirstName: contactsTable.firstName,
        contactLastName: contactsTable.lastName,
        contactEmail: contactsTable.email,
        contactJobTitle: contactsTable.jobTitle,
        companyName: companiesTable.name,
        // Step due info
        stepSubject: sequenceStepsTable.subject,
        stepDelayDays: sequenceStepsTable.delayDays,
        stepPosition: sequenceStepsTable.position,
        stepId: sequenceStepsTable.id,
      })
      .from(sequenceEnrollmentsTable)
      .leftJoin(contactsTable, eq(sequenceEnrollmentsTable.contactId, contactsTable.id))
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .leftJoin(
        sequenceStepsTable,
        and(
          eq(sequenceStepsTable.sequenceId, seqId),
          eq(sequenceStepsTable.position, sequenceEnrollmentsTable.currentStep)
        )
      )
      .where(eq(sequenceEnrollmentsTable.sequenceId, seqId))
      .orderBy(desc(sequenceEnrollmentsTable.enrolledAt));

    // Pre-load all steps for cumulative delay calculation
    const allSteps = await db.select({ position: sequenceStepsTable.position, delayDays: sequenceStepsTable.delayDays })
      .from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.sequenceId, seqId))
      .orderBy(sequenceStepsTable.position);

    // Build cumulative delay map: position -> total days since enrollment
    const cumulativeDelay = new Map<number, number>();
    let running = 0;
    for (const s of allSteps) {
      running += s.delayDays;
      cumulativeDelay.set(s.position, running);
    }

    // For each enrollment compute due date and last sent
    const enriched = await Promise.all(enrollments.map(async (e) => {
      let dueAt: Date | null = null;
      const totalDelay = cumulativeDelay.get(e.currentStep) ?? 0;
      if (e.enrolledAt) {
        dueAt = new Date(e.enrolledAt.getTime() + totalDelay * 86400000);
      }
      // Last sent for this enrollment
      const [lastSent] = await db.select({ sentAt: messagesTable.sentAt })
        .from(messagesTable)
        .where(and(
          eq(messagesTable.contactId, e.contactId),
          eq(messagesTable.status, "sent"),
          sql`${messagesTable.sequenceId} = ${seqId}`
        ))
        .orderBy(desc(messagesTable.sentAt))
        .limit(1);
      return {
        ...e,
        dueAt,
        isDue: dueAt ? dueAt <= new Date() : false,
        lastSentAt: lastSent?.sentAt ?? null,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

playbooksRouter.post("/:id/enrollments", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }

    const { contactIds } = req.body as { contactIds: number[] };
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      res.status(400).json({ error: "contactIds must be a non-empty array" }); return;
    }

    const inserted = await db.insert(sequenceEnrollmentsTable)
      .values(contactIds.map(contactId => ({ sequenceId: seqId, contactId, userId })))
      .onConflictDoNothing()
      .returning();
    res.status(201).json(inserted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to enroll contacts" });
  }
});

playbooksRouter.patch("/:id/enrollments/:enrollmentId", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  const enrollmentId = parseInt(String(req.params.enrollmentId));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    const { status, currentStep } = req.body as { status?: string; currentStep?: number };
    const updates: Partial<typeof sequenceEnrollmentsTable.$inferInsert> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (currentStep !== undefined) updates.currentStep = currentStep;
    const [updated] = await db.update(sequenceEnrollmentsTable).set(updates)
      .where(and(eq(sequenceEnrollmentsTable.id, enrollmentId), eq(sequenceEnrollmentsTable.sequenceId, seqId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Enrollment not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update enrollment" });
  }
});

playbooksRouter.delete("/:id/enrollments/:enrollmentId", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  const enrollmentId = parseInt(String(req.params.enrollmentId));
  try {
    const [seq] = await db.select({ id: sequencesTable.id }).from(sequencesTable)
      .where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId)));
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    await db.delete(sequenceEnrollmentsTable)
      .where(and(eq(sequenceEnrollmentsTable.id, enrollmentId), eq(sequenceEnrollmentsTable.sequenceId, seqId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove enrollment" });
  }
});

// ── Send step ──────────────────────────────────────────────────────────────

playbooksRouter.post("/:id/enrollments/:enrollmentId/send-step", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const seqId = parseInt(String(req.params.id));
  const enrollmentId = parseInt(String(req.params.enrollmentId));

  try {
    const [[seq], [enrollment]] = await Promise.all([
      db.select().from(sequencesTable).where(and(eq(sequencesTable.id, seqId), eq(sequencesTable.userId, userId))),
      db.select().from(sequenceEnrollmentsTable).where(and(eq(sequenceEnrollmentsTable.id, enrollmentId), eq(sequenceEnrollmentsTable.sequenceId, seqId))),
    ]);
    if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
    if (!enrollment) { res.status(404).json({ error: "Enrollment not found" }); return; }

    // Get the current step
    const [step] = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.sequenceId, seqId), eq(sequenceStepsTable.position, enrollment.currentStep)));
    if (!step) { res.status(400).json({ error: "No step at current position" }); return; }

    // Get contact
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, enrollment.contactId));
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    const { subject: overrideSubject, body: overrideBody, accountId } = req.body as {
      subject?: string; body?: string; accountId?: number;
    };

    const finalSubject = overrideSubject ?? step.subject;
    const finalBody = overrideBody ?? step.body;
    const toEmail = contact.email ?? "";
    const toName = `${contact.firstName} ${contact.lastName}`.trim();

    if (!toEmail) { res.status(400).json({ error: "Contact has no email address" }); return; }

    // Get email account
    const accountWhere = accountId
      ? and(eq(userEmailAccountsTable.id, accountId), eq(userEmailAccountsTable.userId, userId))
      : eq(userEmailAccountsTable.userId, userId);
    const [account] = await db.select().from(userEmailAccountsTable).where(accountWhere);
    if (!account) {
      res.status(400).json({ error: "No connected email account. Connect Gmail or Outlook in Settings." }); return;
    }

    const accessToken = await getValidAccessToken(account);
    if (!accessToken) {
      res.status(401).json({ error: "Email token expired. Please reconnect in Settings." }); return;
    }

    // Generate tracking token
    const token = crypto.randomBytes(32).toString("hex");
    const baseUrl = getOrigin(req);
    const htmlBody = injectTracking(bodyToHtml(finalBody), token, baseUrl);

    if (account.provider === "gmail") {
      await sendViaGmail(accessToken, toEmail, toName, finalSubject, finalBody, htmlBody);
    } else if (account.provider === "outlook") {
      await sendViaOutlook(accessToken, toEmail, toName, finalSubject, finalBody, htmlBody);
    } else {
      res.status(400).json({ error: "Unknown email provider" }); return;
    }

    const now = new Date();

    // Record message with sequence attribution
    await db.insert(messagesTable).values({
      userId,
      contactId: enrollment.contactId,
      toEmail,
      toName,
      subject: finalSubject,
      body: finalBody,
      status: "sent",
      sentAt: now,
      sentFrom: account.email,
      trackingToken: token,
      sequenceId: seqId,
      sequenceStepId: step.id,
    } as typeof messagesTable.$inferInsert);

    // Advance enrollment to next step
    const [nextStep] = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.sequenceId, seqId), eq(sequenceStepsTable.position, enrollment.currentStep + 1)));

    const newStatus = nextStep ? "active" : "completed";
    await db.update(sequenceEnrollmentsTable).set({
      currentStep: nextStep ? enrollment.currentStep + 1 : enrollment.currentStep,
      status: newStatus,
      updatedAt: now,
    }).where(eq(sequenceEnrollmentsTable.id, enrollmentId));

    res.json({ success: true, sentFrom: account.email, advancedTo: nextStep?.position ?? null, completed: !nextStep });
  } catch (err) {
    console.error("Send step error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send step" });
  }
});
