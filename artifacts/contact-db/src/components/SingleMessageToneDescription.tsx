import * as React from "react";
import type { HqVoiceProfile } from "../lib/hq-voice-profile-model";
import { OUTPUT_TONE_DESCRIPTIONS } from "../lib/output-tone-descriptions";

export const SINGLE_MESSAGE_TONE_DESCRIPTIONS = OUTPUT_TONE_DESCRIPTIONS;

export function getSingleMessageToneDescription(tone: string, voicePersonaId: string | null, profile?: HqVoiceProfile | null) {
  if (voicePersonaId) {
    const persona = profile?.voicePersonas?.find(item => item.id === voicePersonaId);
    if (!persona) return {
      label: "HQ voice unavailable",
      description: "This saved persona is no longer available. Choose another tone or HQ persona.",
    };
    return {
      label: `${persona.name} · HQ`,
      description: persona.summary?.trim() ? persona.summary : "No Voice Profile description is saved for this persona yet. Generate or write one in HQ.",
    };
  }
  const key = tone.toLowerCase();
  return {
    label: tone.charAt(0).toUpperCase() + tone.slice(1),
    description: SINGLE_MESSAGE_TONE_DESCRIPTIONS[key] ?? "Choose a tone to see how it will sound.",
  };
}

export function SingleMessageToneDescription({ tone, voicePersonaId, profile }: {
  tone: string; voicePersonaId: string | null; profile?: HqVoiceProfile | null;
}) {
  const { label, description } = getSingleMessageToneDescription(tone, voicePersonaId, profile);
  return <div className="mt-3 rounded-md border border-border px-3 py-2.5" role="status" aria-live="polite">
    <p className="text-xs font-medium text-foreground">{label}</p>
    <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground"
      tabIndex={0} aria-label={`${label} tone description`}>{description}</p>
  </div>;
}
