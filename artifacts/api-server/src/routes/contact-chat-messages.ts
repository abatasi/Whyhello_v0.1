import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactChatMessagesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    const messages = await db
      .select()
      .from(contactChatMessagesTable)
      .where(eq(contactChatMessagesTable.contactId, contactId))
      .orderBy(asc(contactChatMessagesTable.createdAt));

    res.json(messages);
  } catch (err) {
    console.error("List chat messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    const { role, content } = req.body ?? {};
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "Invalid message body" });
      return;
    }

    const [msg] = await db
      .insert(contactChatMessagesTable)
      .values({ contactId, role, content: content.trim() })
      .returning();

    res.status(201).json(msg);
  } catch (err) {
    console.error("Create chat message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

    await db
      .delete(contactChatMessagesTable)
      .where(eq(contactChatMessagesTable.contactId, contactId));

    res.status(204).end();
  } catch (err) {
    console.error("Delete chat messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
