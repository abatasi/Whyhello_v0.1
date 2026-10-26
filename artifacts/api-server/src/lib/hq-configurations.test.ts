import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { db, pool } from "@workspace/db";
import { dnaProfilesTable, hqConfigurationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  activateHqConfiguration, createHqConfiguration, deleteHqConfiguration,
  hqRevision, listHqConfigurations, readHqConfiguration, renameHqConfiguration,
  saveHqConfiguration,
} from "./hq-configurations.js";
import { isMasterIdentity } from "./master-access.js";

after(() => pool.end());
test("master authorization requires the verified primary identity", () => {
  const primary = { id: "primary", emailAddress: "abatasi@gmail.com", verification: { status: "verified" } };
  assert.equal(isMasterIdentity({ primaryEmailAddressId: "primary", emailAddresses: [primary] }), true);
  assert.equal(isMasterIdentity({ primaryEmailAddressId: "other", emailAddresses: [primary] }), false);
  assert.equal(isMasterIdentity({ primaryEmailAddressId: "primary", emailAddresses: [{ ...primary, emailAddress: "ordinary@example.test" }] }), false);
  assert.equal(isMasterIdentity({ primaryEmailAddressId: "primary", emailAddresses: [{ ...primary, verification: { status: "unverified" } }] }), false);
});

test("multiple HQs preserve the live projection, revisions and ownership", async () => {
  const owner = `test-hq-${randomUUID()}`;
  const other = `test-hq-${randomUUID()}`;
  const initial = JSON.stringify({ company: { name: "Original" }, liveTargetMarketId: "original-market", voicePersonas: [] });
  try {
    await db.insert(dnaProfilesTable).values({ userId: owner, data: initial });
    let ws = await listHqConfigurations(owner);
    const first = ws.liveId;
    assert.equal(ws.items.length, 1);
    assert.equal((await readHqConfiguration(owner, first)).revision, hqRevision(initial));
    ws = await createHqConfiguration(owner, { name: "Alternative" });
    const second = ws.items.find(row => row.id !== first)!.id;
    assert.equal(ws.liveId, first);
    const next = { company: { name: "Alternative" }, liveTargetMarketId: "new-market", voicePersonas: [] };
    const blank = await readHqConfiguration(owner, second);
    await saveHqConfiguration(owner, second, next, blank.revision);
    const [projection] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, owner));
    assert.equal(projection.data, initial, "editing a draft must not affect messaging/scoring context");
    await assert.rejects(saveHqConfiguration(owner, second, {}, blank.revision), /changed/);
    await assert.rejects(deleteHqConfiguration(owner, first), /another HQ live/);
    await assert.rejects(createHqConfiguration(owner, { name: " alternative " }), /already exists/);
    await assert.rejects(readHqConfiguration(other, second), /not found/);
    await assert.rejects(saveHqConfiguration(other, second, {}, blank.revision), /not found/);
    await assert.rejects(activateHqConfiguration(other, second, first), /not found/);
    // A normal legacy HQ/audience writer must be snapshotted before activation.
    const edited = JSON.stringify({ company: { name: "Original edited" }, liveTargetMarketId: "original-market" });
    await db.update(dnaProfilesTable).set({ data: edited }).where(eq(dnaProfilesTable.userId, owner));
    ws = await activateHqConfiguration(owner, second, first);
    assert.equal(ws.items.filter(row => row.isLive).length, 1);
    assert.equal(ws.liveId, second);
    const [live] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, owner));
    assert.deepEqual(JSON.parse(live.data), next, "all legacy consumers now see exactly the selected HQ");
    assert.deepEqual((await readHqConfiguration(owner, first)).data, JSON.parse(edited));
    await assert.rejects(activateHqConfiguration(owner, first, first), /live HQ changed/);
    ws = await renameHqConfiguration(owner, second, "Renamed");
    assert.equal(ws.items.find(row => row.id === second)?.name, "Renamed");
    ws = await createHqConfiguration(owner, { name: "Copy", copyFromId: second });
    const copy = ws.items.find(row => row.name === "Copy")!;
    assert.deepEqual((await readHqConfiguration(owner, copy.id)).data, next);
    await deleteHqConfiguration(owner, copy.id);
    await activateHqConfiguration(owner, first, second);
    assert.deepEqual((await readHqConfiguration(owner, first)).data, JSON.parse(edited));
    const snapshot = await readHqConfiguration(owner, first);
    await saveHqConfiguration(owner, first, { company: { name: "Live edit" } }, snapshot.revision);
    const [liveEdited] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, owner));
    assert.equal(JSON.parse(liveEdited.data).company.name, "Live edit");
  } finally {
    for (const userId of [owner, other]) {
      await db.delete(hqConfigurationsTable).where(eq(hqConfigurationsTable.userId, userId));
      await db.delete(dnaProfilesTable).where(eq(dnaProfilesTable.userId, userId));
    }
  }
});

test("concurrent activation cannot silently replace a newer live choice", async () => {
  const owner = `test-hq-${randomUUID()}`;
  try {
    const first = (await listHqConfigurations(owner)).liveId;
    let ws = await createHqConfiguration(owner, { name: "Second" });
    const second = ws.items.find(row => row.name === "Second")!.id;
    ws = await createHqConfiguration(owner, { name: "Third" });
    const third = ws.items.find(row => row.name === "Third")!.id;
    const results = await Promise.allSettled([
      activateHqConfiguration(owner, second, first),
      activateHqConfiguration(owner, third, first),
    ]);
    assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
    assert.equal(results.filter(row => row.status === "rejected").length, 1);
    assert.equal((await listHqConfigurations(owner)).items.filter(row => row.isLive).length, 1);
  } finally {
    await db.delete(hqConfigurationsTable).where(eq(hqConfigurationsTable.userId, owner));
    await db.delete(dnaProfilesTable).where(eq(dnaProfilesTable.userId, owner));
  }
});

test("a delayed ID-scoped save cannot overwrite an activated identical copy", async () => {
  const owner = `test-hq-${randomUUID()}`;
  try {
    const first = (await listHqConfigurations(owner)).liveId;
    const original = await readHqConfiguration(owner, first);
    const ws = await createHqConfiguration(owner, { name: "Identical copy", copyFromId: first });
    const copy = ws.items.find(row => row.id !== first)!.id;
    await activateHqConfiguration(owner, copy, first);
    await saveHqConfiguration(owner, first, { company: { name: "Late old-tab edit" } }, original.revision);
    const [live] = await db.select().from(dnaProfilesTable).where(eq(dnaProfilesTable.userId, owner));
    assert.deepEqual(JSON.parse(live.data), original.data);
    assert.equal((await readHqConfiguration(owner, first)).data.company.name, "Late old-tab edit");
  } finally {
    await db.delete(hqConfigurationsTable).where(eq(hqConfigurationsTable.userId, owner));
    await db.delete(dnaProfilesTable).where(eq(dnaProfilesTable.userId, owner));
  }
});
