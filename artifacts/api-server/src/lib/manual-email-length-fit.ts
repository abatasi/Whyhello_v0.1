import { countEmailBodyCharacters, emailLengthInstruction, getEmailLength, type EmailLength } from "./email-length.js";
import { emailBodyFromAnatomy, type emailAnatomySchema } from "./manual-email-guidance.js";
import type { z } from "zod";

type Draft = { anatomy: z.infer<typeof emailAnatomySchema>; postscript?: string };

export function assertEmailCompactionSafe(original: Draft, candidate: Draft, suppliedQuotes: string[]) {
  const quoted = (text: string) => [...text.matchAll(/\*\*["“]([\s\S]+?)["”]\*\*/g)].map(match => match[1]);
  const excerpts = quoted(candidate.anatomy.hook);
  if (quoted(original.anatomy.hook).length && !excerpts.length) throw new Error("Editing removed the contextual quote.");
  if (excerpts.some(excerpt => !suppliedQuotes.some(source => source.includes(excerpt)))) throw new Error("Editing changed a verified quote.");
  const numbers = (text: string) => text.match(/\d+(?:[,.]\d+)*(?:[kmb]\b|%)?/gi)?.map(value => value.toLowerCase()) ?? [];
  const candidateNumbers = new Set(numbers(candidate.anatomy.proof));
  const originalNumbers = new Set(numbers(original.anatomy.proof));
  if ([...originalNumbers].some(value => !candidateNumbers.has(value)) || [...candidateNumbers].some(value => !originalNumbers.has(value))) throw new Error("Editing changed a verified proof amount.");
  const proofUnits = [
    /\b(?:hours?|hrs?)\b/i, /\b(?:minutes?|mins?)\b/i, /\b(?:days?)\b/i,
    /[$]|\bdollars?\b/i, /[€]|\beuros?\b/i, /[£]|\bpounds?\b/i,
    /\bCAD\b/i, /\bUSD\b/i, /\b(?:AUM|assets under management)\b/i,
    /\b(?:monthly|(?:per|a|each)\s+month)\b/i,
    /\b(?:yearly|annually|annual|(?:per|a|each)\s+year)\b/i,
    /\b(?:weekly|(?:per|a|each)\s+week)\b/i,
    /\b(?:one-time|one time|per[- ]transaction)\b/i,
  ];
  if (proofUnits.some(unit => unit.test(original.anatomy.proof) && !unit.test(candidate.anatomy.proof))) throw new Error("Editing changed a verified proof unit or frequency.");
}

/** One best-effort edit, never a length rejection or an expansion/filler loop. */
export async function fitManualEmailLength<T extends Draft>(
  draft: T, length: EmailLength,
  tighten: (instruction: string) => Promise<T>,
): Promise<T> {
  const originalSize = countEmailBodyCharacters(emailBodyFromAnatomy(draft.anatomy, draft.postscript));
  const spec = getEmailLength(length);
  if (originalSize <= spec.max) return draft;
  try {
    const candidate = await tighten(`Edit the preceding draft, not a new message. Its visible body is ${originalSize} characters; the selected ${length.toUpperCase()} guide is ${spec.min}–${spec.max}, aiming near ${spec.target}.
Return the same JSON structure, with all five anatomy fields complete. ${emailLengthInstruction(length)}
Keep the original selected insight, attribution, seller identity, supported claims and proof amount/unit/frequency. Preserve the supplied additionalContext facts, particularly a first-hand meeting, event name and location, in the buyer-facing Hook or Bridge. Reserve room for that acknowledgement; never shorten by dropping it or leave it only in metadata. Reuse the original evidence IDs; do not introduce new facts or offers.
The main task is to remove verbosity: shorten the discovery preface, choose one short exact quote excerpt instead of the full quote, remove repeated buyer/company/role setup, keep one supported value and proof point, and make CTA a brief question (about 6–12 words).
Keep bold double-quoted excerpts verbatim from the supplied quote and retain their contextual preface. No new source, customer, metric or deliverable. Return final JSON only.`);
    const revisedSize = countEmailBodyCharacters(emailBodyFromAnatomy(candidate.anatomy, candidate.postscript));
    return revisedSize > 0 && revisedSize < originalSize ? candidate : draft;
  } catch {
    // A valid preview is not lost if the optional edit is unavailable or unsafe.
    // The preview's visible length notice makes any remaining oversize explicit.
    return draft;
  }
}
