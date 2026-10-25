import * as React from "react";
import type { ManualEmailContext } from "./manual-email-model";
import { orderedHqVoicePersonas } from "@/lib/hq-voice-profile-model";
import { OUTPUT_TONE_DESCRIPTIONS } from "@/lib/output-tone-descriptions";

const chip = "inline-flex min-w-0 max-w-full cursor-pointer items-center whitespace-normal break-words rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const selectedChip = "border-primary bg-primary text-primary-foreground dark:bg-indigo-700 dark:border-indigo-700 dark:text-white";
const idleChip = "border-border bg-background dark:bg-transparent dark:text-slate-200 text-muted-foreground hover:bg-muted hover:text-foreground";

export function TonePersonaPicker({ tones, tone, voicePersonaId, inheritHqTone, context, loading, error, disabled, showHqVoice = true, showVoiceDescription = true, showGenericDescription = false, getDescription, onTone, onPersona, onHqVoice }: {
  tones: readonly string[];
  tone: string;
  voicePersonaId?: string | null;
  inheritHqTone: boolean;
  context?: ManualEmailContext;
  loading?: boolean;
  error?: boolean;
  disabled: boolean;
  showHqVoice?: boolean;
  showVoiceDescription?: boolean;
  showGenericDescription?: boolean;
  getDescription?: (tone: string, voicePersonaId?: string) => string | undefined;
  onTone: (tone: string) => void;
  onPersona: (id: string) => void;
  onHqVoice?: () => void;
}) {
  const personas = orderedHqVoicePersonas(context?.voicePersonas, context?.activeVoicePersonaId);
  const activePersonaId = context?.activeVoicePersonaId ?? null;
  const activeSelected = !voicePersonaId && inheritHqTone && !!activePersonaId && personas.some(persona => persona.id === activePersonaId);
  const fallbackSelected = !voicePersonaId && inheritHqTone && !!context?.voice && !activeSelected;
  const pinnedMissing = !!voicePersonaId && !personas.some(persona => persona.id === voicePersonaId);
  const selectedPersona = personas.find(persona => persona.id === (voicePersonaId || (activeSelected ? activePersonaId : null)));
  const genericDescription = !voicePersonaId && !activeSelected && !fallbackSelected
    ? getDescription?.(tone) || OUTPUT_TONE_DESCRIPTIONS[tone.toLowerCase()] : undefined;
  return <div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Tone and voice">
      {personas.map(persona => {
        const selected = voicePersonaId === persona.id || (activeSelected && activePersonaId === persona.id);
        return <button key={persona.id} type="button" aria-pressed={selected} data-testid={`button-voice-persona-${persona.id}`} disabled={disabled}
          aria-label={`${persona.name} — HQ persona`} title={getDescription?.(persona.name, persona.id) || persona.summary || `Saved HQ voice: ${persona.name}`} onClick={() => onPersona(persona.id)} className={`${chip} ${selected ? selectedChip : idleChip}`}>
          <span className="min-w-0 break-words">{persona.name}</span>
          <span data-voice-source="hq" className="ml-2 shrink-0 border-l border-current pl-2 text-[10px] font-semibold leading-none">HQ</span>
        </button>;
      })}
      {showHqVoice && onHqVoice && <button type="button" aria-pressed={fallbackSelected} data-testid="button-hq-voice" disabled={disabled || !context?.voice} onClick={onHqVoice}
        className={`${chip} ${fallbackSelected ? selectedChip : idleChip}`}>HQ voice</button>}
      {tones.map(item => {
        const selected = !voicePersonaId && !activeSelected && !fallbackSelected && tone.toLocaleLowerCase() === item.toLocaleLowerCase();
        return <button key={item} type="button" aria-pressed={selected} disabled={disabled} title={getDescription?.(item) || OUTPUT_TONE_DESCRIPTIONS[item.toLowerCase()]} onClick={() => onTone(item)}
          className={`${chip} ${selected ? selectedChip : idleChip}`}>{item}</button>;
      })}
    </div>
    {showVoiceDescription && selectedPersona && !loading && !error && <div data-testid="selected-hq-voice-description" aria-live="polite" className="mt-3 rounded-md border border-border px-3 py-2 text-xs leading-5">
      <p className="font-medium text-foreground">Voice Profile — {selectedPersona.name}</p>
      <p tabIndex={0} aria-label={`${selectedPersona.name} Voice Profile description`} className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground">{selectedPersona.summary?.trim() ? selectedPersona.summary : "No short description is saved for this voice. Add one in HQ."}</p>
    </div>}
    {showGenericDescription && genericDescription && <div data-testid="selected-generic-tone-description" role="status" aria-live="polite" className="mt-3 rounded-md border border-border px-3 py-2 text-xs leading-5">
      <p className="font-medium text-foreground">{tone}</p>
      <p className="mt-1 text-muted-foreground">{genericDescription}</p>
    </div>}
    {!showHqVoice && fallbackSelected && !loading && !error && <p role="status" className="mt-2 text-xs text-muted-foreground">This saved configuration uses a legacy HQ voice. Choose a named HQ persona or a generic tone to replace it.</p>}
    {loading && <p role="status" className="mt-2 text-xs text-muted-foreground">Loading saved voices…</p>}
    {error && <p role="alert" className="mt-2 text-xs text-destructive">Saved voices could not be loaded. Retry loading workspace context before choosing a voice.</p>}
    {!loading && !error && !personas.length && <p className="mt-2 text-xs text-muted-foreground">{!showHqVoice ? "No saved HQ personas available. Define a voice in HQ to use it here." : context?.voice ? "No named voices saved. HQ voice remains available." : "No saved voices or HQ voice are available."}</p>}
    {pinnedMissing && context && !loading && !error && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">The saved voice on this configuration is no longer available. Choose another voice to replace it.</p>}
    {showHqVoice && inheritHqTone && !activeSelected && context?.voice && <p className="mt-2 text-xs text-muted-foreground">Uses the currently active HQ voice when generated.</p>}
  </div>;
}
