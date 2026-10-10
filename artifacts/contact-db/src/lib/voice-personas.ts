export interface VoiceDefinition {
  toneTags: string[];
  communicationStyle: string;
  writingNotes: string;
  trainingText: string;
  suppressions: string[];
  suppressionNotes: string;
}

export interface VoicePersona {
  id: string;
  name: string;
  voice: VoiceDefinition;
  summary: string;
}

export interface VoicePersonaData {
  voice: VoiceDefinition;
  voicePersonas: VoicePersona[];
  activeVoicePersonaId: string;
}

export function cloneVoice(voice: VoiceDefinition): VoiceDefinition {
  return {
    toneTags: [...(voice.toneTags ?? [])],
    communicationStyle: voice.communicationStyle ?? "",
    writingNotes: voice.writingNotes ?? "",
    trainingText: voice.trainingText ?? "",
    suppressions: [...(voice.suppressions ?? [])],
    suppressionNotes: voice.suppressionNotes ?? "",
  };
}

export function createVoicePersonaId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `voice_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function migrateVoicePersonas<T extends VoicePersonaData>(
  data: T,
  createId: () => string = createVoicePersonaId,
): T {
  const existing = Array.isArray(data.voicePersonas) ? data.voicePersonas : [];
  const personas = existing.length
    ? existing.map(persona => ({
        ...persona,
        name: persona.name || "Default",
        voice: cloneVoice(persona.voice ?? data.voice),
        summary: persona.summary ?? "",
      }))
    : [{
        id: createId(),
        name: "Default",
        voice: cloneVoice(data.voice),
        summary: "",
      }];
  const activeVoicePersonaId = personas.some(p => p.id === data.activeVoicePersonaId)
    ? data.activeVoicePersonaId
    : personas[0].id;
  const active = personas.find(p => p.id === activeVoicePersonaId)!;
  return { ...data, voicePersonas: personas, activeVoicePersonaId, voice: cloneVoice(active.voice) };
}

export function selectVoicePersona<T extends VoicePersonaData>(
  data: T,
  id: string,
): { data: T; editorPersonaId: string } {
  return {
    data,
    editorPersonaId: data.voicePersonas.some(persona => persona.id === id)
      ? id
      : data.activeVoicePersonaId,
  };
}

export function activateVoicePersona<T extends VoicePersonaData>(data: T, id: string): T {
  const persona = data.voicePersonas.find(item => item.id === id);
  if (!persona) return data;
  return { ...data, activeVoicePersonaId: id, voice: cloneVoice(persona.voice) };
}

export function updateVoicePersona<T extends VoicePersonaData>(
  data: T,
  id: string,
  patch: Partial<VoiceDefinition>,
): T {
  const personas = data.voicePersonas.map(persona =>
    persona.id === id ? { ...persona, voice: { ...persona.voice, ...patch } } : persona,
  );
  const updated = personas.find(persona => persona.id === data.activeVoicePersonaId);
  return { ...data, voicePersonas: personas, voice: updated ? cloneVoice(updated.voice) : data.voice };
}

export function updateVoicePersonaSummary<T extends VoicePersonaData>(
  data: T,
  id: string,
  summary: string,
): T {
  return {
    ...data,
    voicePersonas: data.voicePersonas.map(persona =>
      persona.id === id ? { ...persona, summary } : persona,
    ),
  };
}

export function renameVoicePersona<T extends VoicePersonaData>(
  data: T,
  id: string,
  rawName: string,
): { data: T; error: string | null } {
  const name = rawName.trim();
  if (!name) return { data, error: "Give this persona a name." };
  if (name.length > 120) return { data, error: "Names must be 120 characters or fewer." };
  if (data.voicePersonas.some(persona => persona.id !== id && persona.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { data, error: "A persona with that name already exists." };
  }
  if (!data.voicePersonas.some(persona => persona.id === id)) return { data, error: "Persona not found." };
  return {
    data: { ...data, voicePersonas: data.voicePersonas.map(persona => persona.id === id ? { ...persona, name } : persona) },
    error: null,
  };
}

export function duplicateVoicePersona<T extends VoicePersonaData>(
  data: T,
  sourceId: string,
  id = createVoicePersonaId(),
): T {
  const source = data.voicePersonas.find(persona => persona.id === sourceId);
  if (!source) return data;
  const base = `Copy of ${source.name}`.slice(0, 120);
  let name = base;
  let suffix = 2;
  while (data.voicePersonas.some(persona => persona.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    const ending = ` ${suffix++}`;
    name = `${base.slice(0, 120 - ending.length)}${ending}`;
  }
  return {
    ...data,
    voicePersonas: [...data.voicePersonas, { id, name, voice: cloneVoice(source.voice), summary: source.summary }],
  };
}

export function deleteVoicePersona<T extends VoicePersonaData>(
  data: T,
  id: string,
): { data: T; deleted: boolean; replacementId: string | null } {
  if (data.voicePersonas.length <= 1) return { data, deleted: false, replacementId: data.activeVoicePersonaId };
  const index = data.voicePersonas.findIndex(persona => persona.id === id);
  if (index < 0) return { data, deleted: false, replacementId: data.activeVoicePersonaId };
  const remaining = data.voicePersonas.filter(persona => persona.id !== id);
  const replacementId = id === data.activeVoicePersonaId
    ? remaining[Math.min(index, remaining.length - 1)].id
    : data.activeVoicePersonaId;
  const active = remaining.find(persona => persona.id === replacementId)!;
  return {
    data: { ...data, voicePersonas: remaining, activeVoicePersonaId: replacementId, voice: cloneVoice(active.voice) },
    deleted: true,
    replacementId,
  };
}
