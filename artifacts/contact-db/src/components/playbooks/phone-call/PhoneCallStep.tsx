import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  AlertCircle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight,
  Clock3, ExternalLink, GripVertical, MoreHorizontal, Phone, Plus,
  RefreshCw, Sparkles, Trash2, X,
} from "lucide-react";
import {
  createCallVariant, createPhoneCallConfiguration, readPhoneCallConfiguration, validatePhoneCallConfiguration,
  type CallPreview, type CallScript, type CallVariant, type PhoneCallConfiguration,
} from "../phone-call-model";
import { generatePhoneCallPreview } from "../phone-call-api";
import { CallAudioPreview } from "./CallAudioPreview";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { getManualEmailContext } from "../manual-email-api";
import { playbookContextQueryKey } from "@/lib/hq-voice-query-model";
import { RESEARCH_SOURCES, timingSummary, type EmailTiming, type ManualEmailContext, type TimingUnit } from "../manual-email-model";
import { TonePersonaPicker } from "../TonePersonaPicker";
import { usePlaybookConfirm } from "../PlaybookConfirmProvider";
import { AdditionalMessageContext } from "../AdditionalMessageContext";

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30";
const smallButton = "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "mb-1.5 block text-xs font-semibold text-foreground";
const objectives = ["First conversation", "Follow-up", "Reconnect"] as const;

function TimingEditor({ label, timing, onChange, readOnly }: {
  label: string; timing: EmailTiming; onChange: (next: EmailTiming) => void; readOnly: boolean;
}) {
  const update = (patch: Partial<EmailTiming>) => onChange({ ...timing, ...patch });
  return <div className="rounded-md border border-border/70 p-3">
    <label className={labelClass}>{label}</label>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={`${label} timing`} className={fieldClass + " min-w-36 flex-1"} value={timing.unit} disabled={readOnly} onChange={e => update({ unit: e.target.value as TimingUnit })}>
        <option value="immediately">Immediately</option><option value="minutes">Minutes</option><option value="hours">Hours</option>
        <option value="days">Days</option><option value="business-days">Business days</option><option value="specific">Specific date &amp; time</option>
      </select>
      {timing.unit !== "immediately" && (timing.unit === "specific"
        ? <input aria-label={`${label} date and time`} className={fieldClass + " min-w-44 flex-1"} type="datetime-local"
          value={timing.at && !Number.isNaN(Date.parse(timing.at)) ? new Date(new Date(timing.at).getTime() - new Date(timing.at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
          disabled={readOnly} onChange={e => update({ at: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
        : <input aria-label={`${label} interval`} className={fieldClass + " w-20"} type="number" min={1} value={timing.amount} disabled={readOnly} onChange={e => update({ amount: Number(e.target.value) })} />)}
      <span className="text-xs text-muted-foreground">{timingSummary(timing)}</span>
    </div>
  </div>;
}

function ScriptFields({ title, script, onChange, readOnly, prefix }: {
  title: string; script: CallScript; onChange: (next: CallScript) => void; readOnly: boolean; prefix: string;
}) {
  const update = (patch: Partial<CallScript>) => onChange({ ...script, ...patch });
  return <section className="space-y-3">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
    <label className="block"><span className={labelClass}>Opener</span><textarea aria-label={`${prefix} opener`} className={fieldClass + " min-h-20 resize-y"} value={script.opener} disabled={readOnly} onChange={e => update({ opener: e.target.value })} placeholder="A concise, human opening for the conversation" /></label>
    <label className="block"><span className={labelClass}>Talking points <span className="font-normal text-muted-foreground">· one per line</span></span><textarea aria-label={`${prefix} talking points`} className={fieldClass + " min-h-24 resize-y"} value={script.talkingPoints.join("\n")} disabled={readOnly} onChange={e => update({ talkingPoints: e.target.value.split("\n") })} placeholder={"Why this conversation matters\nA relevant business outcome"} /></label>
    <label className="block"><span className={labelClass}>Questions <span className="font-normal text-muted-foreground">· one per line</span></span><textarea aria-label={`${prefix} questions`} className={fieldClass + " min-h-20 resize-y"} value={script.questions.join("\n")} disabled={readOnly} onChange={e => update({ questions: e.target.value.split("\n") })} placeholder={"How are you handling this today?\nWhat would a better outcome look like?"} /></label>
    <div>
      <div className="mb-2 flex items-center justify-between"><span className={labelClass + " mb-0"}>Objections &amp; responses</span><button type="button" className={smallButton} disabled={readOnly} onClick={() => update({ objections: [...script.objections, { objection: "", response: "" }] })}><Plus size={13} />Add objection</button></div>
      <div className="space-y-2">{script.objections.map((item, index) => <div key={index} className="grid gap-2 rounded-md border border-border/70 p-2 sm:grid-cols-[1fr_1fr_auto]">
        <input aria-label={`${prefix} objection ${index + 1}`} className={fieldClass} value={item.objection} disabled={readOnly} onChange={e => update({ objections: script.objections.map((ob, i) => i === index ? { ...ob, objection: e.target.value } : ob) })} placeholder="Likely objection" />
        <input aria-label={`${prefix} response ${index + 1}`} className={fieldClass} value={item.response} disabled={readOnly} onChange={e => update({ objections: script.objections.map((ob, i) => i === index ? { ...ob, response: e.target.value } : ob) })} placeholder="Thoughtful response" />
        <button type="button" aria-label={`Remove ${prefix.toLowerCase()} objection ${index + 1}`} className={smallButton} disabled={readOnly} onClick={() => update({ objections: script.objections.filter((_, i) => i !== index) })}><Trash2 size={13} /></button>
      </div>)}</div>
      {!script.objections.length && <p className="text-xs text-muted-foreground">No objection responses added.</p>}
    </div>
    <label className="block"><span className={labelClass}>Voicemail</span><textarea aria-label={`${prefix} voicemail`} className={fieldClass + " min-h-20 resize-y"} value={script.voicemail} disabled={readOnly} onChange={e => update({ voicemail: e.target.value })} placeholder="Optional message if they don't pick up" /></label>
    <label className="block"><span className={labelClass}>Closing</span><textarea aria-label={`${prefix} closing`} className={fieldClass + " min-h-20 resize-y"} value={script.closing} disabled={readOnly} onChange={e => update({ closing: e.target.value })} placeholder="A clear, low-pressure next step" /></label>
  </section>;
}

function VariantFields({ variant, context, contextLoading, contextError, onUpdate, onGenerate, busy, readOnly }: {
  variant: CallVariant; context?: ManualEmailContext; onUpdate: (next: CallVariant) => void;
  contextLoading: boolean; contextError: boolean;
  onGenerate: () => void; busy: boolean; readOnly: boolean;
}) {
  const set = (patch: Partial<CallVariant>) => onUpdate({ ...variant, ...patch });
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Call generation mode">
      {(["assisted", "template"] as const).map(mode => <button key={mode} type="button" role="tab" aria-selected={variant.mode === mode} disabled={readOnly}
        onClick={() => set({ mode })} className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${variant.mode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{mode}</button>)}
    </div>
    <section><label className={labelClass}>Call objective</label><div className="flex flex-wrap gap-2">{objectives.map(objective =>
      <button key={objective} type="button" disabled={readOnly} onClick={() => set({ objective })} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors ${variant.objective === objective ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{objective}</button>)}</div></section>
    {variant.mode === "assisted" && <>
      <section><label className={labelClass}>Personalize with AI research</label><div className="flex flex-wrap gap-2">{RESEARCH_SOURCES.map(source => {
        const active = variant.researchSources.includes(source.id);
        return <button key={source.id} type="button" aria-pressed={active} disabled={readOnly} onClick={() => set({ researchSources: active ? variant.researchSources.filter(id => id !== source.id) : [...variant.researchSources, source.id] })}
          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-colors ${active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>{active && <Check size={12} />}{source.name}</button>;
      })}</div></section>
      <section><label className={labelClass}>Set your tone</label><TonePersonaPicker tones={["Default", "Direct", "Formal", "Casual", "Creative", "Custom"]} tone={variant.tone} voicePersonaId={variant.voicePersonaId}
        inheritHqTone={variant.inheritHqTone} context={context} loading={contextLoading} error={contextError} disabled={readOnly}
        showHqVoice={false} showGenericDescription
        onTone={tone => set({ tone, voicePersonaId: null, inheritHqTone: false })}
        onPersona={voicePersonaId => set({ tone: "Default", voicePersonaId, inheritHqTone: false })} />
        {variant.tone === "Custom" && <textarea aria-label="Custom tone instructions" className={fieldClass + " mt-2 min-h-16 resize-y"} value={variant.customTone} disabled={readOnly} onChange={e => set({ customTone: e.target.value })} placeholder="Describe the tone to use" />}
      </section>
    </>}
    {variant.mode === "prompt" && <section className="space-y-3"><div><label className={labelClass}>Instructions for this call</label><textarea aria-label="Generation instructions" className={fieldClass + " min-h-36 resize-y"} value={variant.prompt} disabled={readOnly} onChange={e => set({ prompt: e.target.value })} placeholder="What should this conversation accomplish, and how should it feel?" /><p className="mt-1 text-xs text-muted-foreground">Selected research and workspace context are also included.</p></div><div><label className={labelClass}>Set your tone</label><TonePersonaPicker tones={["Default", "Direct", "Formal", "Casual", "Creative", "Custom"]} tone={variant.tone} voicePersonaId={variant.voicePersonaId} inheritHqTone={variant.inheritHqTone} context={context} loading={contextLoading} error={contextError} disabled={readOnly} showHqVoice={false} showGenericDescription onTone={tone => set({ tone, voicePersonaId: null, inheritHqTone: false })} onPersona={voicePersonaId => set({ tone: "Default", voicePersonaId, inheritHqTone: false })} />{variant.tone === "Custom" && <textarea aria-label="Custom tone instructions" className={fieldClass + " mt-2 min-h-16 resize-y"} value={variant.customTone} disabled={readOnly} onChange={e => set({ customTone: e.target.value })} placeholder="Describe the tone to use" />}</div></section>}
    {variant.mode === "template" && <ScriptFields title="Call template" script={variant.template} onChange={template => set({ template })} readOnly={readOnly} prefix="Template" />}
    <AdditionalMessageContext value={variant.userContext} disabled={readOnly || busy} template={variant.mode === "template"}
      onChange={userContext => set({ userContext, preview: undefined })} />
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <label className="flex items-center gap-2 text-xs font-medium">Generation length<select aria-label="Generation length" className="rounded-md border border-input bg-background px-2 py-1.5" value={variant.generationMode} disabled={readOnly} onChange={e => set({ generationMode: e.target.value })}>{["Standard", "Concise", "Detailed", "Experimental"].map(item => <option key={item}>{item}</option>)}</select></label>
       <button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={readOnly || busy || (variant.mode !== "template" && !context?.aiAvailable)} onClick={onGenerate}>{busy ? <ThinkingIndicator decorative className="h-3.5 w-5" /> : <Sparkles size={14} />}{busy ? "Generating…" : variant.preview ? "Generate new preview" : "Generate preview"}</button>
       {variant.mode !== "template" && !context?.aiAvailable && <span className="w-full text-xs text-muted-foreground">AI preview generation is unavailable for this workspace.</span>}
    </div>
  </div>;
}

function PreviewPanel({ playbookId, variant, contacts, selectedContactId, onContactChange, context, onPreviewChange, onGenerationState, readOnly }: {
  playbookId: number; variant: CallVariant; contacts: ManualEmailContext["contacts"]; selectedContactId: number | null;
  onContactChange: (id: number | null) => void; context?: ManualEmailContext;
  onPreviewChange: (variantId: string, preview: CallPreview) => void; onGenerationState: (id: string | null) => void; readOnly: boolean;
}) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "enrolled" | "sample">("all");
  const [showInsights, setShowInsights] = useState(false);
  const [regeneration, setRegeneration] = useState("");
  const [notice, setNotice] = useState("");
  const [dirtyPreview, setDirtyPreview] = useState(false);
  const generationStateRef = useRef(onGenerationState);
  generationStateRef.current = onGenerationState;
  const filtered = useMemo(() => contacts.filter(contact =>
    (scope === "all" || (scope === "enrolled" ? contact.enrolled : !contact.enrolled)) &&
    `${contact.name} ${contact.company}`.toLowerCase().includes(search.toLowerCase())), [contacts, scope, search]);
  const mutation = useMutation({
    mutationFn: (request: { variantId: string; variant: CallVariant; contactId: number; reason: string }) =>
      generatePhoneCallPreview(playbookId, request.variant, request.contactId, request.reason),
    onSuccess: (response, request) => {
      onPreviewChange(request.variantId, { ...response, contactId: request.contactId });
      setDirtyPreview(false);
      setNotice("Preview generated. Review the script before any call.");
    },
    onMutate: request => generationStateRef.current(request.variantId),
    onSettled: () => generationStateRef.current(null),
  });
  const currentContact = contacts.find(contact => contact.id === selectedContactId);
  const preview = variant.preview;
  const previewContact = contacts.find(contact => contact.id === preview?.contactId);
  const confirm = usePlaybookConfirm();
  const doGenerate = async (reason = "") => {
    if (!selectedContactId || (variant.mode !== "template" && !context?.aiAvailable) || readOnly || mutation.isPending) return;
    if (preview && !await confirm({ title: "Replace this call preview?", description: "The generated call script will be replaced. Your call template and other message settings will stay unchanged.", confirmLabel: "Generate new preview" })) return;
    setNotice("");
    mutation.mutate({ variantId: variant.id, variant: { ...variant, preview: undefined }, contactId: selectedContactId, reason });
  };
  const generateRef = useRef(doGenerate);
  generateRef.current = doGenerate;
  useEffect(() => {
    const eventName = `phone-call-generate-${variant.id}`;
    const handler = (event: Event) => generateRef.current((event as CustomEvent<{ reason?: string }>).detail?.reason ?? "");
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [variant.id]);
  const pending = mutation.isPending && mutation.variables?.variantId === variant.id;
  const editPreview = (next: CallPreview) => { setDirtyPreview(true); onPreviewChange(variant.id, next); };
  const err = mutation.error instanceof Error ? mutation.error.message : "Couldn't generate the call preview. Try again.";
  return <section className="flex min-w-0 flex-col">
    <div className="border-b border-border/70 pb-3"><h3 className="text-sm font-semibold">Call preview</h3><p className="mt-0.5 text-xs text-muted-foreground">An editable, seller-reviewed script. No call is placed from this preview.</p></div>
    <div className="space-y-2 py-3"><label className={labelClass}>Generate preview for contact</label><div className="flex flex-wrap gap-2">
      <input aria-label="Search contacts" className={fieldClass + " min-w-40 flex-1"} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts or company" />
      <select aria-label="Contact list filter" className={fieldClass + " w-auto"} value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="all">All contacts</option><option value="enrolled">Enrolled</option><option value="sample">Directory samples</option></select>
    </div>
      <select aria-label="Preview contact" className={fieldClass} value={selectedContactId ?? ""} onChange={e => onContactChange(e.target.value ? Number(e.target.value) : null)}><option value="">Choose a contact</option>{filtered.map(contact => <option key={contact.id} value={contact.id}>{contact.name} · {contact.company}{contact.enrolled ? " · Enrolled" : " · Directory sample"}</option>)}</select>
      {currentContact && <p className="text-xs text-muted-foreground">{currentContact.enrolled ? "Enrolled in this Playbook" : "Directory sample — not enrolled"} · {currentContact.company}</p>}
      {!contacts.length && <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No real contacts are available yet. Enroll contacts in the Playbook or add directory records.</p>}
    </div>
    <div className="min-h-[290px] flex-1 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
      {preview ? <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3"><div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone size={14} />Call script · seller review required</div><p className="mt-1 text-sm font-semibold">{previewContact ? `${previewContact.name} · ${previewContact.company}` : "Generated call preview"}</p></div><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{previewContact?.enrolled ? "Enrolled" : "Directory sample"}</span></div>
        {preview.contactId !== selectedContactId && <p role="status" className="text-xs text-muted-foreground">This preview is for {previewContact?.name ?? "a different contact"}. Generate again to use the selected contact.</p>}
        {dirtyPreview && <p role="status" className="rounded-md bg-primary/5 px-2.5 py-2 text-xs text-primary">Edits to this preview are saved with the step configuration.</p>}
        {mutation.isPending && <p role="status" className="text-xs text-muted-foreground">Preparing a new preview. Preview fields are temporarily locked; step configuration stays editable.</p>}
        <ScriptFields title="Seller-reviewed script" script={preview} onChange={script => editPreview({ ...preview, ...script })} readOnly={readOnly || mutation.isPending} prefix="Preview" />
        <CallAudioPreview key={variant.id} playbookId={playbookId} script={preview} generatingScript={mutation.isPending} />
        <button type="button" className="flex w-full cursor-pointer items-center justify-between border-t border-border pt-3 text-left text-xs font-semibold" onClick={() => setShowInsights(!showInsights)}>Evidence used {preview.insightsUsed.length ? `(${preview.insightsUsed.length})` : "(none listed)"}{showInsights ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
        {showInsights && <div className="space-y-2">{preview.insightsUsed.map(insight => <article key={insight.id} className="rounded-md bg-muted/60 p-2.5"><p className="text-xs font-semibold">{insight.title}</p><p className="mt-1 text-xs text-muted-foreground">{insight.category} · {insight.description}</p>{insight.url && <a href={insight.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Inspect source <ExternalLink size={11} /></a>}</article>)}</div>}
      </div> : pending ? <div className="flex min-h-[250px] flex-col items-center justify-center text-center"><ThinkingIndicator className="mb-4 h-10 w-16" label="Generating conversation guide" /><p className="text-sm font-medium">Preparing a conversation guide…</p><p className="mt-1 text-xs text-muted-foreground">You can keep editing while the preview is generated.</p></div> : <div className="flex min-h-[250px] flex-col items-center justify-center text-center"><div className="mb-3 rounded-full bg-background p-3 text-muted-foreground"><Phone size={20} /></div><p className="text-sm font-semibold">Your conversation guide will appear here</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Choose an actual contact and generate a preview. It never dials or sends anything.</p></div>}
    </div>
    {mutation.error && <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{err} <button type="button" className="cursor-pointer underline" onClick={() => mutation.reset()}>Dismiss</button></span></div>}
    {notice && <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={13} />{notice}</p>}
    {preview && <div className="mt-3 flex flex-wrap items-center gap-2"><select aria-label="Regeneration direction" className={fieldClass + " min-w-36 flex-1"} value={regeneration} onChange={e => setRegeneration(e.target.value)}><option value="">Regenerate with same direction</option>{["Shorter", "More direct", "More personalized", "Different angle", "More discovery-led"].map(item => <option key={item}>{item}</option>)}</select><button type="button" className={smallButton} disabled={readOnly || mutation.isPending || (variant.mode !== "template" && !context?.aiAvailable) || !selectedContactId} onClick={() => doGenerate(regeneration)}><RefreshCw size={13} />Regenerate</button></div>}
    <p className="mt-3 rounded-md border border-border/70 bg-muted/30 p-2.5 text-[11px] leading-5 text-muted-foreground">Configuring or previewing this step does not place calls. Activation reflects playbook status only; task execution and calling happen separately.</p>
  </section>;
}

export function PhoneCallStep({ playbookId, stepId, stepNumber, config: rawConfig, selected, onSelect, onConfigure, readOnly = false, onDuplicate, onDelete, onInsertBefore, onInsertAfter, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  playbookId: number; stepId: string; stepNumber: number; config: unknown; selected: boolean;
  onSelect: () => void; onConfigure: (config: PhoneCallConfiguration) => void; readOnly?: boolean;
  onDuplicate: () => void; onDelete: () => void; onInsertBefore: () => void; onInsertAfter: () => void;
  onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean;
}) {
  const { user } = useUser();
  const contextQuery = useQuery({ queryKey: playbookContextQueryKey(playbookId, user?.id), queryFn: () => getManualEmailContext(playbookId), enabled: !!user?.id, staleTime: 0, refetchOnMount: "always" });
  const config = useMemo(() => readPhoneCallConfiguration(rawConfig ?? createPhoneCallConfiguration()), [rawConfig]);
  const currentConfigRef = useRef(config);
  currentConfigRef.current = config;
  const [activeVariantId, setActiveVariantId] = useState(config.variants[0]?.id ?? "");
  const [contactId, setContactId] = useState<number | null>(null);
  const [timingOpen, setTimingOpen] = useState(false);
  const [generatingVariantId, setGeneratingVariantId] = useState<string | null>(null);
  const variant = config.variants.find(item => item.id === activeVariantId) ?? config.variants[0];
  const context = contextQuery.data;
  const contacts = context?.contacts ?? [];
  const chosenId = contactId !== null && contacts.some(contact => contact.id === contactId) ? contactId : contacts.find(contact => contact.enrolled)?.id ?? contacts[0]?.id ?? null;
  const update = (next: PhoneCallConfiguration) => { currentConfigRef.current = next; onConfigure(next); };
  const updateVariant = (next: CallVariant) => update({ ...config, variants: config.variants.map(item => item.id === next.id ? next : item) });
  const updatePreview = (variantId: string, preview: CallPreview) => {
    const current = currentConfigRef.current;
    if (!current.variants.some(item => item.id === variantId)) return;
    update({ ...current, variants: current.variants.map(item => item.id === variantId ? { ...item, preview } : item) });
  };
  const validationError = validatePhoneCallConfiguration(config);
  const status = !config.enabled ? "Disabled" : contextQuery.isError || (variant?.mode !== "template" && context && !context.aiAvailable) ? "Error" : !contacts.length ? "Warning" : validationError ? "Incomplete" : "Complete";
  const addVariant = () => {
    if (config.variants.length >= 6) return;
    const next = createCallVariant(`Test ${String.fromCharCode(65 + config.variants.length)}`, context);
    const each = Math.floor(100 / (config.variants.length + 1));
    const variants = config.variants.map((item, index) => ({ ...item, allocation: index === config.variants.length - 1 ? 100 - each * config.variants.length : each }));
    next.allocation = each;
    update({ ...config, variants: [...variants, next] }); setActiveVariantId(next.id);
  };
  const removeVariant = (id: string) => {
    if (config.variants.length <= 1) return;
    const remaining = config.variants.filter(item => item.id !== id); const each = Math.floor(100 / remaining.length);
    update({ ...config, variants: remaining.map((item, index) => ({ ...item, allocation: index === remaining.length - 1 ? 100 - each * index : each })) });
    if (activeVariantId === id) setActiveVariantId(remaining[0].id);
  };
  const updateTiming = (key: "createTiming" | "dueTiming", next: EmailTiming) => update({ ...config, [key]: next });
  const statusStyle = status === "Complete" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : status === "Error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  const contextError = contextQuery.error instanceof Error ? contextQuery.error.message : "Couldn't load Phone Call context.";
  return <article id={`configured-step-${stepId}`} data-testid={`configured-step-${stepId}`} className={`overflow-hidden rounded-xl border bg-card transition-shadow ${selected ? "border-primary/50 shadow-sm" : "border-border"} ${!config.enabled ? "opacity-75" : ""}`}>
    <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
      <button type="button" aria-label={`Step ${stepNumber} ${config.enabled ? "enabled" : "disabled"}`} role="switch" aria-checked={config.enabled} disabled={readOnly} onClick={e => { e.stopPropagation(); update({ ...config, enabled: !config.enabled }); }} className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed ${config.enabled ? "bg-primary" : "bg-muted-foreground/40"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform ${config.enabled ? "translate-x-4" : "translate-x-0.5"}`} /></button>
      <button type="button" draggable={!readOnly} aria-label={`Drag to reorder step ${stepNumber}`} onClick={e => e.stopPropagation()} onDragStart={e => { e.dataTransfer.setData("text/plain", stepId); e.dataTransfer.effectAllowed = "move"; }} className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg bg-muted text-muted-foreground active:cursor-grabbing"><GripVertical size={15} /></button>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Phone size={16} /></span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-semibold text-muted-foreground">Step {stepNumber}</span><button type="button" aria-expanded={selected} className="cursor-pointer text-sm font-semibold" onClick={onSelect}>Phone Call</button><span className="text-muted-foreground">/</span>
        <input aria-label="Variant name" className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold hover:border-border focus:border-input focus:bg-background" value={variant?.name ?? "Test A"} disabled={readOnly || !variant} onClick={e => e.stopPropagation()} onChange={e => variant && updateVariant({ ...variant, name: e.target.value })} />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{variant?.objective ?? "First conversation"}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}>{status}</span>
      </div><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={12} />Create {timingSummary(config.createTiming)} · due {timingSummary(config.dueTiming)}</p></div>
      <button type="button" className={smallButton} onClick={e => { e.stopPropagation(); setTimingOpen(!timingOpen); }}><Clock3 size={13} />Timing</button>
      <details className="relative" onClick={e => e.stopPropagation()}><summary aria-label="Step actions" className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-muted"><MoreHorizontal size={17} /></summary>
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-lg">
          <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={onInsertBefore}><Plus size={13} />Insert before</button>
          <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={onInsertAfter}><Plus size={13} />Insert after</button>
          <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly || !canMoveUp} onClick={onMoveUp}><ArrowUp size={13} />Move up</button>
          <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly || !canMoveDown} onClick={onMoveDown}><ArrowDown size={13} />Move down</button>
          <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={onDuplicate}>Duplicate step</button>
          <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={() => update({ ...config, enabled: !config.enabled })}>{config.enabled ? "Disable" : "Enable"} step</button>
          <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-muted" disabled={readOnly} onClick={onDelete}><Trash2 size={13} />Delete step</button>
        </div>
      </details>
      <button type="button" aria-label={selected ? "Collapse step" : "Expand step"} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted" onClick={e => { e.stopPropagation(); onSelect(); }}>{selected ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
    </header>
    {timingOpen && <div className="grid gap-3 border-b border-border/70 bg-muted/20 p-4 sm:grid-cols-2"><TimingEditor label="When to create task" timing={config.createTiming} onChange={value => updateTiming("createTiming", value)} readOnly={readOnly} /><TimingEditor label="When the task is due" timing={config.dueTiming} onChange={value => updateTiming("dueTiming", value)} readOnly={readOnly} /></div>}
    {selected && <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/70 pb-3"><div className="flex flex-1 flex-wrap items-center gap-1.5">{config.variants.map(item => <button type="button" key={item.id} onClick={() => setActiveVariantId(item.id)} className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold ${item.id === variant?.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>{item.name}<span className="ml-1.5 font-normal">{item.allocation}%</span></button>)}<button type="button" className={smallButton} disabled={readOnly || config.variants.length >= 6} onClick={addVariant}><Plus size={13} />Add test</button></div>
        {variant && config.variants.length > 1 && <button type="button" aria-label={`Delete ${variant.name}`} title="Delete this variant" className={smallButton} disabled={readOnly || config.variants.length <= 1} onClick={() => removeVariant(variant.id)}><X size={13} /></button>}
      </div>
      {config.variants.length > 1 && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2.5"><span className="mr-1 text-xs font-semibold">Traffic allocation</span>{config.variants.map(item => <label key={item.id} className="flex items-center gap-1 text-xs">{item.name}<input aria-label={`${item.name} allocation`} className="w-14 rounded border border-input bg-background px-1.5 py-1 text-right" type="number" min={0} max={100} value={item.allocation} disabled={readOnly} onChange={e => updateVariant({ ...item, allocation: Number(e.target.value) })} />%</label>)}<span className={`ml-auto text-xs ${config.variants.reduce((total, item) => total + item.allocation, 0) === 100 ? "text-muted-foreground" : "text-destructive"}`}>Total {config.variants.reduce((total, item) => total + item.allocation, 0)}%</span></div>}
      {contextQuery.isLoading && <div className="mb-4 animate-pulse rounded-md bg-muted p-4 text-xs text-muted-foreground">Loading workspace contacts and context…</div>}
      {contextQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-md border border-destructive/30 p-3 text-xs text-destructive"><span>{contextError}</span><button type="button" className={smallButton} onClick={() => contextQuery.refetch()}>Retry</button></div>}
      {validationError && config.enabled && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle size={14} />{validationError}</p>}
      {variant && <div className="grid min-w-0 gap-6 xl:grid-cols-2"><div className="min-w-0"><h3 className="mb-3 text-sm font-semibold">Configuration</h3><VariantFields variant={variant} context={context} contextLoading={contextQuery.isLoading} contextError={contextQuery.isError} onUpdate={updateVariant} onGenerate={() => { if (variant.mode === "template" || context?.aiAvailable) window.dispatchEvent(new CustomEvent(`phone-call-generate-${variant.id}`)); }} busy={generatingVariantId !== null} readOnly={readOnly} /></div><PreviewPanel playbookId={playbookId} variant={variant} contacts={contacts} selectedContactId={chosenId} onContactChange={setContactId} context={context} onPreviewChange={updatePreview} onGenerationState={setGeneratingVariantId} readOnly={readOnly} /></div>}
    </div>}
    {!selected && <button type="button" className="w-full cursor-pointer px-5 py-3 text-left text-xs text-muted-foreground hover:bg-muted/40" onClick={onSelect}>Expand to edit {variant?.name ?? "call"} configuration</button>}
  </article>;
}