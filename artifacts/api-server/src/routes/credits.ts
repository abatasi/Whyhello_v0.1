import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { usersTable, contactRevealsTable, companyRevealsTable, contactsTable, companiesTable } from "@workspace/db/schema";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { EnrichRecordsBody, PreviewEnrichmentBody } from "@workspace/api-zod";

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

const TIER_LIMITS: Record<string, number | null> = {
  freemium: 1000,
  professional: 10000,
  enterprise: null,
};
const CREDITS_PER_RECORD = 1;

function monthStart(now = new Date()): Date {
  const d = new Date(now);
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

// Serialize all credit-consuming reveals for a user; either the whole selection
// fits the remaining balance or no new reveal is written.
async function commitEnrichment(userId: string, type: "contacts" | "companies", ids: number[]) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    // Use one timestamp for both the monthly balance check and inserted rows.
    // PostgreSQL's default now() is fixed at transaction start, which may be
    // before the month boundary even if the user lock is acquired afterward.
    const revealedAt = new Date();
    const billingMonthStart = monthStart(revealedAt);

    const [records, reveals, [user], [contactCount], [companyCount]] = await Promise.all([
      type === "contacts"
        ? tx.select({ id: contactsTable.id }).from(contactsTable).where(inArray(contactsTable.id, ids))
        : tx.select({ id: companiesTable.id }).from(companiesTable).where(inArray(companiesTable.id, ids)),
      type === "contacts"
        ? tx.select({ id: contactRevealsTable.contactId }).from(contactRevealsTable)
            .where(and(eq(contactRevealsTable.userId, userId), inArray(contactRevealsTable.contactId, ids)))
        : tx.select({ id: companyRevealsTable.companyId }).from(companyRevealsTable)
            .where(and(eq(companyRevealsTable.userId, userId), inArray(companyRevealsTable.companyId, ids))),
      tx.select({ tier: usersTable.tier }).from(usersTable).where(eq(usersTable.id, userId)),
      tx.select({ n: count() }).from(contactRevealsTable)
        .where(and(eq(contactRevealsTable.userId, userId), gte(contactRevealsTable.revealedAt, billingMonthStart))),
      tx.select({ n: count() }).from(companyRevealsTable)
        .where(and(eq(companyRevealsTable.userId, userId), gte(companyRevealsTable.revealedAt, billingMonthStart))),
    ]);

    if (records.length !== ids.length) return { kind: "unavailable" as const };
    const revealedIds = new Set(reveals.map((row) => row.id));
    const newIds = ids.filter((id) => !revealedIds.has(id));
    const limit = TIER_LIMITS[user?.tier ?? "freemium"] ?? null;
    const isUnlimited = limit === null;
    const creditsUsed = Number(contactCount.n) + Number(companyCount.n);
    if (!isUnlimited && newIds.length * CREDITS_PER_RECORD > limit - creditsUsed) {
      return { kind: "insufficient" as const };
    }

    let insertedCount = 0;
    if (newIds.length) {
      const inserted = type === "contacts"
        ? await tx.insert(contactRevealsTable).values(newIds.map((contactId) => ({ userId, contactId, revealedAt })))
            .onConflictDoNothing().returning({ id: contactRevealsTable.id })
        : await tx.insert(companyRevealsTable).values(newIds.map((companyId) => ({ userId, companyId, revealedAt })))
            .onConflictDoNothing().returning({ id: companyRevealsTable.id });
      insertedCount = inserted.length;
    }
    return {
      kind: "success" as const,
      selectedCount: ids.length,
      alreadyEnrichedCount: ids.length - insertedCount,
      enrichedCount: insertedCount,
      creditsCharged: insertedCount * CREDITS_PER_RECORD,
      creditsRemaining: isUnlimited ? null : Math.max(0, limit - creditsUsed - insertedCount),
      isUnlimited,
    };
  });
}

const router: IRouter = Router();

// Read-only estimate; revealing records and spending credits happen through separate routes.
router.post("/enrichment-preview", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = PreviewEnrichmentBody.safeParse(req.body);
  if (!parsed.success ||
      parsed.data.ids.some((id) => !Number.isSafeInteger(id) || id > 2147483647) ||
      new Set(parsed.data.ids).size !== parsed.data.ids.length) {
    res.status(400).json({ error: "Select 1 to 1000 distinct, valid records" });
    return;
  }

  const { type, ids } = parsed.data;
  try {
    const [records, reveals, status] = await Promise.all([
      type === "contacts"
        ? db.select({ id: contactsTable.id }).from(contactsTable).where(inArray(contactsTable.id, ids))
        : db.select({ id: companiesTable.id }).from(companiesTable).where(inArray(companiesTable.id, ids)),
      type === "contacts"
        ? db.select({ id: contactRevealsTable.contactId }).from(contactRevealsTable)
            .where(and(eq(contactRevealsTable.userId, userId), inArray(contactRevealsTable.contactId, ids)))
        : db.select({ id: companyRevealsTable.companyId }).from(companyRevealsTable)
            .where(and(eq(companyRevealsTable.userId, userId), inArray(companyRevealsTable.companyId, ids))),
      getCreditStatus(userId),
    ]);
    if (records.length !== ids.length) {
      res.status(409).json({ error: "Some selected records are no longer available. Refresh the directory and try again." });
      return;
    }

    const toEnrichCount = ids.length - reveals.length;
    res.json({
      selectedCount: ids.length,
      alreadyEnrichedCount: reveals.length,
      toEnrichCount,
      creditsPerRecord: CREDITS_PER_RECORD,
      creditsRequired: toEnrichCount * CREDITS_PER_RECORD,
      creditsRemaining: status.isUnlimited ? null : Math.max(0, (status.creditsTotal ?? 0) - status.creditsUsed),
      isUnlimited: status.isUnlimited,
    });
  } catch {
    res.status(500).json({ error: "Failed to calculate enrichment preview" });
  }
});

router.post("/enrich", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = EnrichRecordsBody.safeParse(req.body);
  if (!parsed.success ||
      parsed.data.ids.some((id) => !Number.isSafeInteger(id) || id > 2147483647) ||
      new Set(parsed.data.ids).size !== parsed.data.ids.length) {
    res.status(400).json({ error: "Select 1 to 1000 distinct, valid records" });
    return;
  }
  try {
    const result = await commitEnrichment(userId, parsed.data.type, parsed.data.ids);
    if (result.kind === "unavailable") {
      res.status(409).json({ error: "Some selected records are no longer available. Refresh the directory and try again." });
      return;
    }
    if (result.kind === "insufficient") {
      res.status(402).json({ error: "Insufficient credits. Refresh the estimate and try again." });
      return;
    }
    const { kind: _kind, ...response } = result;
    res.json(response);
  } catch {
    res.status(500).json({ error: "Failed to enrich selected records" });
  }
});

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
    const contactId = Number(req.params.contactId);
    if (!Number.isSafeInteger(contactId) || contactId <= 0 || contactId > 2147483647) { res.status(400).json({ error: "Invalid contactId" }); return; }
    const result = await commitEnrichment(userId, "contacts", [contactId]);
    if (result.kind === "unavailable") { res.status(404).json({ error: "Contact not found" }); return; }
    if (result.kind === "insufficient") { res.status(402).json({ error: "Insufficient credits", ...await getCreditStatus(userId) }); return; }
    const updated = await getCreditStatus(userId);
    res.json({ revealed: true, alreadyRevealed: result.enrichedCount === 0, ...updated });
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
    const companyId = Number(req.params.companyId);
    if (!Number.isSafeInteger(companyId) || companyId <= 0 || companyId > 2147483647) { res.status(400).json({ error: "Invalid companyId" }); return; }
    const result = await commitEnrichment(userId, "companies", [companyId]);
    if (result.kind === "unavailable") { res.status(404).json({ error: "Company not found" }); return; }
    if (result.kind === "insufficient") { res.status(402).json({ error: "Insufficient credits", ...await getCreditStatus(userId) }); return; }
    const updated = await getCreditStatus(userId);
    res.json({ revealed: true, alreadyRevealed: result.enrichedCount === 0, ...updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reveal company" });
  }
});

// ── Revealed contacts list (for message center recipient picker) ────────

router.get("/revealed-contacts", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const search = (req.query.search as string) ?? "";
    const rows = await db
      .select({
        id: contactsTable.id,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        email: contactsTable.email,
        jobTitle: contactsTable.jobTitle,
        companyName: companiesTable.name,
        companyId: contactsTable.companyId,
      })
      .from(contactRevealsTable)
      .innerJoin(contactsTable, eq(contactRevealsTable.contactId, contactsTable.id))
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .where(
        search
          ? and(
              eq(contactRevealsTable.userId, userId),
              sql`(${contactsTable.firstName} ilike ${`%${search}%`} OR ${contactsTable.lastName} ilike ${`%${search}%`} OR ${contactsTable.email} ilike ${`%${search}%`})`
            )
          : eq(contactRevealsTable.userId, userId)
      )
      .orderBy(contactsTable.firstName, contactsTable.lastName)
      .limit(50);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch revealed contacts" });
  }
});

export default router;
