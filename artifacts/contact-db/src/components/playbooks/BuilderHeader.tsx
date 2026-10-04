import { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Archive, ArrowLeft, BarChart3, BookOpen, Check, ChevronDown, Copy, Ellipsis, HeartPulse, MoreHorizontal, Pencil, Settings2, Share2, Sparkles, Users, Workflow, X, Zap, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { BuilderEnrollmentData } from "./BuilderEnrollmentData";
import { readManualEmailConfiguration, validateManualEmailConfiguration } from "./manual-email-model";

export type PlaybookTab = "editor" | "contacts" | "activity" | "health" | "report" | "settings";
const tabs: { id: PlaybookTab; label: string; Icon: LucideIcon }[] = [
  { id: "editor", label: "Editor", Icon: Workflow },
  { id: "contacts", label: "Contacts", Icon: Users },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "health", label: "Health", Icon: HeartPulse },
  { id: "report", label: "Report", Icon: BarChart3 },
  { id: "settings", label: "Settings", Icon: Settings2 },
];

export function BuilderHeader({
  playbookId, name, status, activeTab, steps, saving, activationReason, dirty = false, onBeforeLeave,
  onTab, onRename, onSave, onShare, onOptimize, onWorkflows, onContacts,
  onActivate, onDuplicate, onArchive, onDelete,
}: {
  playbookId: number; name: string; status: string; activeTab: PlaybookTab;
  steps: number; saving: boolean; activationReason?: string;
  dirty?: boolean; onBeforeLeave?: () => boolean;
  onTab: (tab: PlaybookTab) => void; onRename: (name: string) => Promise<void>;
  onSave: () => void; onShare: () => void; onOptimize: () => void;
  onWorkflows: () => void; onContacts: () => void; onActivate: () => void;
  onDuplicate: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [renaming, setRenaming] = useState(false);
  const commitName = async () => {
    if (draft.trim() && draft.trim() !== name && !renaming) {
      setRenaming(true);
      try { await onRename(draft.trim()); }
      catch { setDraft(name); }
      finally { setRenaming(false); }
    }
    setEditing(false);
  };
  const actionClass = "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50";
  return <div className="z-20 shrink-0 border-b border-border/60 bg-card">
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      <div className="flex basis-full items-center gap-2 text-xs text-muted-foreground">
        <button type="button" data-testid="link-playbooks-breadcrumb" onClick={() => { if (!onBeforeLeave || onBeforeLeave()) navigate("/playbooks"); }} className="flex items-center gap-1.5 font-medium hover:text-foreground"><ArrowLeft size={14} />Playbooks</button>
        <span>/</span><span className="truncate">{name}</span>
      </div>
      {editing ? <input data-testid="input-playbook-name" autoFocus value={draft} maxLength={255} onChange={e => setDraft(e.target.value)} onBlur={() => void commitName()} onKeyDown={e => { if (e.key === "Enter") void commitName(); if (e.key === "Escape") { setDraft(name); setEditing(false); } }} className="min-w-32 max-w-xs border-b border-primary bg-transparent px-1 py-1 text-sm font-semibold outline-none" /> : <button type="button" data-testid={`text-playbook-name-${playbookId}`} onClick={() => { setDraft(name); setEditing(true); }} className="inline-flex items-center gap-1.5 rounded px-1 py-1 text-sm font-semibold text-foreground hover:bg-secondary/50"><span className="max-w-[260px] truncate">{name}</span><Pencil size={12} className="text-muted-foreground" /><Settings2 size={13} className="text-muted-foreground" /></button>}
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status === "active" ? "border-green-200 bg-green-50 text-green-700" : "border-border bg-secondary text-muted-foreground"}`}>{status === "active" ? "Active" : status === "paused" ? "Paused" : status}</span>
      <div className="ml-auto flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5">
        <button type="button" data-testid="button-optimize-playbook" className={actionClass} onClick={onOptimize}><Sparkles size={14} />Optimize</button>
        <button type="button" data-testid="button-share-playbook" className={actionClass} onClick={onShare}><Share2 size={14} />Share</button>
        <button type="button" data-testid="button-workflows-playbook" className={actionClass} onClick={onWorkflows}><Workflow size={14} />Workflows</button>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" data-testid="button-add-contacts-playbook" className={actionClass}><Users size={14} />Add Contacts<ChevronDown size={12} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuItem onSelect={onContacts}>Select contacts to enroll</DropdownMenuItem><DropdownMenuItem onSelect={() => onTab("contacts")}>View enrolled contacts</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
        <button type="button" data-testid="button-save-playbook" className={actionClass} disabled={saving || !dirty} onClick={onSave}><Check size={14} />{saving ? "Saving…" : "Save Changes"}</button>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <span className="relative" title={activationReason || "Activate playbook"}>
          <button type="button" data-testid="button-activate-playbook" className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45" disabled={!!activationReason} onClick={onActivate}><Zap size={14} />{status === "active" ? "Pause" : "Activate"}</button>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" data-testid="button-playbook-more" aria-label="More playbook actions" className={actionClass}><MoreHorizontal size={16} /><ChevronDown size={12} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem data-testid="action-duplicate-playbook" onSelect={onDuplicate}><Copy size={14} />Duplicate</DropdownMenuItem>
            <DropdownMenuItem data-testid="action-rename-playbook" onSelect={() => { setDraft(name); setEditing(true); }}><Pencil size={14} />Rename</DropdownMenuItem>
            <DropdownMenuItem data-testid="action-move-playbook" disabled title="Move is not supported by the current playbook API"><Ellipsis size={14} />Move (unavailable)</DropdownMenuItem>
            <DropdownMenuItem data-testid="action-archive-playbook" onSelect={onArchive}><Archive size={14} />Archive</DropdownMenuItem>
            <DropdownMenuItem data-testid="action-delete-playbook" onSelect={onDelete} className="text-destructive"><X size={14} />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <nav className="flex min-h-10 items-end gap-1 overflow-x-auto px-4" aria-label="Playbook workspace">
      {tabs.map(({ id, label, Icon }) => <button type="button" key={id} data-testid={`tab-playbook-${id}`} aria-current={activeTab === id ? "page" : undefined} onClick={() => onTab(id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon size={14} />{label}</button>)}
    </nav>
    {activeTab === "editor" && <div className="flex h-9 items-center gap-2 border-t border-border/40 bg-background/50 px-4 text-xs text-muted-foreground"><Workflow size={14} /><span data-testid="text-playbook-step-count"><b className="text-foreground">{steps}</b> {steps === 1 ? "step" : "steps"}</span><span className="mx-1 h-3 w-px bg-border" /><span>{dirty ? "Unsaved changes" : "Draft changes are saved to this playbook"}</span></div>}
  </div>;
}

export function StructurePanel({ tab, playbookId, name, status, nodes, contactNames, enrollmentCount, onEdit, onActivate }: {
  tab: Exclude<PlaybookTab, "editor">; playbookId: number; name: string; status: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  contactNames: string[]; enrollmentCount?: number; onEdit: () => void; onActivate: () => void;
}) {
  const steps = nodes.filter(node => !["placeholder", "prospect-added", "trigger-detected", "added-to-playbook"].includes(String(node.data.blockType)));
  const incomplete = steps.filter(node => {
    const type = String(node.data.blockType);
    return type === "manual-email" ? !!validateManualEmailConfiguration(readManualEmailConfiguration(node.data.configuration)) : type === "send-email" ? !(node.data.subject || node.data.emailType) : type === "send-linkedin" ? !node.data.linkedinAction : type === "time-delay" ? !node.data.delayAmount : type === "split-path" ? !(node.data.condition && Array.isArray(node.data.branches) && node.data.branches.length >= 2) : false;
  });
  const title = { contacts: "Enrolled contacts", activity: "Activity", health: "Playbook health", report: "Performance report", settings: "Playbook settings" }[tab];
  return <div className="min-h-0 flex-1 overflow-y-auto bg-background p-5 sm:p-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Playbooks / {name}</p><h2 className="mt-2 text-2xl font-bold">{title}</h2></div>{tab !== "settings" && <button type="button" data-testid={`button-return-editor-${tab}`} onClick={onEdit} className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary/50">Open editor</button>}</div>
      {(tab === "contacts" || tab === "activity") && <BuilderEnrollmentData key={tab} playbookId={playbookId} mode={tab} />}
      {tab === "health" && <section className="space-y-3">{status !== "active" && <div className="rounded-lg border border-border bg-card p-4 text-sm"><b>Status:</b> {status}. Activation changes status only; it does not send outreach.</div>}{!steps.length && <div className="rounded-lg border border-amber-300/60 bg-amber-50/50 p-4 text-sm text-amber-900">No workflow steps. Add at least one step before activation is available.</div>}{incomplete.map(node => <div key={node.id} className="rounded-lg border border-amber-300/60 bg-amber-50/50 p-4 text-sm text-amber-900">{String(node.data.label || node.data.blockType)} needs required configuration.</div>)}<div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">Delivery, bounce, reply, and execution health are not recorded by the current playbook APIs.</div>{steps.length > 0 && !incomplete.length && status !== "active" && <button type="button" data-testid="button-health-activate" onClick={onActivate} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Activate playbook</button>}</section>}
      {tab === "report" && <BuilderEnrollmentData playbookId={playbookId} mode="report" />}
      {tab === "settings" && <section className="rounded-lg border border-border bg-card p-5"><div className="flex items-center gap-2"><BookOpen size={17} className="text-muted-foreground" /><h3 className="text-sm font-bold">Playbook configuration</h3></div><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Name</dt><dd className="mt-1 text-sm font-semibold">{name}</dd></div><div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1 text-sm font-semibold capitalize">{status}</dd></div><div><dt className="text-xs text-muted-foreground">Steps in saved canvas</dt><dd className="mt-1 text-sm font-semibold">{steps.length}</dd></div></dl><p className="mt-4 text-xs text-muted-foreground">Rename this playbook from the header. Additional configuration options are not supported by the current API.</p><button type="button" data-testid="button-settings-editor" onClick={onEdit} className="mt-4 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary/50">Return to editor</button></section>}
    </div>
  </div>;
}