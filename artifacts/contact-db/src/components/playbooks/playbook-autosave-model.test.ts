import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PlaybookAutosaveQueue, autosaveLabel } from "./playbook-autosave-model";

test("drains edits made during a save without concurrent or stale writes", async () => {
  const writes: string[] = [];
  const acknowledgments: string[] = [];
  let release!: (success: boolean) => void;
  const queue = new PlaybookAutosaveQueue("original", snapshot => {
    writes.push(snapshot);
    return new Promise(resolve => { release = resolve; });
  }, () => { acknowledgments.push(queue.confirmed); });
  queue.update("first");
  const saving = queue.flush();
  queue.update("second");
  const navigating = queue.flush();
  assert.equal(saving, navigating);
  assert.deepEqual(writes, ["first"]);
  release(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes, ["first", "second"]);
  assert.equal(queue.confirmed, "first");
  assert.equal(queue.state, "saving");
  release(true);
  assert.equal(await navigating, true);
  assert.equal(queue.confirmed, "second");
  assert.equal(queue.state, "saved");
  assert.ok(acknowledgments.includes("first"));
  await queue.flush();
  assert.equal(writes.length, 2);
});

test("failure retains the newest draft, does not acknowledge it, and can retry", async () => {
  let succeeds = false;
  let calls = 0;
  const queue = new PlaybookAutosaveQueue("saved", async () => { calls++; return succeeds; });
  queue.update("unsynced");
  assert.equal(await queue.flush(), false);
  assert.equal(queue.confirmed, "saved");
  assert.equal(queue.latest, "unsynced");
  assert.equal(queue.state, "error");
  assert.equal(calls, 1);
  succeeds = true;
  assert.equal(await queue.flush(), true);
  assert.equal(queue.confirmed, "unsynced");
});

test("writer rejection preserves changes, and reverting to an in-flight older snapshot still saves correctly", async () => {
  const broken = new PlaybookAutosaveQueue("saved", async () => { throw new Error("offline"); });
  broken.update("draft");
  assert.equal(await broken.flush(), false);
  assert.equal(broken.latest, "draft");
  const writes: string[] = [];
  let release!: (ok: boolean) => void;
  const queue = new PlaybookAutosaveQueue("original", snapshot => {
    writes.push(snapshot);
    return writes.length === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(true);
  });
  queue.update("edit");
  const flight = queue.flush();
  queue.update("original");
  release(true);
  assert.equal(await flight, true);
  assert.deepEqual(writes, ["edit", "original"]);
  assert.equal(queue.confirmed, "original");
});

test("quiet saving feedback and app confirmations replace browser prompts", () => {
  assert.equal(autosaveLabel("pending", true), "Saving changes…");
  assert.equal(autosaveLabel("saved", false), "All changes saved");
  assert.match(autosaveLabel("error", true), /Retry/);
  for (const file of ["../../pages/Playbooks.tsx", "./manual-email/ManualEmailStep.tsx", "./phone-call/PhoneCallStep.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /window\.(confirm|alert)|beforeunload/);
  }
});
