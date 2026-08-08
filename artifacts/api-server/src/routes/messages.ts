import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { messagesTable, contactsTable, userEmailAccountsTable } from "@workspace/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { getValidAccessToken, sendViaGmail, sendViaOutlook } from "./email-accounts";
import { getAuth } from "@clerk/express";
import crypto from "node:crypto";

const router: IRouter = Router();

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

/** Convert plain-text body (with **bold** and [text](url) markdown) to HTML */
function bodyToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_: string, t: string, u: string) =>
    `<a href="${u}" style="color:#4f46e5;text-decoration:underline">${t}</a>`);
  // Bare URLs (not already in href)
  html = html.replace(/(^|[\s])(https?:\/\/[^\s<"]+)/g, (_: string, pre: string, u: string) =>
    `${pre}<a href="${u}" style="color:#4f46e5;text-decoration:underline">${u}</a>`);
  // Newlines
  html = html.replace(/\n/g, "<br>\n");
  return html;
}

/** Wrap links with click tracking and append open-tracking pixel */
function injectTracking(html: string, token: string, baseUrl: string): string {
  // Wrap href URLs with click redirect (skip already-tracking URLs)
  const wrapped = html.replace(/href="(https?:\/\/[^"]+)"/g, (_: string, url: string) => {
    if (url.includes("/api/track/")) return `href="${url}"`;
    const encoded = Buffer.from(url).toString("base64url");
    return `href="${baseUrl}/api/track/click/${token}?url=${encoded}"`;
  });
  const pixel = `<img src="${baseUrl}/api/track/open/${token}" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0.01;border:0" alt="">`;
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1f2937;max-width:600px">${wrapped}</div>${pixel}`;
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

router.post("/:id/send", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [message] = await db.select().from(messagesTable)
      .where(and(eq(messagesTable.id, id), eq(messagesTable.userId, userId)));
    if (!message) { res.status(404).json({ error: "Message not found" }); return; }

    const { accountId } = req.body as { accountId?: number };
    const accountWhere = accountId
      ? and(eq(userEmailAccountsTable.id, accountId), eq(userEmailAccountsTable.userId, userId))
      : eq(userEmailAccountsTable.userId, userId);

    const [account] = await db.select().from(userEmailAccountsTable).where(accountWhere);
    if (!account) {
      res.status(400).json({ error: "No connected email account found. Connect Gmail or Outlook in Settings." });
      return;
    }

    const accessToken = await getValidAccessToken(account);
    if (!accessToken) {
      res.status(401).json({ error: "Email token expired. Please reconnect your account in Settings." });
      return;
    }

    // Generate tracking token if not already present
    let token = message.trackingToken;
    if (!token) {
      token = crypto.randomBytes(32).toString("hex");
      await db.update(messagesTable).set({ trackingToken: token }).where(eq(messagesTable.id, id));
    }

    const baseUrl = getOrigin(req);
    const htmlBody = injectTracking(bodyToHtml(message.body), token, baseUrl);

    if (account.provider === "gmail") {
      await sendViaGmail(accessToken, message.toEmail, message.toName, message.subject, message.body, htmlBody);
    } else if (account.provider === "outlook") {
      await sendViaOutlook(accessToken, message.toEmail, message.toName, message.subject, message.body, htmlBody);
    } else {
      res.status(400).json({ error: "Unknown email provider" }); return;
    }

    const now = new Date();
    await db.update(messagesTable)
      .set({ status: "sent", sentAt: now, sentFrom: account.email, updatedAt: now })
      .where(eq(messagesTable.id, id));

    res.json({ success: true, sentFrom: account.email });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send email" });
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

// ── Contact-scoped sent messages (Activity Feed) ──────────────────────────────
export const contactMessagesRouter: IRouter = Router({ mergeParams: true });

contactMessagesRouter.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const contactId = parseInt((req.params as Record<string, string>).contactId ?? "");
  if (!contactId) { res.status(400).json({ error: "Invalid contactId" }); return; }
  try {
    const rows = await db
      .select({
        id: messagesTable.id,
        subject: messagesTable.subject,
        toEmail: messagesTable.toEmail,
        toName: messagesTable.toName,
        sentAt: messagesTable.sentAt,
        sentFrom: messagesTable.sentFrom,
        openedAt: messagesTable.openedAt,
        clickCount: messagesTable.clickCount,
        status: messagesTable.status,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(and(
        eq(messagesTable.userId, userId),
        eq(messagesTable.contactId, contactId),
        eq(messagesTable.status, "sent"),
      ))
      .orderBy(desc(messagesTable.sentAt));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch contact messages" });
  }
});
