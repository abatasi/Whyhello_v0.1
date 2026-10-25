import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { Check } from "lucide-react";
import type { ConnectionVariant } from "../linkedin-connection-model";
import { RESEARCH_SOURCES, type ManualEmailContext } from "../manual-email-model";
import { TonePersonaPicker } from "../TonePersonaPicker";
import { AdditionalMessageContext } from "../AdditionalMessageContext";

export const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30";
export const smallButton = "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
export const labelClass = "mb-1.5 block text-xs font-semibold text-foreground";
const objectives = ["Connect", "Reconnect"] as const;

export function ConnectionFields({ variant, context, contextLoading, contextError, onUpdate, readOnly, busy, onGenerate }: {
  variant: ConnectionVariant; context?: ManualEmailContext; onUpdate: (next: ConnectionVariant) => void;
  contextLoading: boolean; contextError: boolean;
  readOnly: boolean; busy: boolean; onGenerate: () => void;
}) {
  const set = (patch: Partial<ConnectionVariant>) => onUpdate({ ...variant, ...patch });
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Connection note mode">
      {(["assisted", "template"] as const).map(mode => <button key={mode} type="button" role="tab" aria-selected={variant.mode === mode} disabled={readOnly} onClick={() => set({ mode })}
        className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${variant.mode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{mode}</button>)}
    </div>
    <section><label className={labelClass}>Connection objective</label><div className="flex flex-wrap gap-2">{objectives.map(objective =>
      <button key={objective} type="button" disabled={readOnly} onClick={() => set({ objective })} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors ${variant.objective === objective ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{objective}</button>)}</div></section>
    {variant.mode === "assisted" && <>
      <section><label className={labelClass}>Personalize with research</label><div className="flex flex-wrap gap-2">{RESEARCH_SOURCES.map(source => {
        const active = variant.researchSources.includes(source.id);
        return <button key={source.id} type="button" aria-pressed={active} disabled={readOnly} onClick={() => set({ researchSources: active ? variant.researchSources.filter(id => id !== source.id) : [...variant.researchSources, source.id] })}
          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs ${active ? "border-primary/50 bg-primary/10 text-foreground dark:border-indigo-700 dark:bg-indigo-700 dark:text-white" : "border-border text-muted-foreground hover:bg-muted"}`}>{active && <Check size={12} />}{source.name}</button>;
      })}</div></section>
      <section><label className={labelClass}>Set your tone</label><TonePersonaPicker tones={["Default", "Direct", "Formal", "Casual", "Creative", "Custom"]} tone={variant.tone} voicePersonaId={variant.voicePersonaId} inheritHqTone={variant.inheritHqTone} context={context} loading={contextLoading} error={contextError} disabled={readOnly} showHqVoice={false} showGenericDescription onTone={tone => set({ tone, voicePersonaId: null, inheritHqTone: false })} onPersona={voicePersonaId => set({ tone: "Default", voicePersonaId, inheritHqTone: false })} />
        {variant.tone === "Custom" && <textarea aria-label="Custom tone instructions" className={fieldClass + " mt-2 min-h-16 resize-y"} value={variant.customTone} disabled={readOnly} onChange={e => set({ customTone: e.target.value })} placeholder="Describe the tone to use" />}
      </section>
    </>}
    {variant.mode === "prompt" && <section className="space-y-3"><div><label className={labelClass}>Instructions for this connection</label><textarea aria-label="Generation instructions" className={fieldClass + " min-h-32 resize-y"} value={variant.prompt} disabled={readOnly} onChange={e => set({ prompt: e.target.value })} placeholder="What makes this connection relevant, and how should the note sound?" /><p className="mt-1 text-xs text-muted-foreground">Selected research and workspace context are included.</p></div><div><label className={labelClass}>Set your tone</label><TonePersonaPicker tones={["Default", "Direct", "Formal", "Casual", "Creative", "Custom"]} tone={variant.tone} voicePersonaId={variant.voicePersonaId} inheritHqTone={variant.inheritHqTone} context={context} loading={contextLoading} error={contextError} disabled={readOnly} showHqVoice={false} showGenericDescription onTone={tone => set({ tone, voicePersonaId: null, inheritHqTone: false })} onPersona={voicePersonaId => set({ tone: "Default", voicePersonaId, inheritHqTone: false })} />{variant.tone === "Custom" && <textarea aria-label="Custom tone instructions" className={fieldClass + " mt-2 min-h-16 resize-y"} value={variant.customTone} disabled={readOnly} onChange={e => set({ customTone: e.target.value })} placeholder="Describe the tone to use" />}</div></section>}
    {variant.mode === "template" && <section><label className={labelClass}>Connection-note template</label><textarea aria-label="Connection note template" className={fieldClass + " min-h-32 resize-y"} value={variant.templateBody} disabled={readOnly} onChange={e => set({ templateBody: e.target.value })} placeholder={"Hi {{firstName}}, I noticed…"} /><p className="mt-1 text-xs text-muted-foreground">{variant.templateBody.length} raw template characters. Merge tokens may expand in a real contact preview; the final personalized note must fit 200 characters.</p><p className="mt-1 text-xs text-muted-foreground">Available fields: {"{{firstName}}, {{lastName}}, {{fullName}}, {{company}}, {{jobTitle}}"}.</p></section>}
    <AdditionalMessageContext value={variant.userContext} disabled={readOnly || busy} template={variant.mode === "template"}
      onChange={userContext => set({ userContext, preview: undefined })} />
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <label className="flex items-center gap-2 text-xs font-medium">Generation length<select aria-label="Generation length" className="rounded-md border border-input bg-background px-2 py-1.5" value={variant.generationMode} disabled={readOnly} onChange={e => set({ generationMode: e.target.value })}>{["Standard", "Concise", "Detailed", "Experimental"].map(item => <option key={item}>{item}</option>)}</select></label>
      <button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground dark:bg-indigo-700 dark:border-indigo-700 dark:text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={readOnly || busy || (variant.mode !== "template" && !context?.aiAvailable)} onClick={onGenerate}>{busy && <ThinkingIndicator decorative className="h-3.5 w-5" />}{busy ? "Generating…" : variant.preview ? "Generate new preview" : "Generate preview"}</button>
      {variant.mode !== "template" && !context?.aiAvailable && <span className="w-full text-xs text-muted-foreground">AI preview generation is unavailable for this workspace.</span>}
    </div>
  </div>;
}