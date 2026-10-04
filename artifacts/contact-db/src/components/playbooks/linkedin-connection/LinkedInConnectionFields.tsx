import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import type { ConnectionVariant } from "../linkedin-connection-model";
import { RESEARCH_SOURCES, type ManualEmailContext } from "../manual-email-model";

export const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30";
export const smallButton = "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
export const labelClass = "mb-1.5 block text-xs font-semibold text-foreground";
const objectives = ["Connect", "Reconnect"] as const;

export function ConnectionFields({ variant, context, onUpdate, readOnly, busy, onGenerate }: {
  variant: ConnectionVariant; context?: ManualEmailContext; onUpdate: (next: ConnectionVariant) => void;
  readOnly: boolean; busy: boolean; onGenerate: () => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const set = (patch: Partial<ConnectionVariant>) => onUpdate({ ...variant, ...patch });
  const addGuideline = () => set({ guidelines: [...variant.guidelines, { id: crypto.randomUUID(), text: "" }] });
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Connection note mode">
      {(["assisted", "prompt", "template"] as const).map(mode => <button key={mode} type="button" role="tab" aria-selected={variant.mode === mode} disabled={readOnly} onClick={() => set({ mode })}
        className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${variant.mode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{mode}</button>)}
    </div>
    <section><label className={labelClass}>Connection objective</label><div className="flex flex-wrap gap-2">{objectives.map(objective =>
      <button key={objective} type="button" disabled={readOnly} onClick={() => set({ objective })} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors ${variant.objective === objective ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{objective}</button>)}</div></section>
    {variant.mode === "assisted" && <>
      <section><label className={labelClass}>Personalize with research</label><div className="flex flex-wrap gap-2">{RESEARCH_SOURCES.map(source => {
        const active = variant.researchSources.includes(source.id);
        return <button key={source.id} type="button" aria-pressed={active} disabled={readOnly} onClick={() => set({ researchSources: active ? variant.researchSources.filter(id => id !== source.id) : [...variant.researchSources, source.id] })}
          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs ${active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>{active && <Check size={12} />}{source.name}</button>;
      })}</div></section>
      <section><label className={labelClass}>Set your tone</label><div className="flex flex-wrap gap-2">{["Default", "Direct", "Formal", "Casual", "Creative", "Custom"].map(tone =>
        <button key={tone} type="button" disabled={readOnly} onClick={() => set({ tone })} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${variant.tone === tone ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{tone}</button>)}</div>
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={variant.inheritHqTone} disabled={readOnly || !context?.voice} onChange={e => set({ inheritHqTone: e.target.checked })} />Inherit Whyhello HQ voice{!context?.voice && <span>(not available)</span>}</label>
        {variant.tone === "Custom" && <textarea aria-label="Custom tone instructions" className={fieldClass + " mt-2 min-h-16 resize-y"} value={variant.customTone} disabled={readOnly} onChange={e => set({ customTone: e.target.value })} placeholder="Describe the tone to use" />}
        {variant.inheritHqTone && context?.voice && <p className="mt-2 rounded-md bg-muted/70 p-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">HQ voice:</span> {context.voice}</p>}
      </section>
    </>}
    {variant.mode === "prompt" && <section><label className={labelClass}>Instructions for this connection</label><textarea aria-label="Generation instructions" className={fieldClass + " min-h-32 resize-y"} value={variant.prompt} disabled={readOnly} onChange={e => set({ prompt: e.target.value })} placeholder="What makes this connection relevant, and how should the note sound?" /><p className="mt-1 text-xs text-muted-foreground">Selected research and workspace context are included.</p></section>}
    {variant.mode === "template" && <section><label className={labelClass}>Connection-note template</label><textarea aria-label="Connection note template" className={fieldClass + " min-h-32 resize-y"} value={variant.templateBody} disabled={readOnly} onChange={e => set({ templateBody: e.target.value })} placeholder={"Hi {{firstName}}, I noticed…"} /><p className="mt-1 text-xs text-muted-foreground">{variant.templateBody.length} raw template characters. Merge tokens may expand in a real contact preview; the final personalized note must fit 200 characters.</p><p className="mt-1 text-xs text-muted-foreground">Available fields: {"{{firstName}}, {{lastName}}, {{fullName}}, {{company}}, {{jobTitle}}"}.</p></section>}
    <details className="rounded-md border border-border/70" open={sourcesOpen} onToggle={e => setSourcesOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold">HQ context <span className="ml-1 font-normal text-muted-foreground">Inspect available sources</span></summary>
      <div className="space-y-2 border-t border-border/70 p-3">{(context?.contextSources ?? []).map(source => {
        const active = variant.contextSources.includes(source.id);
        return <div key={source.id} className="rounded-md border border-border/70 p-2.5"><label className="flex cursor-pointer items-start gap-2 text-xs font-medium"><input type="checkbox" checked={active} disabled={readOnly} onChange={e => set({ contextSources: e.target.checked ? [...variant.contextSources, source.id] : variant.contextSources.filter(id => id !== source.id) })} />{source.name}</label>{active && <p className="ml-5 mt-1.5 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{source.content || "No source content is available."}</p>}</div>;
      })}
        {!context?.contextSources.length && <p className="text-xs text-muted-foreground">HQ context is currently unavailable.</p>}
        {context?.voice && <div className="rounded-md border border-border/70 p-2.5"><p className="text-xs font-semibold">Whyhello HQ voice</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{context.voice}</p></div>}
        <label className="block text-xs font-medium">Additional context<textarea aria-label="Additional AI context" className={fieldClass + " mt-1.5 min-h-16 resize-y"} value={variant.userContext} disabled={readOnly} onChange={e => set({ userContext: e.target.value, contextSources: e.target.value.trim() ? [...new Set([...variant.contextSources, "custom"])] : variant.contextSources.filter(id => id !== "custom") })} placeholder="Add information specific to this playbook step" /></label>
      </div>
    </details>
    <section><div className="mb-2 flex items-center justify-between"><label className={labelClass + " mb-0"}>Guidelines</label><button type="button" className={smallButton} disabled={readOnly || variant.guidelines.length >= 30} onClick={addGuideline}><Plus size={13} />Add guideline</button></div>
      {variant.guidelines.map((guideline, index) => <div className="mb-2 flex items-center gap-1.5" key={guideline.id}>
        <textarea aria-label={`Guideline ${index + 1}`} className={fieldClass + " min-h-9 resize-y py-2"} value={guideline.text} disabled={readOnly} onChange={e => set({ guidelines: variant.guidelines.map(item => item.id === guideline.id ? { ...item, text: e.target.value } : item) })} placeholder="Write a generation constraint" />
        <button type="button" aria-label={`Move guideline ${index + 1} up`} className={smallButton} disabled={readOnly || index === 0} onClick={() => { const items = [...variant.guidelines]; [items[index - 1], items[index]] = [items[index], items[index - 1]]; set({ guidelines: items }); }}><ArrowUp size={13} /></button>
        <button type="button" aria-label={`Move guideline ${index + 1} down`} className={smallButton} disabled={readOnly || index === variant.guidelines.length - 1} onClick={() => { const items = [...variant.guidelines]; [items[index + 1], items[index]] = [items[index], items[index + 1]]; set({ guidelines: items }); }}><ArrowDown size={13} /></button>
        <button type="button" aria-label={`Delete guideline ${index + 1}`} className={smallButton} disabled={readOnly} onClick={() => set({ guidelines: variant.guidelines.filter(item => item.id !== guideline.id) })}><Trash2 size={13} /></button>
      </div>)}
      {!variant.guidelines.length && <p className="text-xs text-muted-foreground">No extra constraints. Add a guideline to keep the note on brief.</p>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <label className="flex items-center gap-2 text-xs font-medium">Generation length<select aria-label="Generation length" className="rounded-md border border-input bg-background px-2 py-1.5" value={variant.generationMode} disabled={readOnly} onChange={e => set({ generationMode: e.target.value })}>{["Standard", "Concise", "Detailed", "Experimental"].map(item => <option key={item}>{item}</option>)}</select></label>
      <button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={readOnly || busy || (variant.mode !== "template" && !context?.aiAvailable)} onClick={onGenerate}>{busy ? "Generating…" : variant.preview ? "Generate new preview" : "Generate preview"}</button>
      {variant.mode !== "template" && !context?.aiAvailable && <span className="w-full text-xs text-muted-foreground">AI preview generation is unavailable for this workspace.</span>}
    </div>
  </div>;
}