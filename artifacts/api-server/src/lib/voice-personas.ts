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

export class VoicePersonaSelectionError extends Error {
  constructor(message = "This voice persona is no longer available. Choose another tone or saved persona.") {
    super(message);
    this.name = "VoicePersonaSelectionError";
  }
}

export function voicePersonaOptions(profile: Record<string, unknown>) {
  const result = prepareVoicePersonaProfile(profile);
  if (!result.ok) throw new Error(result.error);
  const personas = (result.data.voicePersonas ?? []) as z.infer<typeof personaSchema>[];
  return {
    voicePersonas: personas.map(({ id, name, summary }) => ({ id, name, summary })),
    activeVoicePersonaId: personas.length ? result.data.activeVoicePersonaId as string : null,
  };
}

export function resolveHqVoice(profile: Record<string, unknown>, personaId?: string | null): unknown {
  const result = prepareVoicePersonaProfile(profile);
  if (!result.ok) throw new Error(result.error);
  if (personaId == null) return result.data.voice;
  if (typeof personaId !== "string" || !personaId.trim() || personaId.trim().length > 100) {
    throw new VoicePersonaSelectionError("Choose a valid saved voice persona.");
  }
  const personas = (result.data.voicePersonas ?? []) as z.infer<typeof personaSchema>[];
  const selected = personas.find(persona => persona.id === personaId.trim());
  if (!selected) throw new VoicePersonaSelectionError();
  return selected.voice;
}

export function resolveActiveHqVoice(profile: Record<string, unknown>): unknown {
  return resolveHqVoice(profile);
}

export interface OutputVoiceSelection {
  tone?: string;
  customTone?: string;
  inheritHqTone?: boolean;
  voicePersonaId?: string | null;
}

/** Resolve only against the authenticated owner's profile, never client definitions. */
export function resolveOutputVoice(profile: Record<string, unknown>, selection: OutputVoiceSelection) {
  const explicit = selection.voicePersonaId != null;
  const wantsVoice = explicit || selection.inheritHqTone || selection.tone === "my_voice_profile";
  const genericTone = selection.tone === "Custom" ? selection.customTone ?? "" : selection.tone ?? "Default";
  if (!wantsVoice) return { tone: genericTone, hqVoice: "", voiceProfile: undefined, voicePersonaId: null };
  const raw = resolveHqVoice(profile, selection.voicePersonaId);
  if (!raw) {
    if (explicit || selection.tone === "my_voice_profile") {
      throw new VoicePersonaSelectionError("No saved HQ voice is available. Choose a generic tone or define a persona in HQ.");
    }
    return { tone: genericTone, hqVoice: "", voiceProfile: undefined, voicePersonaId: null };
  }
  const voiceProfile = voiceSettingsSchema.parse(raw);
  return {
    tone: explicit ? "Selected HQ voice persona — use its style instead of a generic tone" : genericTone,
    // Bound examples before serialization so every constraint remains present.
    hqVoice: JSON.stringify({ ...voiceProfile, trainingText: voiceProfile.trainingText.slice(0, 8000) }),
    voiceProfile,
    voicePersonaId: explicit ? selection.voicePersonaId!.trim() : null,
  };
}
