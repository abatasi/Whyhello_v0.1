import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  AlertCircle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Clock3,
  ExternalLink, Mail, Monitor, MoreHorizontal, Plus, RefreshCw, Send,
  Smartphone, Sparkles, Trash2, X, GripVertical,
} from "lucide-react";
import {
  createEmailVariant, readManualEmailConfiguration, timingSummary,
  validateManualEmailConfiguration,
  type EmailPreview, type EmailTiming, type EmailVariant, type ManualEmailConfiguration,
  type ManualEmailContext, type TimingUnit, type InsightCategory,
} from "../manual-email-model";
import { getManualEmailContext, generateManualEmailPreview, sendManualEmailTest } from "../manual-email-api";
import { playbookContextQueryKey } from "@/lib/hq-voice-query-model";
import { emailMarkdownToHtml } from "./email-markdown";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { TonePersonaPicker } from "../TonePersonaPicker";
import { InsightCategorySelect } from "../InsightCategorySelect";
import { AdditionalMessageContext } from "../AdditionalMessageContext";
import { usePlaybookConfirm } from "../PlaybookConfirmProvider";

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30";
const smallButton = "inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "mb-1.5 block text-xs font-semibold text-foreground";

function TimingEditor({ label, timing, onChange, readOnly }: {
  label: string; timing: EmailTiming; onChange: (next: EmailTiming) => void; readOnly: boolean;
}) {
  const update = (patch: Partial<EmailTiming>) => onChange({ ...timing, ...patch });
  return <div className="rounded-md border border-border/70 p-3">
    <label className={labelClass}>{label}</label>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={`${label} timing`} data-testid={`select-${label.toLowerCase().replaceAll(" ", "-")}-timing`} className={fieldClass + " min-w-36 flex-1"} value={timing.unit} disabled={readOnly} onChange={e => update({ unit: e.target.value as TimingUnit })}>
        <option value="immediately">Immediately</option>
        <option value="minutes">Minutes</option>
        <option value="hours">Hours</option>
        <option value="days">Days</option>
        <option value="business-days">Business days</option>
        <option value="specific">Specific date &amp; time</option>
      </select>
      {timing.unit !== "immediately" && <>{timing.unit === "specific"
        ? <input aria-label={`${label} date and time`} className={fieldClass + " min-w-44 flex-1"} type="datetime-local" value={timing.at && !Number.isNaN(Date.parse(timing.at)) ? new Date(new Date(timing.at).getTime() - new Date(timing.at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} disabled={readOnly} onChange={e => update({ at: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
        : <input aria-label={`${label} interval`} className={fieldClass + " w-20"} type="number" min={1} value={timing.amount} disabled={readOnly} onChange={e => update({ amount: Number(e.target.value) })} />}</>}
      <span className="text-xs text-muted-foreground">{timingSummary(timing)}</span>
    </div>
  </div>;
}

function VariantFields({ variant, config, context, contextLoading, contextError, onUpdate, onPreview, busy, readOnly }: {
  variant: EmailVariant; config: ManualEmailConfiguration; context?: ManualEmailContext;
  contextLoading: boolean; contextError: boolean;
  onUpdate: (variant: EmailVariant) => void; onPreview: () => void; busy: boolean; readOnly: boolean;
}) {
  const set = (patch: Partial<EmailVariant>) => onUpdate({ ...variant, ...patch });
  const validation = validateManualEmailConfiguration(config);
  const template = context?.templates.find(item => item.id === variant.templateId);
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Email generation mode">
      {(["assisted", "prompt", "template"] as const).map(mode => <button key={mode} type="button" role="tab" aria-selected={variant.mode === mode} data-testid={`button-mode-${mode}`} disabled={readOnly} onClick={() => set({ mode })} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${variant.mode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{mode}</button>)}
    </div>

    {variant.mode !== "template" && <>
      <section>
        <label className={labelClass}>Length</label>
        <p className="mb-2 text-xs leading-5 text-muted-foreground">Visible body characters only; subject and signature are excluded.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            ["short", "Short", "350–550 chars", "Punchy and highly skimmable"],
            ["medium", "Medium", "600–900 chars", "Conversational, with room to develop"],
            ["long", "Long", "950–1,300 chars", "Insight-rich with meaningful proof"],
          ] as const).map(([id, title, range, description]) => <button key={id} type="button" data-testid={`button-email-length-${id}`} aria-pressed={variant.length === id} disabled={readOnly} onClick={() => set({ length: id })} className={`rounded-lg border p-3 text-left transition-colors ${variant.length === id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
            <span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[11px]">{range}</span><span className="mt-1 block text-[10px] leading-4 opacity-80">{description}</span>
          </button>)}
        </div>
      </section>
      <section>
        <label className={labelClass} htmlFor={`insight-category-${variant.id}`}>Insight category</label>
        <InsightCategorySelect id={`insight-category-${variant.id}`} className={fieldClass} value={variant.insightCategory ?? "personal"} disabled={readOnly}
          onValueChange={value => set({ insightCategory: value as InsightCategory })} />
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">For each contact, we start with the highest-scoring usable insight in this category. Scored insights take priority; if none have scores yet, we use the latest available insight. If no usable evidence is found, generation stops rather than inventing a signal.</p>
      </section>
    </>}

    {variant.mode === "assisted" && <>
      <section>
        <label className={labelClass}>Choose the email type</label>
        <div className="flex flex-wrap gap-2">
          {(["Outreach", "Follow-up", "Last pitch"] as const).map(type => <button key={type} type="button" data-testid={`button-email-type-${type.toLowerCase().replaceAll(" ", "-")}`} disabled={readOnly} onClick={() => set({ emailType: type })} className={`rounded-full border px-3 py-1.5 text-xs ${variant.emailType === type ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{type}</button>)}
        </div>
      </section>
      <section>
        <label className={labelClass}>Set your tone</label>
        <TonePersonaPicker tones={["Professional", "Friendly", "Direct", "Warm", "Authoritative", "Custom"]} tone={variant.tone} voicePersonaId={variant.voicePersonaId}
          inheritHqTone={variant.inheritHqTone} context={context} loading={contextLoading} error={contextError} disabled={readOnly}
          showHqVoice={false} showGenericDescription
          onTone={tone => set({ tone, voicePersonaId: null, inheritHqTone: false })}
          onPersona={voicePersonaId => set({ tone: "Professional", voicePersonaId, inheritHqTone: false })} />
        {variant.tone === "Custom" && <textarea aria-label="Custom tone instructions" className={fieldClass + " mt-2 min-h-16 resize-y"} value={variant.customTone} disabled={readOnly} onChange={e => set({ customTone: e.target.value })} placeholder="Describe the tone to use" />}
      </section>
    </>}

    {variant.mode === "prompt" && <section>
      <label className={labelClass}>Instructions for this email</label>
      <textarea data-testid="input-email-prompt" aria-label="Generation instructions" className={fieldClass + " min-h-36 resize-y"} value={variant.prompt} disabled={readOnly} onChange={e => set({ prompt: e.target.value })} placeholder="Tell Whyhello what this email should achieve, and how it should sound." />
      <p className="mt-1 text-xs text-muted-foreground">The selected insight category and available workspace context are resolved for the preview contact.</p>
      <section className="mt-4">
        <label className={labelClass}>Set your tone</label>
        <TonePersonaPicker tones={["Professional", "Friendly", "Direct", "Warm", "Authoritative", "Custom"]} tone={variant.tone} voicePersonaId={variant.voicePersonaId}
          inheritHqTone={variant.inheritHqTone} context={context} loading={contextLoading} error={contextError} disabled={readOnly}
          showHqVoice={false} showGenericDescription
          onTone={tone => set({ tone, voicePersonaId: null, inheritHqTone: false })}
          onPersona={voicePersonaId => set({ tone: "Professional", voicePersonaId, inheritHqTone: false })} />
        {variant.tone === "Custom" && <textarea aria-label="Custom tone instructions" className={fieldClass + " mt-2 min-h-16 resize-y"} value={variant.customTone} disabled={readOnly} onChange={e => set({ customTone: e.target.value })} placeholder="Describe the tone to use" />}
      </section>
    </section>}

    {variant.mode === "template" && <section className="space-y-3">
      <label className={labelClass}>Saved email template</label>
      <select aria-label="Saved email template" className={fieldClass} value={variant.templateId} disabled={readOnly} onChange={e => {
        const selected = context?.templates.find(item => item.id === e.target.value);
        set({ templateId: e.target.value, templateSubject: selected?.subject ?? variant.templateSubject, templateBody: selected?.body ?? variant.templateBody });
      }}>
        <option value="">Choose a saved template</option>{context?.templates.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
      {context?.templates.length ? <p className="text-xs text-muted-foreground">Select an actual saved template, or edit its content below.</p> : <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No saved templates are available. Add a template in your workspace to use this mode.</p>}
      <input className={fieldClass} aria-label="Template subject" value={variant.templateSubject || template?.subject || ""} disabled={readOnly} onChange={e => set({ templateSubject: e.target.value })} placeholder="Subject" />
      <textarea className={fieldClass + " min-h-32 resize-y"} aria-label="Template body" value={variant.templateBody || template?.body || ""} disabled={readOnly} onChange={e => set({ templateBody: e.target.value })} placeholder="Email body" />
    </section>}

    <AdditionalMessageContext value={variant.userContext} disabled={readOnly || busy} template={variant.mode === "template"}
      onChange={userContext => set({ userContext, preview: undefined })} />
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      {variant.mode === "template" && <span className="text-xs text-muted-foreground">Templates keep their authored subject and body.</span>}
      {validation && !variant.preview && <span className="text-xs text-muted-foreground">Complete required fields to generate.</span>}
      <button type="button" data-testid="button-generate-preview" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={readOnly || busy || !(context && (context.aiAvailable || variant.mode === "template"))} onClick={onPreview}>
        {busy ? <ThinkingIndicator decorative className="h-3.5 w-5" /> : <Sparkles size={14} />}{busy ? "Generating…" : variant.preview ? "Generate new preview" : "Generate preview"}
      </button>
      {!context?.aiAvailable && variant.mode !== "template" && <span className="w-full text-xs text-muted-foreground">AI preview generation is unavailable for this workspace.</span>}
      <p className="w-full text-xs leading-5 text-muted-foreground">AI may make mistakes. Review and verify emails before sending.</p>
    </div>
  </div>;
}

function PreviewPanel({ playbookId, variant, contactOptions, selectedContactId, onContactChange, context, onPreviewChange, onGenerationState, readOnly }: {
  playbookId: number; variant: EmailVariant; contactOptions: ManualEmailContext["contacts"];
  selectedContactId: number | null; onContactChange: (id: number | null) => void;
  context?: ManualEmailContext; onPreviewChange: (variantId: string, preview: EmailPreview) => void;
  onGenerationState: (variantId: string | null) => void; readOnly: boolean;
}) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "enrolled" | "sample">("all");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [regeneration, setRegeneration] = useState("");
  const [showInsights, setShowInsights] = useState(false);
  const [mailboxId, setMailboxId] = useState<number | "">("");
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();
  const filteredContacts = useMemo(() => contactOptions.filter(contact =>
    (scope === "all" || (scope === "enrolled" ? contact.enrolled : !contact.enrolled)) &&
    `${contact.name} ${contact.company}`.toLowerCase().includes(search.toLowerCase())
  ), [contactOptions, scope, search]);
  const canGenerate = !!context && (context.aiAvailable || variant.mode === "template");
  const previewMutation = useMutation({
    mutationFn: (request: { variantId: string; variant: EmailVariant; contactId: number; reason: string }) => {
      return generateManualEmailPreview(playbookId, request.variant, request.contactId, request.reason);
    },
    onMutate: request => {
      onGenerationState(request.variantId);
    },
    onSuccess: (preview, request) => {
      onPreviewChange(request.variantId, preview);
      setNotice("Preview generated.");
    },
    onSettled: () => onGenerationState(null),
  });
  const testMutation = useMutation({
    mutationFn: () => {
      const accountId = Number(mailboxId);
      if (!variant.preview) throw new Error("Generate a preview first.");
      if (!accountId) throw new Error("Choose a connected mailbox.");
      return sendManualEmailTest(playbookId, variant.preview, accountId);
    },
    onSuccess: () => setNotice("Test email sent to your account."),
  });
  const contextQueryKey = ["manual-email-context", playbookId];
  const confirm = usePlaybookConfirm();
  const refresh = () => queryClient.invalidateQueries({ queryKey: contextQueryKey });
  const error = previewMutation.error || testMutation.error;
  const errorText = error instanceof Error ? error.message : "Something went wrong. Try again.";
  const doGenerate = async (reason = "") => {
    if (variant.preview && !await confirm({ title: "Replace this preview?", description: "The current generated email preview will be replaced. Other message settings will stay unchanged.", confirmLabel: "Generate new preview" })) return;
    if (selectedContactId === null) {
      previewMutation.reset();
      return;
    }
    setNotice("");
    previewMutation.mutate({
      variantId: variant.id,
      variant: { ...variant, preview: undefined },
      contactId: selectedContactId,
      reason,
    });
  };
  useEffect(() => {
    const eventName = `manual-email-generate-${variant.id}`;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      doGenerate(detail?.reason ?? "");
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [variant, selectedContactId, context?.aiAvailable]);
  const currentContact = contactOptions.find(item => item.id === selectedContactId);
  const selectedMailbox = context?.mailboxes.find(item => item.id === Number(mailboxId));
  const preview = variant.preview;
  const previewContact = contactOptions.find(item => item.id === preview?.contactId);
  const generationPending = previewMutation.isPending && previewMutation.variables?.variantId === variant.id;
  return <section className="flex min-w-0 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
      <div><h3 className="text-sm font-semibold">Email preview</h3><p className="mt-0.5 text-xs text-muted-foreground">Generate for an enrolled contact or a labeled sample.</p></div>
      <div className="flex rounded-md border border-border p-0.5" aria-label="Preview device">
        <button type="button" aria-label="Desktop preview" data-testid="button-preview-desktop" onClick={() => setDevice("desktop")} className={`rounded p-1.5 ${device === "desktop" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Monitor size={15} /></button>
        <button type="button" aria-label="Mobile preview" data-testid="button-preview-mobile" onClick={() => setDevice("mobile")} className={`rounded p-1.5 ${device === "mobile" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Smartphone size={15} /></button>
      </div>
    </div>
    <div className="space-y-2 py-3">
      <label className={labelClass}>Generate preview for contact</label>
      <div className="flex flex-wrap gap-2">
        <input data-testid="input-contact-search" aria-label="Search contacts" className={fieldClass + " min-w-40 flex-1"} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts or company" />
        <select aria-label="Contact list filter" className={fieldClass + " w-auto"} value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="all">All contacts</option><option value="enrolled">Enrolled</option><option value="sample">Directory samples</option></select>
        <button type="button" className={smallButton} aria-label="Refresh contacts" onClick={refresh}><RefreshCw size={14} /></button>
      </div>
      <select data-testid="select-preview-contact" aria-label="Preview contact" className={fieldClass} value={selectedContactId ?? ""} onChange={e => onContactChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Choose a contact</option>{filteredContacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name} · {contact.company}{contact.enrolled ? " · Enrolled" : " · Directory sample"}</option>)}
      </select>
      {currentContact && <p className="text-xs text-muted-foreground">{currentContact.enrolled ? "Enrolled in this Playbook" : "Directory sample — not enrolled"} · {currentContact.company}</p>}
      {contactOptions.length === 0 && <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No real contacts are available yet. Enroll contacts in the Playbook or add directory records.</p>}
    </div>
    <div className="flex min-h-[290px] flex-1 items-start justify-center rounded-lg border border-border bg-muted/30 p-4 sm:p-6">
      {preview ? <div className={`w-full rounded-lg border border-border bg-card p-4 shadow-sm transition-[width] ${device === "mobile" ? "max-w-[340px]" : "max-w-[680px]"}`}>
        <div className="mb-4 flex items-center gap-2 border-b border-border/70 pb-3 text-xs text-muted-foreground"><Mail size={14} />{previewContact ? `To: ${previewContact.name}` : "Generated email preview"}</div>
        {preview.contactId !== selectedContactId && <p role="status" className="mb-3 text-xs text-muted-foreground">This preview is for a different contact. Generate again to use the selected contact.</p>}
        <p className="text-xs text-muted-foreground">Subject</p><p className="mb-4 mt-1 text-sm font-semibold">{preview.subject}</p>
        <div className="text-sm leading-6 [&_p:last-child]:mb-0" dangerouslySetInnerHTML={{ __html: emailMarkdownToHtml(preview.body) }} />
        {preview.anatomy ? <details className="mt-4 rounded-md border border-border/70">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Preview anatomy</summary>
          <div className="space-y-3 border-t border-border/70 p-3">
            {([["hook", "Hook"], ["bridge", "Bridge"], ["value", "Value"], ["proof", "Proof"], ["cta", "CTA"]] as const).map(([key, label]) => <section key={key}><h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4><div className="text-xs leading-5" dangerouslySetInnerHTML={{ __html: emailMarkdownToHtml(preview.anatomy?.[key] ?? "") }} /></section>)}
          </div>
        </details> : <p className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">This saved preview has no anatomy data. Regenerate it to see the five-layer breakdown.</p>}
        <button type="button" data-testid="button-insights-used" className="mt-5 flex w-full items-center justify-between border-t border-border pt-3 text-left text-xs font-semibold" onClick={() => setShowInsights(!showInsights)}>Insights used {preview.insightsUsed.length ? `(${preview.insightsUsed.length})` : "(none listed)"}{showInsights ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
        {showInsights && <div className="mt-2 space-y-2">{preview.insightsUsed.map(insight => <article key={insight.id} className="rounded-md bg-muted/60 p-2.5">
          <p className="text-xs font-semibold">{insight.title}</p><p className="mt-1 text-xs text-muted-foreground">{insight.category} · {insight.description}</p>
          {insight.url && <a href={insight.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Inspect source <ExternalLink size={11} /></a>}
        </article>)}</div>}
      </div> : generationPending ? <div className="flex min-h-[250px] w-full max-w-lg flex-col items-center justify-center text-center">
         <ThinkingIndicator className="mb-4 h-10 w-16" label="Generating email preview" />
        <p className="text-sm font-medium">Translating insight into outreach…</p><p className="mt-1 text-xs text-muted-foreground">You can keep editing while your preview is generated.</p>
      </div> : <div className="flex min-h-[250px] max-w-sm flex-col items-center justify-center text-center">
        <div className="mb-3 rounded-full bg-background p-3 text-muted-foreground"><Mail size={20} /></div><p className="text-sm font-semibold">Your message will appear here</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose a contact and generate a preview to see the email and its supporting Whyhello insights.</p>
      </div>}
    </div>
    {error && <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{errorText} <button type="button" className="underline" onClick={() => previewMutation.reset()}>Dismiss</button></span></div>}
    {notice && <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={13} />{notice}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {preview && <>
        <select aria-label="Regeneration direction" className={fieldClass + " w-auto min-w-36 flex-1"} value={regeneration} onChange={e => setRegeneration(e.target.value)}><option value="">Regenerate with same direction</option>{["Shorter", "More direct", "More personalized", "Different angle", "Change CTA"].map(item => <option key={item} value={item}>{item}</option>)}</select>
        <button type="button" className={smallButton} data-testid="button-regenerate-preview" disabled={readOnly || generationPending || !canGenerate} onClick={() => doGenerate(regeneration)}><RefreshCw size={13} />Regenerate</button>
      </>}
      <div className="ml-auto flex min-w-full flex-wrap items-center gap-2 sm:min-w-0">
        <select aria-label="Connected mailbox" className={fieldClass + " min-w-40 flex-1"} value={mailboxId} onChange={e => setMailboxId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Choose connected mailbox</option>{context?.mailboxes.map(mailbox => <option key={mailbox.id} value={mailbox.id}>{mailbox.email} · {mailbox.provider}</option>)}
        </select>
        <button type="button" data-testid="button-send-test-email" className={smallButton} disabled={readOnly || !preview || !mailboxId || testMutation.isPending} onClick={async () => {
          if (!await confirm({ title: "Send yourself a test email?", description: `This sends the preview to your own account using ${selectedMailbox?.email ?? "the selected mailbox"}.`, confirmLabel: "Send test email" })) return;
          setNotice(""); testMutation.mutate();
        }}><Send size={13} />{testMutation.isPending ? "Sending…" : "Send me a test email"}</button>
      </div>
      {!context?.mailboxes.length && <p className="w-full text-xs text-muted-foreground">Connect a mailbox to send yourself a test.</p>}
    </div>
  </section>;
}

export function ManualEmailStep({ playbookId, stepId, stepNumber, config: rawConfig, selected, onSelect, onConfigure, readOnly = false, onDuplicate, onDelete, onInsertBefore, onInsertAfter, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  playbookId: number; stepId: string; stepNumber: number; config: unknown; selected: boolean;
  onSelect: () => void; onConfigure: (config: ManualEmailConfiguration) => void; readOnly?: boolean;
  onDuplicate: () => void; onDelete: () => void; onInsertBefore: () => void; onInsertAfter: () => void;
  onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean;
}) {
  const { user } = useUser();
  const queryKey = playbookContextQueryKey(playbookId, user?.id);
  const contextQuery = useQuery({
    queryKey,
    queryFn: () => getManualEmailContext(playbookId),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const config = useMemo(() => readManualEmailConfiguration(rawConfig), [rawConfig]);
  const [activeVariantId, setActiveVariantId] = useState(config.variants[0]?.id ?? "");
  const [generatingVariantId, setGeneratingVariantId] = useState<string | null>(null);
  const currentConfigRef = useRef(config);
  currentConfigRef.current = config;
  const [timingOpen, setTimingOpen] = useState(false);
  const variant = config.variants.find(item => item.id === activeVariantId) ?? config.variants[0];
  const context = contextQuery.data;
  const availableContacts = context?.contacts ?? [];
  const [contactId, setContactId] = useState<number | null>(null);
  const chosenId = contactId !== null && availableContacts.some(contact => contact.id === contactId)
    ? contactId
    : (availableContacts.find(contact => contact.enrolled)?.id ?? availableContacts[0]?.id ?? null);
  const update = (next: ManualEmailConfiguration) => {
    currentConfigRef.current = next;
    onConfigure(next);
  };
  const updateVariant = (next: EmailVariant) => update({ ...config, variants: config.variants.map(item => item.id === next.id ? next : item) });
  const Icon = Mail;
  const validationError = validateManualEmailConfiguration(config);
  const hasContacts = availableContacts.length > 0;
  const status = !config.enabled ? "Disabled"
    : contextQuery.isError || (context && !context.aiAvailable && variant.mode !== "template") ? "Error"
    : !hasContacts ? "Warning"
    : validationError ? "Incomplete" : "Complete";
  const addVariant = () => {
    if (config.variants.length >= 6) return;
    const next = createEmailVariant(`Test ${String.fromCharCode(65 + config.variants.length)}`, context);
    next.length = "medium";
    next.insightCategory = "personal";
    next.tone = "Professional";
    const newEach = Math.floor(100 / (config.variants.length + 1));
    const allocations = config.variants.map((item, index) => ({ ...item, allocation: index === config.variants.length - 1 ? 100 - newEach * config.variants.length : newEach }));
    next.allocation = newEach;
    update({ ...config, variants: [...allocations, next] });
    setActiveVariantId(next.id);
  };
  const removeVariant = (id: string) => {
    if (config.variants.length <= 1) return;
    const remaining = config.variants.filter(item => item.id !== id);
    const each = Math.floor(100 / remaining.length);
    update({ ...config, variants: remaining.map((item, index) => ({ ...item, allocation: index === remaining.length - 1 ? 100 - each * index : each })) });
    if (activeVariantId === id) setActiveVariantId(remaining[0].id);
  };
  const updateTiming = (key: "createTiming" | "dueTiming", next: EmailTiming) => update({ ...config, [key]: next });
  const contextError = contextQuery.error instanceof Error ? contextQuery.error.message : "Couldn't load Manual Email context.";
  return <article id={`configured-step-${stepId}`} data-testid={`configured-step-${stepId}`} className={`overflow-hidden rounded-xl border bg-card transition-shadow ${selected ? "border-primary/50 shadow-sm" : "border-border"} ${!config.enabled ? "opacity-75" : ""}`}>
    <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
      <button type="button" aria-label={`Step ${stepNumber} ${config.enabled ? "enabled" : "disabled"}`} role="switch" aria-checked={config.enabled} disabled={readOnly} data-testid={`switch-step-enabled-${stepId}`} onClick={e => { e.stopPropagation(); update({ ...config, enabled: !config.enabled }); }} className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${config.enabled ? "bg-emerald-100 dark:bg-emerald-950" : "bg-muted-foreground/40"}`}><span className={`absolute left-0.5 top-0.5 size-4 rounded-full shadow-sm transition-[transform,translate,background-color] duration-200 ease-in-out motion-reduce:transition-none ${config.enabled ? "translate-x-4 bg-emerald-600 dark:bg-emerald-400" : "translate-x-0 bg-background"}`} /></button>
       <button type="button" draggable={!readOnly} aria-label={`Drag to reorder step ${stepNumber}`} data-testid={`handle-reorder-step-${stepId}`} onClick={e => e.stopPropagation()} onDragStart={e => { e.dataTransfer.setData("text/plain", stepId); e.dataTransfer.effectAllowed = "move"; }} className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg bg-muted text-muted-foreground active:cursor-grabbing"><GripVertical size={15} /></button>
       <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Step {stepNumber}</span><button type="button" aria-expanded={selected} aria-label={`Edit step ${stepNumber}: Manual Email`} className="text-sm font-semibold" onClick={onSelect}>Manual Email</button><span className="text-muted-foreground">/</span>
          <input aria-label="Variant name" data-testid={`input-variant-name-${stepId}`} className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold hover:border-border focus:border-input focus:bg-background" value={variant?.name ?? "Test A"} disabled={readOnly || !variant} onClick={e => e.stopPropagation()} onChange={e => variant && updateVariant({ ...variant, name: e.target.value })} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{variant?.emailType ?? "Outreach"}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{status}</span>
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={12} />Create {timingSummary(config.createTiming)} · due {timingSummary(config.dueTiming)}</p>
      </div>
      <button type="button" className={smallButton} onClick={e => { e.stopPropagation(); setTimingOpen(!timingOpen); }}><Clock3 size={13} />Timing</button>
      <details className="relative" onClick={e => e.stopPropagation()}>
        <summary aria-label="Step actions" className="grid size-8 list-none place-items-center rounded-md text-muted-foreground hover:bg-muted"><MoreHorizontal size={17} /></summary>
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-lg">
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={onInsertBefore}><Plus size={13} />Insert before</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={onInsertAfter}><Plus size={13} />Insert after</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={!canMoveUp} onClick={onMoveUp}><ArrowUp size={13} />Move up</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={!canMoveDown} onClick={onMoveDown}><ArrowDown size={13} />Move down</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={onDuplicate}>Duplicate step</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" disabled={readOnly} onClick={() => update({ ...config, enabled: !config.enabled })}>{config.enabled ? "Disable" : "Enable"} step</button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-muted" disabled={readOnly} onClick={onDelete}><Trash2 size={13} />Delete step</button>
        </div>
      </details>
      <button type="button" aria-label={selected ? "Collapse step" : "Expand step"} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" onClick={e => { e.stopPropagation(); onSelect(); }}>{selected ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
    </header>
    {timingOpen && <div className="grid gap-3 border-b border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
      <TimingEditor label="When to create task" timing={config.createTiming} onChange={value => updateTiming("createTiming", value)} readOnly={readOnly} />
      <TimingEditor label="When the task is due" timing={config.dueTiming} onChange={value => updateTiming("dueTiming", value)} readOnly={readOnly} />
    </div>}
    {selected && <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">{config.variants.map(item => <button type="button" key={item.id} data-testid={`button-select-variant-${item.id}`} onClick={() => setActiveVariantId(item.id)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${item.id === variant?.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>{item.name}<span className="ml-1.5 font-normal">{item.allocation}%</span></button>)}
          <button type="button" className={smallButton} disabled={readOnly || config.variants.length >= 6} onClick={addVariant}><Plus size={13} />Add test</button>
        </div>
        {variant && config.variants.length > 1 && <button type="button" aria-label={`Delete ${variant.name}`} title="Delete this variant" className={smallButton} disabled={readOnly || config.variants.length <= 1} onClick={() => removeVariant(variant.id)}><X size={13} /></button>}
      </div>
      {config.variants.length > 1 && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2.5">
        <span className="mr-1 text-xs font-semibold">Traffic allocation</span>
        {config.variants.map(item => <label key={item.id} className="flex items-center gap-1 text-xs">{item.name}<input aria-label={`${item.name} allocation`} className="w-14 rounded border border-input bg-background px-1.5 py-1 text-right" type="number" min={0} max={100} value={item.allocation} disabled={readOnly} onChange={e => updateVariant({ ...item, allocation: Number(e.target.value) })} />%</label>)}
        <span className={`ml-auto text-xs ${config.variants.reduce((total, item) => total + item.allocation, 0) === 100 ? "text-muted-foreground" : "text-destructive"}`}>Total {config.variants.reduce((total, item) => total + item.allocation, 0)}%</span>
      </div>}
      {contextQuery.isLoading && <div className="mb-4 animate-pulse rounded-md bg-muted p-4 text-xs text-muted-foreground">Loading workspace contacts and context…</div>}
      {contextQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-md border border-destructive/30 p-3 text-xs text-destructive"><span>{contextError}</span><button type="button" className={smallButton} onClick={() => contextQuery.refetch()}>Retry</button></div>}
      {validationError && config.enabled && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle size={14} />{validationError}</p>}
      {!hasContacts && context && config.enabled && <p role="status" className="mb-3 rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">No enrolled or directory contacts are available for preview yet.</p>}
      {variant && <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <div className="min-w-0"><h3 className="mb-3 text-sm font-semibold">Configuration</h3><VariantFields variant={variant} config={config} context={context} contextLoading={contextQuery.isLoading} contextError={contextQuery.isError} onUpdate={updateVariant} onPreview={() => {
          if (!(context && (context.aiAvailable || variant.mode === "template"))) return;
          // Preview generation is owned by the panel so the actual contact and server response are retained.
          window.dispatchEvent(new CustomEvent(`manual-email-generate-${variant.id}`));
        }} busy={generatingVariantId !== null} readOnly={readOnly} /></div>
        <PreviewPanel playbookId={playbookId} variant={variant} contactOptions={availableContacts} selectedContactId={chosenId} onContactChange={setContactId} context={context} onPreviewChange={(variantId, preview) => {
          const current = currentConfigRef.current;
          if (!current.variants.some(item => item.id === variantId)) return;
          const next = { ...current, variants: current.variants.map(item => item.id === variantId ? { ...item, preview } : item) };
          currentConfigRef.current = next;
          onConfigure(next);
        }} onGenerationState={setGeneratingVariantId} readOnly={readOnly} />
      </div>}
    </div>}
    {!selected && <button type="button" className="w-full px-5 py-3 text-left text-xs text-muted-foreground hover:bg-muted/40" onClick={onSelect}>Expand to edit {variant?.name ?? "email"} configuration</button>}
  </article>;
}