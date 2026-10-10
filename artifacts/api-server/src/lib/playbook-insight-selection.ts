type Insight = { id: number; title: string; description: string | null; url: string };

/** Scores are contact-scoped and keyed by signal type AND ID, never ID alone. */
export function selectTopPlaybookInsight<T extends Insight>(
  rows: readonly T[], signalType: string, scores: ReadonlyMap<string, number>,
): T | undefined {
  return rows
    .filter(row => (row.title.trim() || row.description?.trim()) && row.url.trim())
    .sort((a, b) =>
      (scores.get(`${signalType}:${b.id}`) ?? -1) - (scores.get(`${signalType}:${a.id}`) ?? -1)
      || b.id - a.id,
    )[0];
}
