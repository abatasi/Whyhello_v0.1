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
  } = req.body as {
    toneTags?: string[];
    communicationStyle?: string;
    writingNotes?: string;
    trainingText?: string;
  };

  const hasData =
    toneTags.length > 0 || communicationStyle || writingNotes || trainingText;

  if (!hasData) {
    res.json({ summary: "" });
    return;
  }

  const sample = trainingText ? trainingText.slice(0, 4000) : "";

  const prompt = `You are a communication analyst at Whyhello, a B2B relationship intelligence platform. Based on the professional profile below, write a precise 2–3 sentence declarative description of this person's communication identity. Be specific and grounded in what's been shared — write as if narrating who this person is as a communicator in a way that would feel accurate and useful when read back to them.

Tone descriptors: ${toneTags.length > 0 ? toneTags.join(", ") : "not specified"}
Communication style: ${communicationStyle || "not specified"}
Self-described writing voice: ${writingNotes || "not provided"}
${sample ? `\nSample of their real communications:\n"""\n${sample}\n"""` : ""}

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
