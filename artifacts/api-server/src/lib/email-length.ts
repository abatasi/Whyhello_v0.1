export const EMAIL_LENGTHS = {
  short: {
    target: 450,
    min: 350,
    max: 550,
    words: "roughly 60–90",
    feel: "punchy and highly skimmable",
    components: "HOOK 70–100; BRIDGE 50–70; VALUE 120–150; PROOF 70–100; CTA 40–60",
    development: "Use a sharp hook, a compact bridge, a specific value statement, one concise verified proof point, and a low-friction CTA.",
  },
  medium: {
    target: 750,
    min: 600,
    max: 900,
    words: "roughly 95–120",
    feel: "conversational, with room to develop an argument",
    components: "HOOK 140–180; BRIDGE 80–110; VALUE 160–200; PROOF 100–140; CTA 40–60; reserve remaining space for paragraph breaks and any source P.S.",
    development: "MEDIUM is a compact, five-layer email, not a long email. Aim near 750 visible characters in the 600–900 guide. Use one compact sentence per layer; the hook may add one very brief reaction and a short acknowledgement of supplied first-hand context if necessary. Reserve room for that context instead of omitting it. Select one buyer implication, one seller outcome and one verified proof point. Do not add a second argument, seller background or multiple supporting examples. A 1,400-character draft is not a Medium draft.",
  },
  long: {
    target: 1150,
    min: 950,
    max: 1300,
    words: "roughly 160–210",
    feel: "insight-rich, with more context and proof",
    components: "HOOK 130–180; BRIDGE 110–150; VALUE 280–350; PROOF 180–240; CTA 50–80",
    development: "Deepen the insight and its implications, expand the value and verified proof or customer context where available, and close with a specific CTA.",
  },
} as const;

export type EmailLength = keyof typeof EMAIL_LENGTHS;

export function getEmailLength(length: string | undefined) {
  return EMAIL_LENGTHS[length as EmailLength] ?? EMAIL_LENGTHS.medium;
}

/** Count visible body copy, not the subject, signature, Markdown syntax, or hidden link URLs. */
export function countEmailBodyCharacters(body: string): number {
  return body
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

export function emailLengthInstruction(length: string | undefined): string {
  const spec = getEmailLength(length);
  return `Email BODY COPY only (exclude the subject line and signature): approximate target ${spec.target} visible characters, an advisory guide of ${spec.min}–${spec.max} visible characters (${spec.words} words). The intended feel is ${spec.feel}.
Keep all five layers, in order, at every length. Approximate character allocations by layer: ${spec.components}.
Anatomy and supported facts take priority over all character targets. These figures are not minimums or hard caps, but the selected length is a meaningful writing constraint: plan the complete message near the target and within the guide instead of defaulting to a long draft. ${spec.development}
The visible BODY budget includes all five paragraphs and any source P.S.; Markdown markers and hidden link URLs do not count. Keep any P.S. to one short source pointer, not another argument. For Short and Medium, choose a short contiguous verbatim quote excerpt (about 8–12 words when feasible), with the contextual preface and brief reaction; do not spend the budget reproducing the full source paragraph.
Before returning the final output, review the combined visible body in this same generation. If it is oversized for the selected length, tighten redundant setup, repeated implications, unnecessary adjectives and extra examples while keeping Hook → Bridge → Value → Proof → CTA, contextual quote framing, exact quoted words and any verified amount, unit and frequency intact. Never cut text mid-sentence or drop a layer to fit.
Do not write the same email with filler added or removed. Develop the hook, bridge, value, and proof differently for this length. Never invent proof or add filler to reach a quota. With limited supported context, write a shorter complete message rather than padding it. Never omit a layer, refuse a complete draft or request a separate length-only rewrite because of character count.`;
}