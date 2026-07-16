import { Router, type IRouter, type Request } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { createRequire } from "module";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { dnaProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const require = createRequire(import.meta.url);

type AuthedReq = Request & { user: { id: string } };
function getUserId(req: Request): string | null {
  return (req as AuthedReq).user?.id ?? null;
}

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ── GET /api/dna/profile ─────────────────────────────────────────────────────

router.get("/profile", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [row] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId));
    res.json({ data: row ? JSON.parse(row.data) : null });
  } catch (err) {
    console.error("DNA profile GET error:", err);
    res.status(500).json({ error: "Failed to load DNA profile" });
  }
});

// ── PUT /api/dna/profile ──────────────────────────────────────────────────────

router.put("/profile", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const { data } = req.body as { data: unknown };
  if (!data) { res.status(400).json({ error: "No data provided" }); return; }
  try {
    const serialised = JSON.stringify(data);
    await db
      .insert(dnaProfilesTable)
      .values({ userId, data: serialised, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: dnaProfilesTable.userId,
        set: { data: serialised, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    console.error("DNA profile PUT error:", err);
    res.status(500).json({ error: "Failed to save DNA profile" });
  }
});

// ── POST /api/dna/extract-text ───────────────────────────────────────────────

router.post("/extract-text", upload.single("file"), async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  try {
    let text = "";
    const name = file.originalname.toLowerCase();
    const mime = file.mimetype;

    if (mime.startsWith("text/") || name.endsWith(".txt")) {
      text = file.buffer.toString("utf-8");
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;
    } else if (mime === "application/pdf" || name.endsWith(".pdf")) {
      // Use require path to bypass pdf-parse ESM test-file loading issue
      const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
        buf: Buffer,
        opts?: unknown
      ) => Promise<{ text: string }>;
      const data = await pdfParse(file.buffer);
      text = data.text;
    } else {
      res.status(415).json({ error: "Unsupported file type. Use .txt, .docx, or .pdf" });
      return;
    }

    res.json({ text: text.replace(/\r\n/g, "\n").trim() });
  } catch (err) {
    console.error("DNA extract-text error:", err);
    res.status(500).json({ error: "Failed to extract text from file" });
  }
});

// ── POST /api/dna/voice-summary ──────────────────────────────────────────────

router.post("/voice-summary", async (req, res) => {
  const {
    toneTags = [],
    communicationStyle = "",
    writingNotes = "",
    trainingText = "",
    suppressions = [],
    suppressionNotes = "",
  } = req.body as {
    toneTags?: string[];
    communicationStyle?: string;
    writingNotes?: string;
    trainingText?: string;
    suppressions?: string[];
    suppressionNotes?: string;
  };

  const hasData =
    toneTags.length > 0 || communicationStyle || writingNotes || trainingText ||
    suppressions.length > 0 || suppressionNotes;

  if (!hasData) {
    res.json({ summary: "" });
    return;
  }

  const sample = trainingText ? trainingText.slice(0, 4000) : "";

  const lines: string[] = [];
  if (toneTags.length > 0) lines.push(`Tone descriptors: ${toneTags.join(", ")}`);
  if (communicationStyle) lines.push(`Communication style: ${communicationStyle}`);
  if (writingNotes) lines.push(`Self-described writing voice: ${writingNotes}`);
  if (sample) lines.push(`Sample communications:\n"""\n${sample}\n"""`);
  if (suppressions.length > 0) lines.push(`Explicit suppressions (never use): ${suppressions.join(", ")}`);
  if (suppressionNotes) lines.push(`Additional things to avoid: ${suppressionNotes}`);
  const profileBlock = lines.join("\n");

  const prompt = `You are a communication analyst at Whyhello, a B2B relationship intelligence platform. Using the signals provided below — which may be sparse — synthesize a precise 2–3 sentence declarative description of this person's communication identity. Work only with what's actually been shared. Be specific and grounded. Where suppressions are listed, weave them naturally into the description as part of what defines this person's voice. Write in second person, directly addressing the user — for example: "You write short, energetic messages…"

${profileBlock}

Write only the 2–3 sentence description. No preamble, no label.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ summary });
  } catch (err) {
    console.error("DNA voice-summary error:", err);
    res.status(500).json({ error: "Summary generation failed" });
  }
});

// ── POST /api/dna/testimonial-extract ────────────────────────────────────────

router.post("/testimonial-extract", async (req, res) => {
  const { text = "" } = req.body as { text: string };
  if (!text.trim()) { res.json({}); return; }

  const prompt = `Extract key information from the following customer testimonial, case study, or win-loss note into a structured JSON format.

Return ONLY a valid JSON object with these exact keys (use empty string "" if a field cannot be determined):
{
  "customerProfile": "Brief description of the customer — company name, industry, size, role of the contact if known",
  "startingSituation": "The before state — what problem, pain, or situation they were experiencing before the solution",
  "customerPriorities": "What they were trying to achieve — their goals and priorities",
  "solutionProvided": "What was done for them — the solution, approach, or implementation",
  "customerTransformation": "The after state — how their situation changed as a result",
  "results": "Specific measurable outcomes — numbers, percentages, timelines if mentioned",
  "customerQuote": "The single most powerful direct verbatim quote from the customer, or empty string if none"
}

Source text:
"""
${text.slice(0, 6000)}
"""

Return only the JSON object. No preamble, no explanation, no code fences.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const data = match ? JSON.parse(match[0]) : {};
    res.json(data);
  } catch (err) {
    console.error("Testimonial extract error:", err);
    res.status(500).json({ error: "Extraction failed" });
  }
});

export default router;
