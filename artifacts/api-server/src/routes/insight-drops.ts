import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { insightDropsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { getAuth } from "@clerk/express";

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

const router: IRouter = Router();

router.post("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const { mediaType, insightTitle, subInsightText, contactId } = req.body as {
      mediaType?: string;
      insightTitle?: string;
      subInsightText?: string;
      contactId?: number;
    };
    await db.insert(insightDropsTable).values({
      userId,
      mediaType: mediaType ?? null,
      insightTitle: insightTitle ?? null,
      subInsightText: subInsightText ?? null,
      contactId: contactId ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record insight drop" });
  }
});

router.get("/count", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [row] = await db
      .select({ count: count() })
      .from(insightDropsTable)
      .where(eq(insightDropsTable.userId, userId));
    res.json({ count: row?.count ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch count" });
  }
});

export default router;
