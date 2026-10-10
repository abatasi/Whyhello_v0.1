import { z } from "zod";

export const voiceSettingsSchema = z.object({
  toneTags: z.array(z.string().max(2000)).default([]),
  communicationStyle: z.string().max(1_000_000).default("balanced"),
  writingNotes: z.string().max(1_000_000).default(""),
  trainingText: z.string().max(1_000_000).default(""),
  suppressions: z.array(z.string().max(2000)).default([]),
  suppressionNotes: z.string().max(1_000_000).default(""),
}).passthrough();

const personaSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1, "Give each voice persona a name.").max(120),
  voice: voiceSettingsSchema,
  summary: z.string().max(12000).default(""),
}).passthrough();

type ProfileResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

/** Named personas are authoritative; keep legacy consumers on the active voice. */
export function prepareVoicePersonaProfile(value: unknown): ProfileResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "HQ profile must be an object." };
  }
  const profile = value as Record<string, unknown>;
  if (!Object.hasOwn(profile, "voicePersonas")) return { ok: true, data: profile };

  const parsed = z.object({
    voicePersonas: z.array(personaSchema).min(1, "Keep at least one voice persona."),
    activeVoicePersonaId: z.string().trim().min(1, "Choose an active voice persona."),
  }).safeParse(profile);
  if (!parsed.success) {
    return { ok: false, error: `Check your voice personas: ${parsed.error.issues[0]?.message ?? "Invalid persona configuration."}` };
  }
  const { voicePersonas, activeVoicePersonaId } = parsed.data;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const persona of voicePersonas) {
    if (ids.has(persona.id)) return { ok: false, error: "Voice persona IDs must be unique." };
    const name = persona.name.toLowerCase();
    if (names.has(name)) return { ok: false, error: "Give each voice persona a unique name." };
    ids.add(persona.id);
    names.add(name);
  }
  const active = voicePersonas.find(persona => persona.id === activeVoicePersonaId);
  if (!active) return { ok: false, error: "The active voice persona no longer exists. Choose another persona." };
  return { ok: true, data: { ...profile, voicePersonas, activeVoicePersonaId, voice: active.voice } };
}

export function resolveActiveHqVoice(profile: Record<string, unknown>): unknown {
  const result = prepareVoicePersonaProfile(profile);
  if (!result.ok) throw new Error(result.error);
  return result.data.voice;
}
