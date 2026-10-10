import type { ManualEmailContext } from "../components/playbooks/manual-email-model";

export interface HqVoiceProfile {
  voice?: Record<string, unknown> | null;
  voicePersonas?: { id: string; name: string; voice?: Record<string, unknown>; summary?: string }[];
  activeVoicePersonaId?: string | null;
}

export function orderedHqVoicePersonas<T extends { id: string; name: string }>(personas: readonly T[] | undefined, activePersonaId?: string | null): T[] {
  const ordered = personas?.filter(persona => persona.id.trim() && persona.name.trim()) ?? [];
  const activeIndex = ordered.findIndex(persona => persona.id === activePersonaId);
  if (activeIndex > 0) {
    const [active] = ordered.splice(activeIndex, 1);
    ordered.unshift(active);
  }
  return ordered;
}

export function preferredHqPersonaId(profile: HqVoiceProfile | null | undefined): string | null {
  return orderedHqVoicePersonas(profile?.voicePersonas, profile?.activeVoicePersonaId)[0]?.id ?? null;
}

export interface HqToneChoice { tone: string; voicePersonaId: string | null }
export interface ScopedHqToneChoice extends HqToneChoice { scope: string }
export function resolveHqToneChoice(profile: HqVoiceProfile | null | undefined, scope: string, override: ScopedHqToneChoice | null): HqToneChoice {
  if (override?.scope === scope) return { tone: override.tone, voicePersonaId: override.voicePersonaId };
  return { tone: "professional", voicePersonaId: preferredHqPersonaId(profile) };
}

export function toVoicePickerContext(profile: HqVoiceProfile | null | undefined): ManualEmailContext | undefined {
  if (!profile) return undefined;
  return {
    contacts: [],
    contextSources: [],
    voice: profile.voice ? "available" : "",
    aiAvailable: false,
    mailboxes: [],
    templates: [],
    voicePersonas: profile.voicePersonas?.map(persona => ({ id: persona.id, name: persona.name, summary: persona.summary })) ?? [],
    activeVoicePersonaId: profile.activeVoicePersonaId ?? null,
  };
}
