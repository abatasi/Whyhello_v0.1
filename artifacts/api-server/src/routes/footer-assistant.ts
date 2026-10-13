import { Router, type IRouter } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const messageBody = z.object({
  message: z.string().trim().min(1).max(4000),
});

router.post("/", async (req, res) => {
  const input = messageBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Write a message of up to 4,000 characters." });
    return;
  }

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "You are the Whyhello assistant, a helpful assistant inside Whyhello, a B2B relationship intelligence platform. Answer clearly and concisely. You only know the current message; you cannot see the user's account, contacts, or previous messages. Never claim to have accessed account data or remember earlier chat.",
          },
          { role: "user", content: input.data.message },
        ],
      },
      { timeout: 45_000, maxRetries: 0 },
    );
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error("Empty assistant response");
    res.json({ reply });
  } catch {
    // Do not log request content or provider error details that could contain it.
    console.error("Footer assistant request failed.");
    res.status(502).json({ error: "Whyhello AI couldn’t reply right now. Please try again." });
  }
});

export default router;
