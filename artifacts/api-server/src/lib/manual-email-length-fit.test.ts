import assert from "node:assert/strict";
import test from "node:test";
import { assertEmailCompactionSafe, fitManualEmailLength } from "./manual-email-length-fit.js";
import { emailAnatomySchema } from "./manual-email-guidance.js";
const draft = (value: string) => ({ anatomy: { hook: "Supported hook.", bridge: "Buyer implication.", value, proof: "Saving on average 12 staff hours monthly.", cta: "Compare notes?" }, postscript: "" });

test("Medium makes one measured tightening pass for an oversized complete draft", async () => {
  let calls = 0;
  const original = draft("Supported outcome. ".repeat(80));
  const compact = draft("Supported outcome. ".repeat(30));
  const result = await fitManualEmailLength(original, "medium", async instruction => {
    calls++;
    assert.match(instruction, /600–900, aiming near 750/);
    assert.match(instruction, /proof amount\/unit\/frequency/);
    assert.match(instruction, /6–12 words/);
    return compact;
  });
  assert.equal(calls, 1);
  assert.equal(result, compact);
  assert.equal(result.anatomy.proof, original.anatomy.proof);
});

test("in-guide and undersized messages never trigger a repair or filler expansion", async () => {
  for (const body of ["A supplied outcome.", "A supplied outcome. ".repeat(28)]) {
    const original = draft(body);
    assert.equal(await fitManualEmailLength(original, "medium", async () => { throw new Error("Must not call"); }), original);
  }
});

test("failed, invalid, unchanged or longer revisions retain the original without a length failure", async () => {
  const original = draft("Verified outcome. ".repeat(100));
  for (const tighten of [
    async () => { throw new Error("Unavailable"); },
    async () => { return { ...original, anatomy: emailAnatomySchema.parse({ ...original.anatomy, bridge: "" }) }; },
    async () => original,
    async () => draft("Verified outcome. ".repeat(110)),
  ]) assert.equal(await fitManualEmailLength(original, "medium", tighten), original);
});

test("a shorter revision still outside the guide never triggers a second repair or rejection", async () => {
  let calls = 0;
  const compact = draft("Verified outcome. ".repeat(60));
  const result = await fitManualEmailLength(draft("Verified outcome. ".repeat(100)), "medium", async () => { calls++; return compact; });
  assert.equal(calls, 1);
  assert.equal(result, compact);
});

test("compaction preserves quote words and proof amount, unit and frequency", () => {
  const source = "Advisor independence means little without the infrastructure to act on it.";
  const original = draft("A supplied value.");
  original.anatomy.hook = `I came across your post: **"${source}"**. That distinction stood out.`;
  const candidate = { ...original, anatomy: { ...original.anatomy, hook: 'I came across your post: **"Advisor independence means little without the infrastructure"**. That stood out.' } };
  assert.doesNotThrow(() => assertEmailCompactionSafe(original, candidate, [source]));
  for (const proof of ["Saving on average 120 staff hours monthly.", "Saving on average 12 staff days monthly.", "Saving on average 12 staff hours yearly.", "Saving on average 12 staff hours monthly and improving efficiency 20%."]) {
    assert.throws(() => assertEmailCompactionSafe(original, { ...candidate, anatomy: { ...candidate.anatomy, proof } }, [source]));
  }
  assert.throws(() => assertEmailCompactionSafe(original, { ...candidate, anatomy: { ...candidate.anatomy, hook: 'Loved your post: **"A paraphrased quote"**.' } }, [source]));
  assert.throws(() => assertEmailCompactionSafe(original, { ...candidate, anatomy: { ...candidate.anatomy, hook: "I read your post." } }, [source]));
});
