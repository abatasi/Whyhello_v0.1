/** Accept shortened numeric citations only when they identify one supplied source. */
export function resolveEvidenceIds<E extends { id: string }>(evidence: E[], references: string[]): E[] {
  const resolved = new Map<string, E>();
  for (const reference of references) {
    const id = reference.trim();
    const exact = evidence.find(item => item.id === id);
    const matches = exact ? [exact] : /^\d+$/.test(id)
      ? evidence.filter(item => item.id.slice(item.id.lastIndexOf(":") + 1) === id)
      : [];
    const source = matches[0];
    if (matches.length !== 1 || !source) throw new Error("Generated evidence citation does not identify a supplied source.");
    resolved.set(source.id, source);
  }
  return [...resolved.values()];
}

export function assertFilledEmail(subject: string, body: string): void {
  const placeholder = /\[(?:sender(?:'s)?\s*name|your\s*(?:name|company)|(?:first|last|company|contact)\s*name|insert\b[^\]]*)\]|\{\{\s*\w+\s*\}\}/i;
  if (placeholder.test(subject) || placeholder.test(body)) throw new Error("Generated email contains unfilled placeholders.");
}