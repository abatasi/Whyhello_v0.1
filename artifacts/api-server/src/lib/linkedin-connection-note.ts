export const CONNECTION_NOTE_LIMIT = 200;

/** Count the exact note using the same UTF-16 limit as the editor and API schema. */
export function connectionNoteError(body: string): string | null {
  if (!body.trim()) return "Add a personalized connection note.";
  if (body.length > CONNECTION_NOTE_LIMIT) return `Connection notes must be 200 characters or fewer (currently ${body.length}). Shorten the note; it has not been truncated.`;
  return null;
}