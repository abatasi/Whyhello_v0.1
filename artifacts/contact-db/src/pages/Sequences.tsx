import { apiFetch } from "@/lib/apiFetch";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { cn, getInitials } from "@/lib/utils";
import {
  Plus, ArrowLeft, Trash2, Wand2, Send, ChevronUp, ChevronDown,
  Users, Clock, CheckCheck, Eye, MousePointerClick, Loader2,
  Mail, MoreHorizontal, X, Search, Building2, AlertCircle,
  ListChecks, Pencil, Play, Pause, RotateCcw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────

interface Sequence {
  id: number;
  name: string;
  description: string | null;
  status: string;
  stepCount: number;
  enrollmentCount: number;
  dueCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SequenceStep {
  id: number;
  sequenceId: number;
  position: number;
  delayDays: number;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface Enrollment {
  id: number;
  sequenceId: number;
  contactId: number;
  currentStep: number;
  status: string;
  enrolledAt: string;
  isDue: boolean;
  dueAt: string | null;
  lastSentAt: string | null;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string | null;
  contactJobTitle: string | null;
  companyName: string | null;
  stepSubject: string | null;
  stepId: number | null;
  stepPosition: number | null;
  stepDelayDays: number | null;
}

interface ContactResult {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  companyName: string | null;
  email: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function stepLabel(pos: number, total: number): string {
  if (pos === 0) return "Intro";
  if (pos >= total - 1 && total > 1) return "Breakup";
  return `Follow-up ${pos}`;
}

function dayLabel(days: number, pos: number): string {
  if (pos === 0) return "Day 1";
  return `+${days} day${days === 1 ? "" : "s"}`;
}

// ── API hooks ──────────────────────────────────────────────────────────────

function useSequences() {
  return useQuery<Sequence[]>({
    queryKey: ["sequences"],
    queryFn: () => apiFetch("/api/sequences").then(r => r.json()),
  });
}

function useSequenceSteps(seqId: number | null) {
  return useQuery<SequenceStep[]>({
    queryKey: ["sequence-steps", seqId],
    queryFn: () => apiFetch(`/api/sequences/${seqId}/steps`).then(r => r.json()),
    enabled: seqId !== null,
  });
}

function useEnrollments(seqId: number | null) {
  return useQuery<Enrollment[]>({
    queryKey: ["sequence-enrollments", seqId],
    queryFn: () => apiFetch(`/api/sequences/${seqId}/enrollments`).then(r => r.json()),
    enabled: seqId !== null,
    refetchInterval: 30000,
  });
}

// ── Contact search ─────────────────────────────────────────────────────────

function ContactSearchModal({
  open,
  onClose,
  onEnroll,
  alreadyEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  onEnroll: (ids: number[]) => void;
  alreadyEnrolled: Set<number>;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(new Set()); }
  }, [open]);

  const { data, isLoading } = useQuery<{ data: ContactResult[] }>({
    queryKey: ["contact-search-enroll", debouncedQuery],
    queryFn: () => apiFetch(`/api/contacts?search=${encodeURIComponent(debouncedQuery)}&limit=20&status=revealed`).then(r => r.json()),
    enabled: debouncedQuery.length >= 2,
  });

  const contacts = data?.data ?? [];

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/60">
          <DialogTitle className="text-base">Enroll Contacts</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2 bg-secondary/40 border border-border rounded-lg px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search contacts…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {query && <button onClick={() => setQuery("")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : debouncedQuery.length < 2 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Type to search contacts</div>
          ) : contacts.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No contacts found</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {contacts.map(c => {
                const isEnrolled = alreadyEnrolled.has(c.id);
                const isSel = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      disabled={isEnrolled}
                      onClick={() => toggle(c.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        isEnrolled ? "opacity-40 cursor-not-allowed" : isSel ? "bg-primary/5" : "hover:bg-secondary/30"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors",
                        isSel ? "bg-primary border-primary" : "border-border/60 bg-background"
                      )}>
                        {isSel && <CheckCheck className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                        {getInitials(`${c.firstName} ${c.lastName}`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{[c.jobTitle, c.companyName].filter(Boolean).join(" · ")}</p>
                      </div>
                      {isEnrolled && <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full flex-shrink-0">Enrolled</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border/60 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{selected.size > 0 ? `${selected.size} selected` : "Select contacts to enroll"}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={selected.size === 0}
              onClick={() => { onEnroll(Array.from(selected)); onClose(); }}
            >
              Enroll {selected.size > 0 ? selected.size : ""} Contact{selected.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Send Step Modal ────────────────────────────────────────────────────────

function SendStepModal({
  open,
  onClose,
  enrollment,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  enrollment: Enrollment | null;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && enrollment) {
      setSubject(enrollment.stepSubject ?? "");
      setBody("");
    }
  }, [open, enrollment]);

  async function handleSend() {
    if (!enrollment) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/sequences/${enrollment.sequenceId}/enrollments/${enrollment.id}/send-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject || undefined, body: body || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Send failed");
      }
      toast({ title: "Email sent", description: `Sent to ${enrollment.contactFirstName} ${enrollment.contactLastName}` });
      onSent();
      onClose();
    } catch (err) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (!enrollment) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-gradient-to-r from-indigo-50/60 to-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0">
              <Send className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">Send Step {(enrollment.stepPosition ?? 0) + 1}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                To: {enrollment.contactFirstName} {enrollment.contactLastName}
                {enrollment.contactEmail ? ` · ${enrollment.contactEmail}` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="Subject line…"
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Body</label>
            <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">Leave blank to send the step's current content. Edit here to customise for this send.</p>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none font-mono"
              placeholder="Leave blank to use step content, or type an override…"
            />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border/60 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button size="sm" onClick={handleSend} disabled={sending || !subject.trim()} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Step Card ──────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  seqId,
  onDelete,
  onSave,
  onMoveUp,
  onMoveDown,
}: {
  step: SequenceStep;
  index: number;
  total: number;
  seqId: number;
  onDelete: (id: number) => void;
  onSave: (id: number, data: Partial<SequenceStep>) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
}) {
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body);
  const [delayDays, setDelayDays] = useState(step.delayDays);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Sync local state if step prop changes (after generate or reorder)
  useEffect(() => {
    setSubject(step.subject);
    setBody(step.body);
    setDelayDays(step.delayDays);
  }, [step.subject, step.body, step.delayDays]);

  const isDirty = subject !== step.subject || body !== step.body || delayDays !== step.delayDays;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(step.id, { subject, body, delayDays });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await apiFetch(`/api/sequences/${seqId}/steps/${step.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Generation failed");
      const updated: SequenceStep = await res.json();
      setSubject(updated.subject);
      setBody(updated.body);
      toast({ title: "Generated", description: `Step ${index + 1} content ready` });
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  const type = stepLabel(index, total);
  const dayTag = dayLabel(delayDays, index);

  return (
    <div className="flex gap-3 group">
      {/* Timeline connector */}
      <div className="flex flex-col items-center flex-shrink-0 w-8 pt-4">
        <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 z-10">
          {index + 1}
        </div>
        {index < total - 1 && <div className="flex-1 w-px bg-border/50 mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 mb-4 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-secondary/20">
          <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{type}</span>
          {index > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <input
                type="number"
                min={1}
                value={delayDays}
                onChange={e => setDelayDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 rounded border border-border/60 bg-background px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground">days after previous</span>
            </div>
          )}
          {index === 0 && <span className="text-xs text-muted-foreground">Sent immediately on enrollment</span>}
          <div className="ml-auto flex items-center gap-1">
            <button
              disabled={index === 0}
              onClick={() => onMoveUp(step.id)}
              className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              title="Move up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={index === total - 1}
              onClick={() => onMoveDown(step.id)}
              className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              title="Move down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(step.id)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
              title="Delete step"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Subject */}
        <div className="px-4 pt-3">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject line…"
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Body */}
        <div className="px-4 pt-2 pb-3">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            placeholder="Email body… Use **bold** for emphasis."
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none font-mono placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-border/40 bg-secondary/10 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Generate
          </Button>
          {isDirty && (
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save
            </Button>
          )}
          {!isDirty && step.subject && (
            <span className="text-[10px] text-muted-foreground ml-1 flex items-center gap-1">
              <CheckCheck className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sequence Builder (detail page) ─────────────────────────────────────────

function SequenceBuilder({ seqId }: { seqId: number }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"steps" | "contacts">("steps");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<Enrollment | null>(null);

  const { data: seqList } = useQuery<Sequence[]>({ queryKey: ["sequences"] });
  const seq = seqList?.find(s => s.id === seqId);
  const { data: steps = [], isLoading: stepsLoading } = useSequenceSteps(seqId);
  const { data: enrollments = [], isLoading: enrollLoading } = useEnrollments(seqId);

  const alreadyEnrolled = new Set(enrollments.map(e => e.contactId));

  // ── Step mutations ──
  async function addStep() {
    const res = await apiFetch(`/api/sequences/${seqId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delayDays: steps.length === 0 ? 0 : 3 }),
    });
    if (!res.ok) { toast({ title: "Failed to add step", variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["sequence-steps", seqId] });
    qc.invalidateQueries({ queryKey: ["sequences"] });
  }

  async function deleteStep(id: number) {
    await apiFetch(`/api/sequences/${seqId}/steps/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["sequence-steps", seqId] });
    qc.invalidateQueries({ queryKey: ["sequences"] });
  }

  async function saveStep(id: number, data: Partial<SequenceStep>) {
    const res = await apiFetch(`/api/sequences/${seqId}/steps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { toast({ title: "Failed to save step", variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["sequence-steps", seqId] });
  }

  async function moveStep(id: number, direction: "up" | "down") {
    const currentIdx = steps.findIndex(s => s.id === id);
    if (currentIdx === -1) return;
    const newIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const reordered = [...steps];
    [reordered[currentIdx], reordered[newIdx]] = [reordered[newIdx], reordered[currentIdx]];
    await apiFetch(`/api/sequences/${seqId}/steps/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIds: reordered.map(s => s.id) }),
    });
    qc.invalidateQueries({ queryKey: ["sequence-steps", seqId] });
  }

  // ── Name editing ──
  function startEditName() {
    setNameInput(seq?.name ?? "");
    setEditingName(true);
  }
  async function saveName() {
    if (!nameInput.trim()) { setEditingName(false); return; }
    await apiFetch(`/api/sequences/${seqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput }),
    });
    qc.invalidateQueries({ queryKey: ["sequences"] });
    setEditingName(false);
  }

  // ── Enroll ──
  async function handleEnroll(contactIds: number[]) {
    const res = await apiFetch(`/api/sequences/${seqId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds }),
    });
    if (!res.ok) { toast({ title: "Enrollment failed", variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["sequence-enrollments", seqId] });
    qc.invalidateQueries({ queryKey: ["sequences"] });
    toast({ title: `${contactIds.length} contact${contactIds.length > 1 ? "s" : ""} enrolled` });
  }

  async function handleEnrollmentAction(enrollmentId: number, action: "pause" | "resume" | "remove") {
    if (action === "remove") {
      await apiFetch(`/api/sequences/${seqId}/enrollments/${enrollmentId}`, { method: "DELETE" });
    } else {
      await apiFetch(`/api/sequences/${seqId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action === "pause" ? "paused" : "active" }),
      });
    }
    qc.invalidateQueries({ queryKey: ["sequence-enrollments", seqId] });
    qc.invalidateQueries({ queryKey: ["sequences"] });
  }

  const dueEnrollments = enrollments.filter(e => e.isDue && e.status === "active");

  return (
    <Shell>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border/60 flex-shrink-0">
          <button
            onClick={() => navigate("/sequences")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Sequences
          </button>
          <div className="h-4 w-px bg-border" />
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                className="text-base font-semibold border-b border-primary focus:outline-none bg-transparent"
              />
              <Button size="sm" className="h-7 text-xs" onClick={saveName}>Save</Button>
              <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={startEditName} className="flex items-center gap-2 group">
              <h1 className="text-base font-semibold text-foreground">{seq?.name ?? "Sequence"}</h1>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground bg-secondary border border-border/60 px-2.5 py-1 rounded-full">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
            <span className="text-xs text-muted-foreground bg-secondary border border-border/60 px-2.5 py-1 rounded-full">{enrollments.filter(e => e.status === "active").length} enrolled</span>
            {dueEnrollments.length > 0 && (
              <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Clock className="h-3 w-3" /> {dueEnrollments.length} due
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 px-6 border-b border-border/40 flex-shrink-0">
          {(["steps", "contacts"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "steps" ? "Steps" : "Contacts"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "steps" ? (
            <div className="max-w-2xl mx-auto px-6 py-6">
              {stepsLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading steps…
                </div>
              ) : steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center">
                    <Mail className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No steps yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Add your first step to start building this sequence.</p>
                  </div>
                  <Button onClick={addStep} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Add First Step
                  </Button>
                </div>
              ) : (
                <>
                  {steps.map((step, i) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      index={i}
                      total={steps.length}
                      seqId={seqId}
                      onDelete={deleteStep}
                      onSave={saveStep}
                      onMoveUp={id => moveStep(id, "up")}
                      onMoveDown={id => moveStep(id, "down")}
                    />
                  ))}
                  <Button variant="outline" onClick={addStep} className="gap-1.5 mt-2">
                    <Plus className="h-4 w-4" /> Add Step
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Enrolled Contacts</h2>
                <Button size="sm" onClick={() => setEnrollOpen(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Enroll Contacts
                </Button>
              </div>

              {enrollLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
              ) : enrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center rounded-xl border border-dashed border-border/60">
                  <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No contacts enrolled</p>
                    <p className="text-xs text-muted-foreground mt-1">Enroll contacts to start sending this sequence.</p>
                  </div>
                  <Button size="sm" onClick={() => setEnrollOpen(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Enroll Contacts
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/30 border-b border-border/40">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Contact</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Current Step</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Due</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Last Sent</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {enrollments.map(e => {
                        const stepNum = (e.stepPosition ?? e.currentStep) + 1;
                        const isCompleted = e.status === "completed";
                        const isPaused = e.status === "paused";
                        return (
                          <tr key={e.id} className={cn("hover:bg-secondary/20 transition-colors", e.isDue && e.status === "active" && "bg-amber-50/40")}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                  {getInitials(`${e.contactFirstName} ${e.contactLastName}`)}
                                </div>
                                <div className="min-w-0">
                                  <Link href={`/contacts/${e.contactId}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                                    {e.contactFirstName} {e.contactLastName}
                                  </Link>
                                  <p className="text-xs text-muted-foreground truncate">{[e.contactJobTitle, e.companyName].filter(Boolean).join(" · ")}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {isCompleted ? (
                                <span className="text-xs text-muted-foreground">All sent</span>
                              ) : (
                                <span className="text-xs font-medium">{e.stepSubject ? `Step ${stepNum}: ${e.stepSubject.slice(0, 30)}${e.stepSubject.length > 30 ? "…" : ""}` : `Step ${stepNum}`}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isCompleted || isPaused ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : e.isDue ? (
                                <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Due now
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">{e.dueAt ? formatRelative(e.dueAt) : "—"}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{formatRelative(e.lastSentAt)}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                e.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                e.status === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                e.status === "completed" ? "bg-sky-50 text-sky-700 border-sky-200" :
                                "bg-secondary text-muted-foreground border-border"
                              )}>
                                {e.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                {e.status === "active" && !isCompleted && e.stepId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => setSendTarget(e)}
                                  >
                                    <Send className="h-3 w-3" /> Send
                                  </Button>
                                )}
                                {e.status === "active" && (
                                  <button
                                    onClick={() => handleEnrollmentAction(e.id, "pause")}
                                    className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                                    title="Pause"
                                  >
                                    <Pause className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {e.status === "paused" && (
                                  <button
                                    onClick={() => handleEnrollmentAction(e.id, "resume")}
                                    className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                                    title="Resume"
                                  >
                                    <Play className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEnrollmentAction(e.id, "remove")}
                                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ContactSearchModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onEnroll={handleEnroll}
        alreadyEnrolled={alreadyEnrolled}
      />
      <SendStepModal
        open={sendTarget !== null}
        onClose={() => setSendTarget(null)}
        enrollment={sendTarget}
        onSent={() => {
          qc.invalidateQueries({ queryKey: ["sequence-enrollments", seqId] });
          qc.invalidateQueries({ queryKey: ["sequences"] });
        }}
      />
    </Shell>
  );
}

// ── Sequences List ─────────────────────────────────────────────────────────

function SequencesList() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: sequences = [], isLoading } = useSequences();

  useEffect(() => {
    if (creating) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [creating]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const res = await apiFetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) { toast({ title: "Failed to create sequence", variant: "destructive" }); return; }
    const seq: Sequence = await res.json();
    qc.invalidateQueries({ queryKey: ["sequences"] });
    setCreating(false);
    setNewName("");
    navigate(`/sequences/${seq.id}`);
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this sequence? This will remove all steps and enrollment data.")) return;
    await apiFetch(`/api/sequences/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["sequences"] });
  }

  return (
    <Shell>
      <div className="px-6 py-6 max-w-5xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Email Sequences</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Build multi-step outreach campaigns and manage enrolled contacts.</p>
          </div>
          <Button onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Sequence
          </Button>
        </div>

        {/* New sequence inline form */}
        {creating && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
            <input
              ref={nameInputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
              placeholder="Sequence name…"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
            <button onClick={() => { setCreating(false); setNewName(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Sequences grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading sequences…
          </div>
        ) : sequences.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center rounded-2xl border border-dashed border-border/60 bg-secondary/20">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ListChecks className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">No sequences yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs leading-snug">
                Create your first email sequence to start building multi-step outreach campaigns.
              </p>
            </div>
            <Button onClick={() => setCreating(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create First Sequence
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sequences.map(seq => (
              <button
                key={seq.id}
                onClick={() => navigate(`/sequences/${seq.id}`)}
                className="group rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all p-5 text-left"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4.5 w-4.5 text-indigo-600" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {seq.dueCount > 0 && (
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> {seq.dueCount} due
                      </span>
                    )}
                    <button
                      onClick={e => handleDelete(seq.id, e)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-foreground text-sm leading-snug mb-1">{seq.name}</h3>
                {seq.description && (
                  <p className="text-xs text-muted-foreground leading-snug mb-3 line-clamp-2">{seq.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {seq.stepCount} step{seq.stepCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {seq.enrollmentCount} enrolled
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Updated {formatRelative(seq.updatedAt)}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── Page router ────────────────────────────────────────────────────────────

export default function Sequences() {
  const [matchDetail, params] = useRoute("/sequences/:id");
  const seqId = matchDetail ? parseInt(params!.id) : null;

  if (seqId !== null) {
    return <SequenceBuilder seqId={seqId} />;
  }
  return <SequencesList />;
}
