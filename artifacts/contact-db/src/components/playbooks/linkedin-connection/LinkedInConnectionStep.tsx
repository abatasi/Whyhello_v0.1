import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  AlertCircle, ArrowDown, ArrowUp, Check, Clock3, ExternalLink, GripVertical,
  MoreHorizontal, Plus, RefreshCw, Sparkles, Trash2, UserRound,
} from "lucide-react";
import {
  CONNECTION_NOTE_LIMIT, createConnectionVariant, createLinkedInConnectionConfiguration,
  readLinkedInConnectionConfiguration, validateLinkedInConnectionConfiguration,
  type ConnectionPreview, type ConnectionVariant, type LinkedInConnectionConfiguration,
} from "../linkedin-connection-model";
import { generateLinkedInConnectionPreview } from "../linkedin-connection-api";
import { getManualEmailContext } from "../manual-email-api";
import { playbookContextQueryKey } from "@/lib/hq-voice-query-model";
import { timingSummary, type EmailTiming, type ManualEmailContext, type TimingUnit } from "../manual-email-model";
import { ConnectionFields, fieldClass, labelClass, smallButton } from "./LinkedInConnectionFields";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";

function TimingEditor({ label, timing, onChange, readOnly }: {
  label: string; timing: EmailTiming; onChange: (next: EmailTiming) => void; readOnly: boolean;
}) {
  const update = (patch: Partial<EmailTiming>) => onChange({ ...timing, ...patch });
  return <div className="rounded-md border border-border/70 p-3">
    <label className={labelClass}>{label}</label>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={`${label} timing`} className={fieldClass + " min-w-36 flex-1"} value={timing.unit} disabled={readOnly} onChange={e => update({ unit: e.target.value as TimingUnit })}>
        <option value="immediately">Immediately</option><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option><option value="business-days">Business days</option><option value="specific">Specific date &amp; time</option>
      </select>
      {timing.unit !== "immediately" && (timing.unit === "specific"
        ? <input aria-label={`${label} date and time`} className={fieldClass + " min-w-44 flex-1"} type="datetime-local" value={timing.at && !Number.isNaN(Date.parse(timing.at)) ? new Date(new Date(timing.at).getTime() - new Date(timing.at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} disabled={readOnly} onChange={e => update({ at: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
        : <input aria-label={`${label} interval`} className={fieldClass + " w-20"} type="number" min={1} value={timing.amount} disabled={readOnly} onChange={e => update({ amount: Number(e.target.value) })} />)}
      <span className="text-xs text-muted-foreground">{timingSummary(timing)}</span>
    </div>
  </div>;
}

function PreviewPanel({ playbookId, variant, contacts, selectedContactId, onContactChange, context, onPreviewChange, onGenerationState, readOnly }: {
  playbookId: number; variant: ConnectionVariant; contacts: ManualEmailContext["contacts"]; selectedContactId: number | null;
  onContactChange: (id: number | null) => void; context?: ManualEmailContext;
  onPreviewChange: (variantId: string, preview: ConnectionPreview) => void; onGenerationState: (id: string | null) => void; readOnly: boolean;
}) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "enrolled" | "sample">("all");
  const [showEvidence, setShowEvidence] = useState(false);
  const [regeneration, setRegeneration] = useState("");
  const [notice, setNotice] = useState("");
  const [copyError, setCopyError] = useState("");
  const [dirtyPreview, setDirtyPreview] = useState(false);
  const generationStateRef = useRef(onGenerationState);
  generationStateRef.current = onGenerationState;
  const filtered = useMemo(() => contacts.filter(contact =>
    (scope === "all" || (scope === "enrolled" ? contact.enrolled : !contact.enrolled)) &&
    `${contact.name} ${contact.company}`.toLowerCase().includes(search.toLowerCase())), [contacts, scope, search]);
  const mutation = useMutation({
    mutationFn: (request: { variantId: string; variant: ConnectionVariant; contactId: number; reason: string }) =>
      generateLinkedInConnectionPreview(playbookId, request.variant, request.contactId, request.reason),
    onSuccess: (response, request) => {
      onPreviewChange(request.variantId, { ...response, contactId: request.contactId });
      setDirtyPreview(false);
      setNotice("Preview generated. Review the note before using it.");
    },
    onMutate: request => generationStateRef.current(request.variantId),
    onSettled: () => generationStateRef.current(null),
  });
  const currentContact = contacts.find(contact => contact.id === selectedContactId);
  const preview = variant.preview;
  const previewContact = contacts.find(contact => contact.id === preview?.contactId);
  const doGenerate = (reason = "") => {
    if (!selectedContactId || (variant.mode !== "template" && !context?.aiAvailable) || readOnly || mutation.isPending) return;
    if (preview && !window.confirm("Replace this connection-note preview? Your template and other configuration will stay unchanged.")) return;
    setNotice(""); setCopyError(""); mutation.reset();
    mutation.mutate({ variantId: variant.id, variant: { ...variant }, contactId: selectedContactId, reason });
  };
  const generateRef = useRef(doGenerate);
  generateRef.current = doGenerate;
  useEffect(() => {
    const eventName = `linkedin-connection-generate-${variant.id}`;
    const handler = (event: Event) => generateRef.current((event as CustomEvent<{ reason?: string }>).detail?.reason ?? "");
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [variant.id]);
  const pending = mutation.isPending && mutation.variables?.variantId === variant.id;
  const templateStale = variant.mode === "template" && preview?.templateBody !== variant.templateBody;
  useEffect(() => { setNotice(""); setCopyError(""); setDirtyPreview(false); }, [variant.id]);
  const editPreview = (next: ConnectionPreview) => { setDirtyPreview(true); setNotice(""); setCopyError(""); onPreviewChange(variant.id, next); };
  const copyNote = async () => {
    if (!preview || preview.body.length > CONNECTION_NOTE_LIMIT || !preview.body.trim() || templateStale || pending) return;
    try {
      await navigator.clipboard.writeText(preview.body);
      setCopyError(""); setNotice("Connection note copied.");
    } catch {
      setCopyError("Couldn’t copy automatically here. Select the note above and copy it manually.");
    }
  };
  const err = mutation.error instanceof Error ? mutation.error.message : "Couldn't generate the connection preview. Try again.";
  const tooLong = (preview?.body.length ?? 0) > CONNECTION_NOTE_LIMIT;
  return <section className="flex min-w-0 flex-col">
    <div className="border-b border-border/70 pb-3"><h3 className="text-sm font-semibold">Connection preview</h3><p className="mt-0.5 text-xs text-muted-foreground">A seller-reviewed invite note. This step never sends a LinkedIn request.</p></div>
    <div className="space-y-2 py-3"><label className={labelClass}>Generate preview for a real contact</label><div className="flex flex-wrap gap-2">
      <input aria-label="Search contacts" className={fieldClass + " min-w-40 flex-1"} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts or company" />
      <select aria-label="Contact list filter" className={fieldClass + " w-auto"} value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="all">All contacts</option><option value="enrolled">Enrolled</option><option value="sample">Directory samples</option></select>
    </div>
      <select aria-label="Preview contact" className={fieldClass} value={selectedContactId ?? ""} onChange={e => onContactChange(e.target.value ? Number(e.target.value) : null)} disabled={readOnly || pending}>
        <option value="">Choose a contact</option>{filtered.map(contact => <option key={contact.id} value={contact.id}>{contact.name} · {contact.company}{contact.enrolled ? " · Enrolled" : " · Directory sample"}</option>)}
      </select>
      {currentContact && <p className="text-xs text-muted-foreground">{currentContact.enrolled ? "Enrolled in this Playbook" : "Directory sample — not enrolled"} · {currentContact.company}</p>}
      {!contacts.length && <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No real contacts are available yet. Add a contact to preview a personalized connection note.</p>}
    </div>
    <div className="min-h-[290px] flex-1 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
      {preview ? <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound size={18} /></span><div className="min-w-0"><p className="text-sm font-semibold">{previewContact ? previewContact.name : "Saved preview contact"}</p><p className="truncate text-xs text-muted-foreground">{previewContact ? previewContact.company : "Contact details unavailable"}</p></div></div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{previewContact ? previewContact.enrolled ? "Enrolled contact" : "Directory contact" : "Saved contact"}</span>
        </div>
        {!previewContact && <p role="status" className="text-xs text-muted-foreground">This preview remains linked to contact #{preview.contactId}; contact details aren’t currently available.</p>}
        {preview.contactId !== selectedContactId && <p role="status" className="text-xs text-muted-foreground">Saved preview for {previewContact?.name ?? "another contact"}. Generate again to preview the selected contact.</p>}
        <div className="rounded-lg border border-border/80 bg-background p-3">
          <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">LinkedIn connection invite</span><span className="text-[10px] text-muted-foreground">Personalized note</span></div>
          <textarea aria-label="Editable personalized connection note" data-testid={`connection-preview-note-${variant.id}`} className={fieldClass + ` min-h-28 resize-y ${tooLong ? "border-destructive text-destructive focus:ring-destructive/30" : ""}`} value={preview.body} disabled={readOnly || pending} onChange={e => editPreview({ ...preview, body: e.target.value })} placeholder="Your personalized connection note" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className={`text-xs font-medium ${tooLong ? "text-destructive" : "text-muted-foreground"}`}>{preview.body.length} / {CONNECTION_NOTE_LIMIT} characters{tooLong ? " · shorten before copying or activation" : ""}</span>
            <button type="button" className={smallButton} disabled={pending || !preview.body.trim() || tooLong || templateStale} onClick={copyNote}>{notice === "Connection note copied." ? <Check size={13} /> : null}Copy note</button>
          </div>
          {tooLong && <p role="alert" className="mt-2 text-xs text-destructive">This personalized note exceeds LinkedIn’s 200-character limit. Text is never truncated automatically; edit it to continue.</p>}
          {templateStale && <p role="alert" className="mt-2 text-xs text-destructive">The template has changed. Your previous note is preserved, but generate a current contact preview before copying or activating.</p>}
        </div>
        {dirtyPreview && <p role="status" className="rounded-md bg-primary/5 px-2.5 py-2 text-xs text-primary">Preview edits are saved with the step configuration.</p>}
        <button type="button" className="flex w-full items-center justify-between border-t border-border pt-3 text-left text-xs font-semibold" onClick={() => setShowEvidence(!showEvidence)}>Research evidence {preview.insightsUsed.length ? `(${preview.insightsUsed.length})` : "(none listed)"}{showEvidence ? "−" : "+"}</button>
        {showEvidence && <div className="space-y-2">{preview.insightsUsed.map((insight, index) => <article key={`${insight.id}-${index}`} className="rounded-md bg-muted/60 p-2.5"><p className="text-xs font-semibold">{insight.title}</p><p className="mt-1 text-xs text-muted-foreground">{insight.category} · {insight.description}</p>{insight.url && <a href={insight.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Inspect source <ExternalLink size={11} /></a>}</article>)}</div>}
        {pending && <p role="status" className="text-xs text-muted-foreground">Preparing a new preview. Preview fields are locked until the request finishes; configuration changes remain available.</p>}
      </div> : pending ? <div className="flex min-h-[250px] flex-col items-center justify-center text-center"><ThinkingIndicator className="mb-4 h-10 w-16" label="Generating connection preview" /><p className="text-sm font-medium">Preparing a connection preview…</p><p className="mt-1 text-xs text-muted-foreground">No request is sent to LinkedIn.</p></div> : <div className="flex min-h-[250px] flex-col items-center justify-center text-center"><div className="mb-3 rounded-full bg-background p-3 text-muted-foreground"><UserRound size={20} /></div><p className="text-sm font-semibold">Your invite note will appear here</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Choose an actual contact and generate a preview. A real-contact preview is required before activation, including for templates.</p></div>}
    </div>
    {mutation.error && <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{err} <button type="button" className="cursor-pointer underline" onClick={() => mutation.reset()}>Dismiss</button></span></div>}
    {copyError && <p role="alert" className="mt-2 text-xs text-destructive">{copyError}</p>}
    {notice && <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={13} />{notice}</p>}
    {preview && <div className="mt-3 flex flex-wrap items-center gap-2"><select aria-label="Regeneration direction" className={fieldClass + " min-w-36 flex-1"} value={regeneration} disabled={readOnly || pending} onChange={e => setRegeneration(e.target.value)}><option value="">Regenerate with same direction</option>{["Shorter", "More direct", "More personalized", "Different angle", "More concise"].map(item => <option key={item}>{item}</option>)}</select><button type="button" className={smallButton} disabled={readOnly || pending || (variant.mode !== "template" && !context?.aiAvailable) || !selectedContactId} onClick={() => doGenerate(regeneration)}><RefreshCw size={13} />Regenerate</button></div>}
    <p className="mt-3 rounded-md border border-border/70 bg-muted/30 p-2.5 text-[11px] leading-5 text-muted-foreground">Configuration and previewing do not send LinkedIn requests. Any outreach happens separately, outside this step.</p>
  </section>;
}

export function LinkedInConnectionStep({ playbookId, stepId, stepNumber, config: rawConfig, selected, onSelect, onConfigure, readOnly = false, onDuplicate, onDelete, onInsertBefore, onInsertAfter, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  playbookId: number; stepId: string; stepNumber: number; config: unknown; selected: boolean;
  onSelect: () => void; onConfigure: (config: LinkedInConnectionConfiguration) => void; readOnly?: boolean;
  onDuplicate: () => void; onDelete: () => void; onInsertBefore: () => void; onInsertAfter: () => void;
  onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean;
}) {
  const { user } = useUser();
  const contextQuery = useQuery({ queryKey: playbookContextQueryKey(playbookId, user?.id), queryFn: () => getManualEmailContext(playbookId), enabled: !!user?.id, staleTime: 0, refetchOnMount: "always" });
  const config = useMemo(() => readLinkedInConnectionConfiguration(rawConfig ?? createLinkedInConnectionConfiguration()), [rawConfig]);
  const currentConfigRef = useRef(config);
  currentConfigRef.current = config;
  const [activeVariantId, setActiveVariantId] = useState(config.variants[0]?.id ?? "");
  const [contactId, setContactId] = useState<number | null>(() => config.variants[0]?.preview?.contactId ?? null);
  const [timingOpen, setTimingOpen] = useState(false);
  const [generatingVariantId, setGeneratingVariantId] = useState<string | null>(null);
  const variant = config.variants.find(item => item.id === activeVariantId) ?? config.variants[0];
  const context = contextQuery.data;
  const contacts = context?.contacts ?? [];
  const validationError = validateLinkedInConnectionConfiguration(config);
  const update = (next: LinkedInConnectionConfiguration) => { currentConfigRef.current = next; onConfigure(next); };
  const updateVariant = (next: ConnectionVariant) => {
    const latest = currentConfigRef.current;
    update({ ...latest, variants: latest.variants.map(item => item.id === next.id ? next : item) });
  };
  const updatePreview = (variantId: string, preview: ConnectionPreview) => {
    const latest = currentConfigRef.current;
    if (!latest.variants.some(item => item.id === variantId)) return;
    update({ ...latest, variants: latest.variants.map(item => item.id === variantId ? { ...item, preview } : item) });
  };
  useEffect(() => {
    const saved = currentConfigRef.current.variants.find(item => item.id === activeVariantId)?.preview;
    if (saved) setContactId(saved.contactId);
  }, [activeVariantId]);
  const chosenId = contactId !== null && contacts.some(contact => contact.id === contactId) ? contactId : contacts.find(contact => contact.enrolled)?.id ?? contacts[0]?.id ?? null;
  const addVariant = () => {
    if (config.variants.length >= 6 || readOnly) return;
    const next = createConnectionVariant(`Test ${String.fromCharCode(65 + config.variants.length)}`, context);
    const each = Math.floor(100 / (config.variants.length + 1));
    const variants = config.variants.map((item, index) => ({ ...item, allocation: index === config.variants.length - 1 ? 100 - each * config.variants.length : each }));
    next.allocation = each; update({ ...config, variants: [...variants, next] }); setActiveVariantId(next.id);
  };
  const removeVariant = (id: string) => {
    if (config.variants.length <= 1 || readOnly) return;
    const remaining = config.variants.filter(item => item.id !== id); const each = Math.floor(100 / remaining.length);
    update({ ...config, variants: remaining.map((item, index) => ({ ...item, allocation: index === remaining.length - 1 ? 100 - each * index : each })) });
    if (activeVariantId === id) setActiveVariantId(remaining[0].id);
  };
  const updateTiming = (key: "createTiming" | "dueTiming", next: EmailTiming) => update({ ...config, [key]: next });
  const status = !config.enabled ? "Disabled" : contextQuery.isError || (variant?.mode !== "template" && context && !context.aiAvailable) ? "Error" : !contacts.length ? "Warning" : validationError ? "Incomplete" : "Complete";
  const statusStyle = status === "Complete" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : status === "Error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  const contextError = contextQuery.error instanceof Error ? contextQuery.error.message : "Couldn't load LinkedIn connection context.";
  const total = config.variants.reduce((sum, item) => sum + item.allocation, 0);
  return <article id={`configured-step-${stepId}`} data-testid={`configured-step-${stepId}`} className={`overflow-hidden rounded-xl border bg-card transition-shadow ${selected ? "border-primary/50 shadow-sm" : "border-border"} ${!config.enabled ? "opacity-75" : ""}`}>
    <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
      <button type="button" aria-label={`Step ${stepNumber} ${config.enabled ? "enabled" : "disabled"}`} role="switch" aria-checked={config.enabled} disabled={readOnly} onClick={e => { e.stopPropagation(); update({ ...config, enabled: !config.enabled }); }} className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed ${config.enabled ? "bg-primary" : "bg-muted-foreground/40"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform ${config.enabled ? "translate-x-4" : "translate-x-0.5"}`} /></button>
      <button type="button" draggable={!readOnly} aria-label={`Drag to reorder step ${stepNumber}`} onClick={e => e.stopPropagation()} onDragStart={e => { e.dataTransfer.setData("text/plain", stepId); e.dataTransfer.effectAllowed = "move"; }} className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg bg-muted text-muted-foreground active:cursor-grabbing"><GripVertical size={15} /></button>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><UserRound size={16} /></span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-semibold text-muted-foreground">Step {stepNumber}</span><button type="button" aria-expanded={selected} className="cursor-pointer text-sm font-semibold" onClick={onSelect}>LinkedIn Connection</button><span className="text-muted-foreground">/</span>
        <input aria-label="Variant name" className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold hover:border-border focus:border-input focus:bg-background" value={variant?.name ?? "Test A"} disabled={readOnly || !variant} onClick={e => e.stopPropagation()} onChange={e => variant && updateVariant({ ...variant, name: e.target.value })} />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{variant?.objective ?? "Connect"}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}>{status}</span>
      </div><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={12} />Create {timingSummary(config.createTiming)} · due {timingSummary(config.dueTiming)}</p></div>
      <button type="button" className={smallButton} disabled={readOnly} onClick={e => { e.stopPropagation(); setTimingOpen(!timingOpen); }}><Clock3 size={13} />Timing</button>
      <details className="relative" onClick={e => e.stopPropagation()}><summary aria-label="Step actions" className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-muted"><MoreHorizontal size={17} /></summary>
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-lg">
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={onInsertBefore}><Plus size={13} />Insert before</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={onInsertAfter}><Plus size={13} />Insert after</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly || !canMoveUp} onClick={onMoveUp}><ArrowUp size={13} />Move up</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly || !canMoveDown} onClick={onMoveDown}><ArrowDown size={13} />Move down</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={onDuplicate}>Duplicate step</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={() => update({ ...config, enabled: !config.enabled })}>{config.enabled ? "Disable" : "Enable"} step</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-muted" disabled={readOnly} onClick={onDelete}><Trash2 size={13} />Delete step</button>
        </div>
      </details>
    </header>
    {selected && <div className="px-4 py-4 sm:px-5">
      {timingOpen && <div className="mb-5 grid gap-3 md:grid-cols-2"><TimingEditor label="Create task" timing={config.createTiming} onChange={next => updateTiming("createTiming", next)} readOnly={readOnly} /><TimingEditor label="Task due" timing={config.dueTiming} onChange={next => updateTiming("dueTiming", next)} readOnly={readOnly} /></div>}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{config.variants.map(item => <button key={item.id} type="button" aria-pressed={item.id === variant?.id} onClick={() => setActiveVariantId(item.id)} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${item.id === variant?.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{item.name || "Unnamed"} <span className="ml-1 opacity-70">{item.allocation}%</span></button>)}</div>
        <button type="button" className={smallButton} disabled={readOnly || config.variants.length >= 6} onClick={addVariant}><Plus size={13} />Add variant</button>
        {variant && config.variants.length > 1 && <button type="button" aria-label="Delete active variant" className={smallButton} disabled={readOnly} onClick={() => removeVariant(variant.id)}><Trash2 size={13} /></button>}
      </div>
      {config.variants.length > 1 && <div className="mb-4 flex flex-wrap items-center gap-2">{config.variants.map(item => <label key={item.id} className="flex items-center gap-1 text-xs text-muted-foreground">{item.name}<input aria-label={`${item.name} traffic allocation`} className="w-16 rounded-md border border-input bg-background px-2 py-1 text-foreground" type="number" min={0} max={100} value={item.allocation} disabled={readOnly} onChange={e => updateVariant({ ...item, allocation: Number(e.target.value) })} />%</label>)}<span className={`ml-auto text-xs ${total === 100 ? "text-muted-foreground" : "text-destructive"}`}>Total {total}%</span></div>}
      {contextQuery.isLoading && <div className="mb-4 animate-pulse rounded-md bg-muted p-4 text-xs text-muted-foreground">Loading contacts and HQ context…</div>}
      {contextQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-md border border-destructive/30 p-3 text-xs text-destructive"><span>{contextError}</span><button type="button" className={smallButton} onClick={() => contextQuery.refetch()}>Retry</button></div>}
      {validationError && config.enabled && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle size={14} />{validationError}</p>}
      {variant && <div className="grid min-w-0 gap-6 xl:grid-cols-2"><div className="min-w-0"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Configuration</h3><span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"><Sparkles size={12} />Seller reviewed</span></div><ConnectionFields variant={variant} context={context} contextLoading={contextQuery.isLoading} contextError={contextQuery.isError} onUpdate={updateVariant} onGenerate={() => { if (variant.mode === "template" || context?.aiAvailable) window.dispatchEvent(new CustomEvent(`linkedin-connection-generate-${variant.id}`)); }} busy={generatingVariantId !== null} readOnly={readOnly} /></div>
        <PreviewPanel key={variant.id} playbookId={playbookId} variant={variant} contacts={contacts} selectedContactId={chosenId} onContactChange={setContactId} context={context} onPreviewChange={updatePreview} onGenerationState={setGeneratingVariantId} readOnly={readOnly} /></div>}
    </div>}
    {!selected && <button type="button" className="w-full cursor-pointer px-5 py-3 text-left text-xs text-muted-foreground hover:bg-muted/40" onClick={onSelect}>Expand to edit {variant?.name ?? "connection"} configuration</button>}
  </article>;
}