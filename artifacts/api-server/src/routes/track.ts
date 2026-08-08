import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable } from "@workspace/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

const router: IRouter = Router();

// 1×1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// GET /api/track/open/:token  — email open pixel
router.get("/open/:token", async (req, res) => {
  res.set({
    "Content-Type": "image/gif",
    "Content-Length": String(PIXEL.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.send(PIXEL);

  // Record open asynchronously (don't block response)
  const { token } = req.params;
  if (token) {
    db.update(messagesTable)
      .set({ openedAt: new Date() })
      .where(and(eq(messagesTable.trackingToken, token), isNull(messagesTable.openedAt)))
      .catch((err: unknown) => console.error("Track open error:", err));
  }
});

// GET /api/track/click/:token?url=<base64url>  — link click redirect
router.get("/click/:token", async (req, res) => {
  const { token } = req.params;
  const { url } = req.query as { url?: string };

  let destination = "/";
  if (url) {
    try {
      destination = Buffer.from(url, "base64url").toString("utf8");
    } catch {
      destination = "/";
    }
  }

  // Redirect immediately, record click asynchronously
  res.redirect(302, destination);

  if (token) {
    db.update(messagesTable)
      .set({ clickCount: sql`${messagesTable.clickCount} + 1` })
      .where(eq(messagesTable.trackingToken, token))
      .catch((err: unknown) => console.error("Track click error:", err));
  }
});

export default router;
