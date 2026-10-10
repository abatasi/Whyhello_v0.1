/** A new cache shape prevents old name-only responses hiding saved descriptions. */
export function playbookContextQueryKey(playbookId: number, userId?: string | null) {
  return ["manual-email-context", playbookId, userId ?? "signed-out", "voice-profile-descriptions"];
}

export function isHqVoiceQueryForUser(key: readonly unknown[], userId?: string | null): boolean {
  if (!userId) return false;
  return (key[0] === "hq-profile" && key[1] === userId)
    || (key[0] === "manual-email-context" && key[2] === userId);
}
