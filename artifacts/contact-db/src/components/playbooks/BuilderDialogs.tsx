import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Mail, Phone, Linkedin, Clock, X, WandSparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

export interface ProposedStep {
  blockType: string;
  title: string;
  description: string;
  delayDays?: number;
}

export interface Proposal {
  name: string;
  summary: string;
  steps: ProposedStep[];
}

const inputClass = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

export function StepPicker({ onSelect, onClose }: { onSelect: (blockType: string) => void; onClose: () => void }) {
  const blocks = [
    { type: "send-email", label: "Send an email", detail: "A personalized email touch", Icon: Mail },
    { type: "send-linkedin", label: "LinkedIn message", detail: "Connect or send a direct message", Icon: Linkedin },
    { type: "make-call", label: "Make a call", detail: "Create a call task", Icon: Phone },
    { type: "time-delay", label: "Wait", detail: "Add timing between actions", Icon: Clock },
  ];
  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="step-picker-title">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div><h2 id="step-picker-title" className="text-base font-bold">Add a step</h2><p className="mt-1 text-xs text-muted-foreground">Choose the first action in this playbook.</p></div>
        <button type="button" data-testid="close-step-picker" aria-label="Close step picker" className="rounded-md p-2 text-muted-foreground hover:bg-secondary" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="p-3">
        {blocks.map(({ type, label, detail, Icon }) => <button type="button" data-testid={`add-step-${type}`} key={type} onClick={() => onSelect(type)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-secondary/60">
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-primary"><Icon size={17} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{label}</span><span className="block text-xs text-muted-foreground">{detail}</span></span>
        </button>)}
      </div>
    </section>
  </div>;
}

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "phone", label: "Phone" },
];
export function AiProposalDialog({ onClose, onInsert, liveBuyingCenter = "", liveTargetMarket = "" }: { onClose: () => void; onInsert: (proposal: Proposal) => void; liveBuyingCenter?: string; liveTargetMarket?: string }) {
  const [objective, setObjective] = useState("");
  const [buyingCenter, setBuyingCenter] = useState(liveBuyingCenter);
  const [targetMarket, setTargetMarket] = useState(liveTargetMarket);
  useEffect(() => { setBuyingCenter(current => current || liveBuyingCenter); }, [liveBuyingCenter]);
  useEffect(() => { setTargetMarket(current => current || liveTargetMarket); }, [liveTargetMarket]);
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [cadence, setCadence] = useState("A thoughtful mix of touches, with space between outreach");
  const [durationDays, setDurationDays] = useState("21");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      const response = await apiFetch("/api/playbooks/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: objective.trim(),
          ...(buyingCenter.trim() ? { buyingCenter: buyingCenter.trim() } : {}),
          ...(targetMarket.trim() ? { targetMarket: targetMarket.trim() } : {}),
          desiredOutcome: desiredOutcome.trim(),
          channels,
          cadence: cadence.trim(),
          durationDays: Number(durationDays),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Proposal request failed (${response.status})`);
      if (!payload || typeof payload.name !== "string" || !Array.isArray(payload.steps)) throw new Error("The proposal response was incomplete.");
      const allowed = new Set(["send-email", "send-linkedin", "make-call", "time-delay", "sequence-complete", "meeting-booked", "reply-received", "exit-playbook"]);
      if (payload.steps.some((step: ProposedStep) => !step || !allowed.has(step.blockType) || typeof step.title !== "string" || typeof step.description !== "string")) throw new Error("The proposal contains a step type or detail that this editor cannot insert.");
      const steps = payload.steps as ProposedStep[];
      if (!steps.length) throw new Error("The proposal did not include any supported steps.");
      for (const step of steps) {
        if (step.blockType === "time-delay" && step.delayDays !== undefined && (!Number.isInteger(step.delayDays) || step.delayDays < 1 || step.delayDays > 365)) throw new Error("The proposal included an invalid delay; request a new proposal.");
      }
      const terminalIndex = steps.findIndex(step => ["sequence-complete", "meeting-booked", "reply-received", "exit-playbook"].includes(step.blockType));
      if (terminalIndex >= 0 && terminalIndex !== steps.length - 1) throw new Error("An outcome step must be the final item in a proposal.");
      setProposal({ name: payload.name, summary: typeof payload.summary === "string" ? payload.summary : "", steps });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate a proposal.");
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="ai-playbook-title">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><WandSparkles size={18} /></span><div><h2 id="ai-playbook-title" className="text-base font-bold">AI-assisted playbook</h2><p className="text-xs text-muted-foreground">Generate a proposal to review. Nothing is inserted or activated yet.</p></div></div>
        <button type="button" data-testid="close-ai-playbook" aria-label="Close AI builder" className="rounded-md p-2 text-muted-foreground hover:bg-secondary" onClick={onClose}><X size={16} /></button>
      </header>
      {!proposal ? <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
        <label className="text-xs font-semibold text-foreground sm:col-span-2">Objective<input data-testid="input-ai-objective" className={`${inputClass} mt-1.5`} value={objective} onChange={e => setObjective(e.target.value)} placeholder="e.g. Open conversations with VP-level finance leaders" /></label>
        <label className="text-xs font-semibold text-foreground">Target buying center<input data-testid="input-ai-buying-center" className={`${inputClass} mt-1.5`} value={buyingCenter} onChange={e => setBuyingCenter(e.target.value)} placeholder="Optional" />{liveBuyingCenter && <small className="mt-1 block font-normal text-muted-foreground">Prefilled from the live HQ buying center.</small>}</label>
        <label className="text-xs font-semibold text-foreground">Target market<input data-testid="input-ai-target-market" className={`${inputClass} mt-1.5`} value={targetMarket} onChange={e => setTargetMarket(e.target.value)} placeholder="Optional" />{liveTargetMarket && <small className="mt-1 block font-normal text-muted-foreground">Prefilled from the live HQ target market.</small>}</label>
        <label className="text-xs font-semibold text-foreground sm:col-span-2">Desired outcome<input data-testid="input-ai-outcome" className={`${inputClass} mt-1.5`} value={desiredOutcome} onChange={e => setDesiredOutcome(e.target.value)} placeholder="What should a successful prospect do?" /></label>
        <fieldset className="sm:col-span-2"><legend className="mb-2 text-xs font-semibold text-foreground">Channels</legend><div className="flex flex-wrap gap-2">{CHANNELS.map(channel => <label key={channel.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={channels.includes(channel.value)} onChange={e => setChannels(current => e.target.checked ? [...current, channel.value] : current.filter(item => item !== channel.value))} />{channel.label}</label>)}</div></fieldset>
        <label className="text-xs font-semibold text-foreground">Cadence<input data-testid="input-ai-cadence" className={`${inputClass} mt-1.5`} value={cadence} onChange={e => setCadence(e.target.value)} /></label>
        <label className="text-xs font-semibold text-foreground">Duration (days)<input data-testid="input-ai-duration" type="number" min="1" max="365" className={`${inputClass} mt-1.5`} value={durationDays} onChange={e => setDurationDays(e.target.value)} /></label>
        {error && <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive sm:col-span-2" role="alert"><AlertCircle size={15} />{error}</p>}
        <div className="flex justify-end gap-2 pt-1 sm:col-span-2"><button type="button" className={buttonClass} onClick={onClose} disabled={busy}>Cancel</button><button type="button" data-testid="button-generate-proposal" className={primaryClass} disabled={busy || !objective.trim() || !desiredOutcome.trim() || !channels.length || !Number.isInteger(Number(durationDays)) || Number(durationDays) < 1 || Number(durationDays) > 365} onClick={() => void generate()}>{busy && <Loader2 size={15} className="animate-spin" />}{busy ? "Generating…" : "Generate proposal"}</button></div>
      </div> : <div className="overflow-y-auto p-5">
        <div className="mb-4 rounded-lg bg-secondary/40 p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Proposed playbook</p><h3 className="mt-1 text-lg font-bold">{proposal.name}</h3>{proposal.summary && <p className="mt-1 text-sm text-muted-foreground">{proposal.summary}</p>}</div>
        <ol className="space-y-2">{proposal.steps.map((step, index) => {
          const type = step.blockType;
          const Icon = type === "send-email" ? Mail : type === "send-linkedin" ? Linkedin : type === "time-delay" ? Clock : Phone;
          return <li key={`${step.blockType}-${index}`} className="flex items-start gap-3 rounded-lg border border-border/70 p-3"><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground"><Icon size={15} /></span><span className="min-w-0 flex-1"><b className="text-sm">{step.title}</b><span className="mt-0.5 block text-xs text-muted-foreground">{step.description}{type === "time-delay" ? ` · ${step.delayDays ?? 1} days` : ""}</span></span></li>;
        })}</ol>
        {error && <p className="mt-4 text-xs text-destructive" role="alert">{error}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Review this structure before inserting it. Generated steps will remain a draft.</p>
        <div className="mt-5 flex justify-between gap-2"><button type="button" className={buttonClass} onClick={() => { setProposal(null); setError(""); }}>Adjust details</button><div className="flex gap-2"><button type="button" className={buttonClass} onClick={onClose}>Cancel</button><button type="button" data-testid="button-insert-proposal" className={primaryClass} onClick={() => onInsert(proposal)}><Check size={15} />Insert into canvas</button></div></div>
      </div>}
    </section>
  </div>;
}

interface ContactRow { id: number; firstName?: string; lastName?: string; name?: string; jobTitle?: string; companyName?: string }
export function ContactEnrollDialog({ playbookId, onClose, onEnrolled }: { playbookId: number; onClose: () => void; onEnrolled: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiFetch(`/api/contacts?search=${encodeURIComponent(query)}&limit=12`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Contact search failed (${response.status})`);
        const rows = Array.isArray(body) ? body : body.data ?? body.contacts ?? [];
        if (live) setResults(rows);
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : "Contact search failed."); }
      finally { if (live) setLoading(false); }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);
  const enroll = async () => {
    if (!selected.length || busy) return;
    setBusy(true); setError("");
    try {
      const response = await apiFetch(`/api/playbooks/${playbookId}/enrollments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactIds: selected }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Enrollment failed (${response.status})`);
      onEnrolled(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enrollment failed."); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="enroll-title">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4"><div><h2 id="enroll-title" className="text-base font-bold">Add contacts</h2><p className="mt-1 text-xs text-muted-foreground">Enroll selected contacts using the playbook enrollment API.</p></div><button type="button" data-testid="close-enroll-dialog" aria-label="Close" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary"><X size={16} /></button></header>
      <div className="space-y-3 overflow-y-auto p-5"><input data-testid="input-contact-search" className={inputClass} value={query} onChange={e => { setQuery(e.target.value); setError(""); }} placeholder="Search contacts by name or company" />
        {loading && <p className="text-xs text-muted-foreground">Searching contacts…</p>}
        {!loading && query && !results.length && <p className="text-xs text-muted-foreground">No matching contacts found.</p>}
        <div className="space-y-1">{results.map(contact => {
          const label = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || `Contact ${contact.id}`;
          return <label key={contact.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-secondary/40"><input type="checkbox" checked={selected.includes(contact.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, contact.id] : ids.filter(id => id !== contact.id))} /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{label}</b><span className="block truncate text-xs text-muted-foreground">{[contact.jobTitle, contact.companyName].filter(Boolean).join(" · ")}</span></span></label>;
        })}</div>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-border/60 px-5 py-4"><button type="button" className={buttonClass} onClick={onClose} disabled={busy}>Cancel</button><button type="button" data-testid="button-enroll-contacts" className={primaryClass} onClick={() => void enroll()} disabled={busy || !selected.length}>{busy && <Loader2 size={15} className="animate-spin" />}Add {selected.length || ""} contact{selected.length === 1 ? "" : "s"}</button></footer>
    </section>
  </div>;
}