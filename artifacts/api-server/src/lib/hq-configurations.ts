import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { dnaProfilesTable, hqConfigurationsTable as configs } from "@workspace/db/schema";

export const hqRevision = (data: string) => createHash("md5").update(data).digest("hex");
export class HqConfigurationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function workspace(tx: Tx, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`hq-configurations:${userId}`}))`);
  await tx.insert(dnaProfilesTable).values({ userId, data: "{}" }).onConflictDoNothing();
  const [projection] = await tx.select().from(dnaProfilesTable)
    .where(eq(dnaProfilesTable.userId, userId)).for("update");
  if (!projection) throw new Error("Unable to initialize live HQ");
  let rows = await tx.select().from(configs).where(eq(configs.userId, userId)).orderBy(asc(configs.createdAt), asc(configs.id));
  if (!rows.length) {
    rows = await tx.insert(configs).values({
      id: randomUUID(), userId, name: "Primary HQ", data: projection.data, isLive: true,
      updatedAt: projection.updatedAt,
    }).returning();
  }
  return { rows, projection };
}

function summary(state: Awaited<ReturnType<typeof workspace>>) {
  return {
    canManage: true,
    liveId: state.rows.find(row => row.isLive)!.id,
    items: state.rows.map(row => ({
      id: row.id, name: row.name, isLive: row.isLive,
      updatedAt: (row.isLive ? state.projection.updatedAt : row.updatedAt).toISOString(),
      revision: hqRevision(row.isLive ? state.projection.data : row.data),
    })),
  };
}
function find(rows: Awaited<ReturnType<typeof workspace>>["rows"], id: string) {
  const row = rows.find(row => row.id === id);
  if (!row) throw new HqConfigurationError(404, "HQ not found");
  return row;
}
function nameFor(value: unknown, rows: Awaited<ReturnType<typeof workspace>>["rows"], excludeId?: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80)
    throw new HqConfigurationError(400, "Use an HQ name between 1 and 80 characters");
  const name = value.trim();
  if (rows.some(row => row.id !== excludeId && row.name.toLowerCase() === name.toLowerCase()))
    throw new HqConfigurationError(409, "An HQ with this name already exists");
  return name;
}

export const listHqConfigurations = (userId: string) => db.transaction(async tx => summary(await workspace(tx, userId)));
export const readHqConfiguration = (userId: string, id: string) => db.transaction(async tx => {
  const state = await workspace(tx, userId);
  const row = find(state.rows, id);
  const data = row.isLive ? state.projection.data : row.data;
  return { data: JSON.parse(data), revision: hqRevision(data) };
});
export const createHqConfiguration = (userId: string, input: { name?: unknown; copyFromId?: unknown }) => db.transaction(async tx => {
  const state = await workspace(tx, userId);
  const name = nameFor(input.name, state.rows);
  const source = input.copyFromId == null ? null : find(state.rows, String(input.copyFromId));
  const data = !source ? "{}" : source.isLive ? state.projection.data : source.data;
  const [row] = await tx.insert(configs).values({ id: randomUUID(), userId, name, data }).returning();
  state.rows.push(row);
  return summary(state);
});
export const renameHqConfiguration = (userId: string, id: string, name: unknown) => db.transaction(async tx => {
  const state = await workspace(tx, userId);
  find(state.rows, id);
  const newName = nameFor(name, state.rows, id);
  await tx.update(configs).set({ name: newName }).where(and(eq(configs.id, id), eq(configs.userId, userId)));
  state.rows.find(row => row.id === id)!.name = newName;
  return summary(state);
});
export const deleteHqConfiguration = (userId: string, id: string) => db.transaction(async tx => {
  const state = await workspace(tx, userId);
  if (find(state.rows, id).isLive) throw new HqConfigurationError(409, "Make another HQ live before deleting this HQ");
  await tx.delete(configs).where(and(eq(configs.id, id), eq(configs.userId, userId)));
  state.rows = state.rows.filter(row => row.id !== id);
  return summary(state);
});
export const saveHqConfiguration = (userId: string, id: string, data: unknown, revision: unknown) => db.transaction(async tx => {
  const state = await workspace(tx, userId);
  const row = find(state.rows, id);
  const current = row.isLive ? state.projection.data : row.data;
  if (revision !== hqRevision(current)) throw new HqConfigurationError(409, "HQ profile changed. Reload before saving.");
  const serialized = JSON.stringify(data);
  const now = new Date();
  await tx.update(configs).set({ data: serialized, updatedAt: now })
    .where(and(eq(configs.id, id), eq(configs.userId, userId)));
  if (row.isLive) await tx.update(dnaProfilesTable).set({ data: serialized, updatedAt: now })
    .where(eq(dnaProfilesTable.userId, userId));
  return { ok: true, revision: hqRevision(serialized) };
});
export const activateHqConfiguration = (userId: string, id: string, expectedLiveId: unknown) => db.transaction(async tx => {
  const state = await workspace(tx, userId);
  const live = state.rows.find(row => row.isLive)!;
  const selected = find(state.rows, id);
  if (expectedLiveId !== live.id) throw new HqConfigurationError(409, "The live HQ changed. Reload before switching.");
  if (selected.isLive) return summary(state);
  // Legacy audience/profile writers update the live projection directly. Snapshot
  // that authoritative document before switching so those edits are never lost.
  await tx.update(configs).set({ data: state.projection.data, updatedAt: state.projection.updatedAt, isLive: false })
    .where(and(eq(configs.id, live.id), eq(configs.userId, userId)));
  const now = new Date();
  await tx.update(configs).set({ isLive: true }).where(and(eq(configs.id, id), eq(configs.userId, userId)));
  await tx.update(dnaProfilesTable).set({ data: selected.data, updatedAt: now }).where(eq(dnaProfilesTable.userId, userId));
  live.data = state.projection.data;
  live.updatedAt = state.projection.updatedAt;
  live.isLive = false;
  selected.isLive = true;
  state.projection.data = selected.data;
  state.projection.updatedAt = now;
  return summary(state);
});
