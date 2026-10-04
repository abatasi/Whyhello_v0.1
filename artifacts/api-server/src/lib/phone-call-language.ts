/**
 * Spoken messaging has its own language library. Do not borrow email shorthand.
 * Examples illustrate delivery only; they are never evidence about a recipient.
 */
export const PHONE_CALL_LANGUAGE_LIBRARY = {
  rules: [
    "Write for one person speaking to another, not an email being read aloud. These spoken-language rules take precedence over any written-outreach shorthand in HQ voice, guidelines, or regeneration instructions.",
    "Keep grammatical subjects and natural personal pronouns wherever the sentence needs them: I, you, we, it, and they. Say 'I noticed', 'I saw', 'I wanted to ask', and 'I'm calling because'; never clip them to 'Noticed', 'Saw', 'Wanted to ask', or 'Calling because'. Do not force a pronoun into every sentence or guess anyone's gender.",
    "Use natural contractions such as I'm, you're, we've, that's, and I'd when they fit the selected tone. Even formal calls use complete, speakable sentences rather than subjectless fragments.",
    "Use short complete sentences and ordinary vocabulary, with one thought per sentence and space for the other person to respond. Use periods and question marks for pauses, not email-style em-dash chains, semicolons, stage directions, or artificial filler like 'um' and 'uh'.",
    "Address the recipient as you, and use your team when appropriate instead of repeatedly naming their company or speaking about them in the third person. Use we only when the supplied seller context supports the claim; never imply that the seller and recipient share a company.",
    "A greeting should lead into a full spoken sentence. Include the seller's name/company only when supplied. Briefly explain why you're calling using supported research, then ask permission naturally. Do not start with a subjectless research fragment.",
    "Talking points must be ready-to-say sentences, not headlines or internal sales notes. Ask one plain, open-ended discovery question at a time. Objection responses should acknowledge what the person said, then respond briefly without pressure.",
    "Voicemails must sound like a person leaving a message: a greeting, a complete first-person reason for calling, and one simple next step. Include a callback number only when supplied. Closings should be natural, low-pressure spoken questions.",
    "Follow-up and reconnect wording must not imply a prior conversation unless the supplied context confirms one. Preserve evidence attribution and factual safeguards; conversational language never authorizes invented familiarity, facts, seller identity, or claims.",
    "Before returning JSON, silently read every spoken field aloud and revise any clipped subjects, email fragments, awkward noun-heavy phrases, or sentences that sound unnatural in conversation. Apply this to opener, talkingPoints, questions, objection responses, voicemail, and closing; keep personalization as a factual rationale.",
  ],
  examples: [
    {
      avoid: "Hi Abdo -- noticed RBC was recently recognized...",
      prefer: "Hi Abdo. I noticed RBC was recently recognized. Do you have a moment for me to explain why I'm calling?",
    },
    {
      avoid: "Wanted to ask about your team's priorities.",
      prefer: "I wanted to ask what your team is focused on right now.",
    },
    {
      avoid: "Discuss current process and pain points.",
      prefer: "I'd like to understand how your team handles this today.",
    },
    {
      avoid: "Worth a quick chat?",
      prefer: "Would you be open to a short conversation about that?",
    },
    {
      avoid: "Following up on our conversation.",
      prefer: "I'm calling to follow up on the information I sent you.",
      condition: "Use only when the supplied context confirms information was sent; otherwise give a supported reason without implying any previous contact.",
    },
    {
      avoid: "Not interested? Handle objection and restate value proposition.",
      prefer: "I understand. Is it not a priority right now, or is it something your team already has covered?",
    },
    {
      avoid: "Calling about the announcement. Let me know if relevant.",
      prefer: "Hi. I'm calling because I saw your team's announcement. I'd like to ask you a quick question about it when you have a moment.",
    },
  ],
} as const;

export function phoneCallLanguageGuidance(): string {
  return [
    "PHONE-CALL SPOKEN-LANGUAGE LIBRARY (separate from email and LinkedIn wording)",
    ...PHONE_CALL_LANGUAGE_LIBRARY.rules.map((rule, index) => `${index + 1}. ${rule}`),
    "DELIVERY EXAMPLES ONLY: do not copy names, companies, events, or unsupported facts from these examples into the script. Adapt the sentence structure to the supplied evidence.",
    ...PHONE_CALL_LANGUAGE_LIBRARY.examples.map(example =>
      `Avoid: ${example.avoid}\nPrefer: ${example.prefer}${"condition" in example ? `\nCondition: ${example.condition}` : ""}`),
  ].join("\n\n");
}