import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { isHqVoiceQueryForUser, playbookContextQueryKey } from "./hq-voice-query-model";

test("description-aware context cannot reuse a cached name-only response", () => {
  const client = new QueryClient();
  client.setQueryData(["manual-email-context", 7, "owner"], { voicePersonas: [{ id: "a", name: "Advisor" }] });
  assert.equal(client.getQueryData(playbookContextQueryKey(7, "owner")), undefined);
  assert.notDeepEqual(playbookContextQueryKey(7, "owner"), playbookContextQueryKey(7, "other"));
  client.clear();
});

test("HQ save invalidation refreshes this owner's voices and Playbooks, not another account or indexing", async () => {
  const client = new QueryClient();
  const ownProfile = ["hq-profile", "owner"];
  const ownContext = playbookContextQueryKey(7, "owner");
  const anotherPlaybook = playbookContextQueryKey(8, "owner");
  const otherContext = playbookContextQueryKey(7, "other");
  const otherProfile = ["hq-profile", "other"];
  const indexing = ["contact-index-status", 4, "owner"];
  for (const key of [ownProfile, ownContext, anotherPlaybook, otherContext, otherProfile, indexing]) client.setQueryData(key, {});
  await client.invalidateQueries({ predicate: query => isHqVoiceQueryForUser(query.queryKey, "owner") });
  for (const key of [ownProfile, ownContext, anotherPlaybook]) assert.equal(client.getQueryState(key)?.isInvalidated, true);
  for (const key of [otherContext, otherProfile, indexing]) assert.equal(client.getQueryState(key)?.isInvalidated, false);
  assert.equal(isHqVoiceQueryForUser(ownContext, undefined), false);
  client.clear();
});

test("an open Playbook receives the newly saved description after HQ invalidates its metadata", async () => {
  const client = new QueryClient();
  const queryKey = playbookContextQueryKey(7, "owner");
  let savedDescription = "The earlier voice description.";
  const queryFn = async () => ({ voicePersonas: [{ id: "a", name: "Advisor", summary: savedDescription }] });
  await client.fetchQuery({ queryKey, queryFn, staleTime: Infinity });
  const observer = new QueryObserver(client, { queryKey, queryFn, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  try {
    savedDescription = "Short, energetic messages with a direct, low-pressure ask.";
    await client.invalidateQueries({ predicate: query => isHqVoiceQueryForUser(query.queryKey, "owner") });
    assert.equal(client.getQueryData<Awaited<ReturnType<typeof queryFn>>>(queryKey)?.voicePersonas[0].summary, savedDescription);
  } finally {
    unsubscribe();
    client.clear();
  }
});
