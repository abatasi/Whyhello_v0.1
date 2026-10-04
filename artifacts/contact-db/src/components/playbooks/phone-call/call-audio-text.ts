import type { CallScript } from "../phone-call-model";

export type CallAudioSection = "conversation" | "opener" | "voicemail";
export const CALL_AUDIO_CHARACTER_LIMIT = 6000;
export function callAudioText(script: CallScript, section: CallAudioSection): string {
  const parts = section === "voicemail" ? [script.voicemail] : section === "opener" ? [script.opener]
    : [script.opener, ...script.talkingPoints, ...script.questions, script.closing];
  return parts.map(part => part.trim()).filter(Boolean).join("\n\n");
}