import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { messagesTable, contactsTable } from "@workspace/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

function getUserId(req: Request): string | null {
  const u = (req as Request & { user?: { id: string } }).user;
  return u?.id ?? null;
}

router.get("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const status = (req.query.status as string) || null;
    const rows = await db
      .select({
        id: messagesTable.id,
        contactId: messagesTable.contactId,
        toEmail: messagesTable.toEmail,
        toName: messagesTable.toName,
        subject: messagesTable.subject,
        body: messagesTable.body,
        status: messagesTable.status,
        createdAt: messagesTable.createdAt,
        updatedAt: messagesTable.updatedAt,
        contactFirstName: contactsTable.firstName,
        contactLastName: contactsTable.lastName,
      })
      .from(messagesTable)
      .leftJoin(contactsTable, eq(messagesTable.contactId, contactsTable.id))
      .where(
        status
          ? and(eq(messagesTable.userId, userId), eq(messagesTable.status, status))
          : eq(messagesTable.userId, userId)
      )
      .orderBy(desc(messagesTable.updatedAt));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const { contactId, toEmail, toName, subject, body, status } = req.body as {
      contactId?: number;
      toEmail: string;
      toName?: string;
      subject?: string;
      body?: string;
      status?: string;
    };
    if (!toEmail) { res.status(400).json({ error: "toEmail is required" }); return; }
    const [row] = await db.insert(messagesTable).values({
      userId,
      contactId: contactId ?? null,
      toEmail,
      toName: toName ?? null,
      subject: subject ?? "",
      body: body ?? "",
      status: status === "sent" ? "sent" : "draft",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create message" });
  }
});

router.patch("/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const { subject, body, status, toEmail, toName, contactId } = req.body as {
      subject?: string;
      body?: string;
      status?: string;
      toEmail?: string;
      toName?: string;
      contactId?: number | null;
    };
    const updates: Partial<typeof messagesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (status !== undefined) updates.status = status;
    if (toEmail !== undefined) updates.toEmail = toEmail;
    if (toName !== undefined) updates.toName = toName;
    if (contactId !== undefined) updates.contactId = contactId;
    const [row] = await db
      .update(messagesTable)
      .set(updates)
      .where(and(eq(messagesTable.id, id), eq(messagesTable.userId, userId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Message not found" }); return; }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(messagesTable).where(and(eq(messagesTable.id, id), eq(messagesTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
