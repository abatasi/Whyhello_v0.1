import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { usersTable, contactRevealsTable } from "@workspace/db/schema";
import { and, count, eq, gte } from "drizzle-orm";

type AuthedReq = Request & { user: { id: string } };

function getUserId(req: Request): string | null {
  return (req as AuthedReq).user?.id ?? null;
}

const TIER_LIMITS: Record<string, number | null> = {
  freemium: 25,
  professional: 10000,
  enterprise: null,
};

function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getCreditStatus(userId: string) {
  const [user] = await db.select({ tier: usersTable.tier }).from(usersTable).where(eq(usersTable.id, userId));
  const tier = (user?.tier ?? "freemium") as keyof typeof TIER_LIMITS;
  const creditsTotal = TIER_LIMITS[tier] ?? null;
  const isUnlimited = creditsTotal === null;

  const [{ creditsUsed }] = await db
    .select({ creditsUsed: count() })
    .from(contactRevealsTable)
    .where(and(eq(contactRevealsTable.userId, userId), gte(contactRevealsTable.revealedAt, monthStart())));

  return { tier, creditsUsed: Number(creditsUsed), creditsTotal, isUnlimited };
}

const router: IRouter = Router();

router.get("/status", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    res.json(await getCreditStatus(userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch credit status" });
  }
});

router.get("/reveal-status/:contactId", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contactId" }); return; }

    const [existing] = await db
      .select()
      .from(contactRevealsTable)
      .where(and(eq(contactRevealsTable.userId, userId), eq(contactRevealsTable.contactId, contactId)));

    res.json({ isRevealed: !!existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reveal status" });
  }
});

router.post("/reveal/:contactId", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const contactId = parseInt(req.params.contactId);
    if (isNaN(contactId)) { res.status(400).json({ error: "Invalid contactId" }); return; }

    const [existing] = await db
      .select()
      .from(contactRevealsTable)
      .where(and(eq(contactRevealsTable.userId, userId), eq(contactRevealsTable.contactId, contactId)));

    if (existing) {
      const status = await getCreditStatus(userId);
      res.json({ revealed: true, alreadyRevealed: true, ...status });
      return;
    }

    const status = await getCreditStatus(userId);
    if (!status.isUnlimited && status.creditsUsed >= (status.creditsTotal ?? 0)) {
      res.status(402).json({
        error: "Insufficient credits",
        ...status,
      });
      return;
    }

    await db
      .insert(contactRevealsTable)
      .values({ userId, contactId })
      .onConflictDoNothing();

    const updated = await getCreditStatus(userId);
    res.json({ revealed: true, alreadyRevealed: false, ...updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reveal contact" });
  }
});

export default router;
