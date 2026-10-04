/** Merge only actual available contact fields; never leave a token in a call script. */
export function renderCallText(text: string, fields: Record<string, string>): string {
  const rendered = text.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_match, name: string) => {
    const key = name.trim();
    if (!Object.hasOwn(fields, key) || !fields[key]) throw new Error(`Template field "${key}" is unavailable for this contact.`);
    return fields[key];
  });
  if (/\{\{|\}\}/.test(rendered)) throw new Error("Template field has an invalid merge token.");
  return rendered;
}