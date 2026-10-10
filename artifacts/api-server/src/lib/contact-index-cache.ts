import type { Request, Response, RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db, pool, type PoolClient } from "@workspace/db";
import { contactIndexCacheTable, dnaProfilesTable, contactsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { hqIndexFingerprint, indexIsFresh, scoresIndexIsFresh } from "./contact-index-policy";

type IndexKind = "quotes" | "scores";
export function indexingUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}
export async function readContactIndex(userId: string, contactId: number, kind: IndexKind) {
  const [snapshot] = await db.select().from(contactIndexCacheTable).where(and(
    eq(contactIndexCacheTable.userId, userId), eq(contactIndexCacheTable.contactId, contactId), eq(contactIndexCacheTable.kind, kind),
  )).limit(1);
  return snapshot;
}
async function ownedHq(userId: string) {
  const [row] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId)).limit(1);
  const profile = row ? JSON.parse(row.data) : {};
  return { profile, fingerprint: hqIndexFingerprint(profile) };
}

export const contactIndexingStatus: RequestHandler = async (req, res, next) => {
  try {
    const userId = indexingUserId(req);
    if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
    const contactId = Number(req.params.contactId);
    if (!Number.isInteger(contactId) || contactId <= 0) { res.status(400).json({ error: "Invalid contact ID" }); return; }
    const [contact] = await db.select({ id: contactsTable.id }).from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    const [hq, quotes, scores] = await Promise.all([ownedHq(userId), readContactIndex(userId, contactId, "quotes"), readContactIndex(userId, contactId, "scores")]);
    res.json({
      quotesNeedRefresh: !indexIsFresh(quotes, hq.fingerprint),
      scoresNeedRefresh: !scoresIndexIsFresh(scores, quotes, hq.fingerprint),
      quotesIndexedAt: quotes?.indexedAt.toISOString() ?? null,
      scoresIndexedAt: scores?.indexedAt.toISOString() ?? null,
      hqRevision: hq.fingerprint,
    });
  } catch (error) { next(error); }
};

/** JSON-only handlers: serialize refreshes across tabs/servers, cache successful empty results too.
 * Waiting callers release their pool connection between lock attempts to avoid pool exhaustion.
 */
export function cachedContactIndex(kind: IndexKind, handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    const send = res.json.bind(res);
    let client: PoolClient | undefined;
    let lockKey: string | undefined;
    try {
      const userId = indexingUserId(req);
      if (!userId) { res.status(401); send({ error: "Authentication required" }); return; }
      const contactId = Number(req.params.contactId);
      if (!Number.isInteger(contactId) || contactId <= 0) { res.status(400); send({ error: "Invalid contact ID" }); return; }
      lockKey = `${userId}:${contactId}:${kind}`;
      const startedAt = Date.now();
      for (;;) {
        client = await pool.connect();
        const lock = await client.query("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked", [lockKey]);
        if (lock.rows[0].locked) break;
        client.release(); client = undefined;
        if (Date.now() - startedAt > 180_000) { res.status(503); send({ error: "Indexing is already in progress. Please try again shortly." }); return; }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      const hq = await ownedHq(userId);
      const [snapshot, quotes] = await Promise.all([
        readContactIndex(userId, contactId, kind),
        kind === "scores" ? readContactIndex(userId, contactId, "quotes") : Promise.resolve(undefined),
      ]);
      const fresh = kind === "scores" ? scoresIndexIsFresh(snapshot, quotes, hq.fingerprint) : indexIsFresh(snapshot, hq.fingerprint);
      if (req.body?.force !== true && fresh && snapshot) { send(snapshot.results); return; }
      // The fingerprint and the prompt must use the same HQ snapshot even if HQ changes mid-run.
      res.locals.contactIndexHqProfile = hq.profile;
      let body: unknown;
      let captured = false;
      res.json = ((value: unknown) => { captured = true; body = value; return res; }) as Response["json"];
      await handler(req, res);
      res.json = send;
      if (!captured) throw new Error("Indexing handler returned no JSON response.");
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const values = { userId, contactId, kind, results: body, hqFingerprint: hq.fingerprint, indexedAt: new Date() };
        await db.insert(contactIndexCacheTable).values(values).onConflictDoUpdate({
          target: [contactIndexCacheTable.userId, contactIndexCacheTable.contactId, contactIndexCacheTable.kind],
          set: { results: values.results, hqFingerprint: values.hqFingerprint, indexedAt: values.indexedAt },
        });
      }
      send(body);
    } catch (error) {
      res.json = send;
      next(error);
    } finally {
      if (client) {
        try { if (lockKey) await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [lockKey]); }
        catch { client.release(true); client = undefined; }
        finally { client?.release(); }
      }
    }
  };
}
