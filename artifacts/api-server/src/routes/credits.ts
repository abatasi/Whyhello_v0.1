import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { usersTable, contactRevealsTable, companyRevealsTable } from "@workspace/db/schema";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

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

  const start = monthStart();

  const [contactCount] = await db
    .select({ n: count() })
    .from(contactRevealsTable)
    .where(and(eq(contactRevealsTable.userId, userId), gte(contactRevealsTable.revealedAt, start)));

  const [companyCount] = await db
    .select({ n: count() })
    .from(companyRevealsTable)
    .where(and(eq(companyRevealsTable.userId, userId), gte(companyRevealsTable.revealedAt, start)));

  const creditsUsed = Number(contactCount.n) + Number(companyCount.n);

  return { tier, creditsUsed, creditsTotal, isUnlimited };
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

// ── Batch reveal status ────────────────────────────────────

router.get("/reveal-statuses", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const idsParam = req.query.ids as string;
    if (!idsParam) { res.json({ revealedIds: [] }); return; }
    const ids = idsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) { res.json({ revealedIds: [] }); return; }
    const rows = await db
      .select({ contactId: contactRevealsTable.contactId })
      .from(contactRevealsTable)
      .where(and(eq(contactRevealsTable.userId, userId), inArray(contactRevealsTable.contactId, ids)));
    res.json({ revealedIds: rows.map((r) => r.contactId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reveal statuses" });
  }
});

// ── Contact reveal ──────────────────────────────────────────

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
      res.status(402).json({ error: "Insufficient credits", ...status });
      return;
    }

    await db.insert(contactRevealsTable).values({ userId, contactId }).onConflictDoNothing();

    const updated = await getCreditStatus(userId);
    res.json({ revealed: true, alreadyRevealed: false, ...updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reveal contact" });
  }
});

// ── Company reveal ──────────────────────────────────────────

router.get("/company-reveal-status/:companyId", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) { res.status(400).json({ error: "Invalid companyId" }); return; }

    const [existing] = await db
      .select()
      .from(companyRevealsTable)
      .where(and(eq(companyRevealsTable.userId, userId), eq(companyRevealsTable.companyId, companyId)));

    res.json({ isRevealed: !!existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch company reveal status" });
  }
});

router.post("/reveal-company/:companyId", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) { res.status(400).json({ error: "Invalid companyId" }); return; }

    const [existing] = await db
      .select()
      .from(companyRevealsTable)
      .where(and(eq(companyRevealsTable.userId, userId), eq(companyRevealsTable.companyId, companyId)));

    if (existing) {
      const status = await getCreditStatus(userId);
      res.json({ revealed: true, alreadyRevealed: true, ...status });
      return;
    }

    const status = await getCreditStatus(userId);
    if (!status.isUnlimited && status.creditsUsed >= (status.creditsTotal ?? 0)) {
      res.status(402).json({ error: "Insufficient credits", ...status });
      return;
    }

    await db.insert(companyRevealsTable).values({ userId, companyId }).onConflictDoNothing();

    const updated = await getCreditStatus(userId);
    res.json({ revealed: true, alreadyRevealed: false, ...updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reveal company" });
  }
});

export default router;
