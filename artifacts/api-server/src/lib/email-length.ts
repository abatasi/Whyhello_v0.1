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
    words: "roughly 100–145",
    feel: "conversational, with room to develop an argument",
    components: "HOOK 100–140; BRIDGE 80–110; VALUE 190–240; PROOF 120–160; CTA 50–70",
    development: "Develop the hook and bridge, connect the value to the buyer's context, support it with verified proof or an economic benefit, and end with a tailored CTA.",
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
  return `Email BODY COPY only (exclude the subject line and signature): target about ${spec.target} visible characters, acceptable range ${spec.min}–${spec.max} visible characters (${spec.words} words). The intended feel is ${spec.feel}.
Keep all five layers, in order, at every length. Approximate character allocations by layer: ${spec.components}.
These layer allocations describe relative depth, not hard caps: the full-body range takes priority, especially where the component estimates do not add up to the overall target. ${spec.development}
Do not write the same email with filler added or removed. Develop the hook, bridge, value, and proof differently for this length. Never invent proof to fill space; if proof is limited, use the available verified context and stay within the acceptable body range. Count rendered copy, not Markdown formatting or hidden URLs.`;
}