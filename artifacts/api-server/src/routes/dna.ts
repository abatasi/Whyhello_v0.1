import { Router, type IRouter } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { createRequire } from "module";
import { openai } from "@workspace/integrations-openai-ai-server";

const require = createRequire(import.meta.url);

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
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

  const prompt = `You are a communication analyst at Whyhello, a B2B relationship intelligence platform. Using the signals provided below — which may be sparse — synthesize a precise 2–3 sentence declarative description of this person's communication identity. Work only with what's actually been shared. Be specific and grounded. Where suppressions are listed, weave them naturally into the description as part of what defines this person's voice. Write in third person, as if describing this person to someone about to interact with them.

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

export default router;
