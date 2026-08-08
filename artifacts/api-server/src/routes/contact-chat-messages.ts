import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { contactChatMessagesTable } from "@workspace/db/schema";
import { eq, asc, and, or, isNull } from "drizzle-orm";

const router: IRouter = Router({ mergeParams: true });

function userId(req: Request): string | null {
  return req.dbUser?.id ?? null;
}

// GET /contacts/:contactId/chat-messages — list messages for this user + contact pair
router.get("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const uid = userId(req);

    // Include legacy NULL-owner messages so pre-migration chat history remains accessible
    const messages = await db
      .select()
      .from(contactChatMessagesTable)
      .where(and(
        eq(contactChatMessagesTable.contactId, contactId),
        or(eq(contactChatMessagesTable.userId, uid!), isNull(contactChatMessagesTable.userId)),
      ))
      .orderBy(asc(contactChatMessagesTable.createdAt));

    res.json(messages);
  } catch (err) {
    console.error("List chat messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contacts/:contactId/chat-messages — create a message for this user + contact pair
router.post("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const uid = userId(req);
    if (!uid) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { role, content } = req.body ?? {};
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "Invalid message body" });
      return;
    }

    const [msg] = await db
      .insert(contactChatMessagesTable)
      .values({ userId: uid, contactId, role, content: content.trim() })
      .returning();

    res.status(201).json(msg);
  } catch (err) {
    console.error("Create chat message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /contacts/:contactId/chat-messages — clear this user's chat history for this contact
router.delete("/", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const uid = userId(req);

    await db
      .delete(contactChatMessagesTable)
      .where(and(
        eq(contactChatMessagesTable.contactId, contactId),
        eq(contactChatMessagesTable.userId, uid!),
      ));

    res.status(204).end();
  } catch (err) {
    console.error("Delete chat messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
