import { useState, useCallback, useEffect } from "react";
import {
  useListOutreachJobs,
  useDeleteOutreachJob,
  useUpdateOutreachJob,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2, XCircle, Eye, Share2, Download,
  Trash2, PenLine, FileText, ChevronDown, ChevronUp,
  Copy, Check, MoreVertical, BookOpen, Layers,
  Anchor, ArrowRight, Sparkles, ShieldCheck, MousePointerClick,
  Loader2,
} from "lucide-react";

type Job = {
  id: number;
  contactId: number;
  type: string;
  status: string;
  title: string;
  params: {
    length: string;
    tone: string;
    selectedInsightKeys: string[];
    parentJobId?: number;
    variantCategory?: string;
  };
  result?: string | null;
  prompt?: string | null;
  sources?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

// ── Message structure types ────────────────────────────────────────────────

interface MessageStructure {
  hook: string;
  bridge: string;
  value: string;
  proof: string;
  cta: string;
}

const STRUCTURE_LAYERS: {
  key: keyof MessageStructure;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  dot: string;
}[] = [
  {
    key: "hook",
    label: "Hook",
    sublabel: "Outside-in lead — 1 sentence",
    icon: Anchor,
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    dot: "bg-sky-400",
  },
  {
    key: "bridge",
    label: "Bridge",
    sublabel: "Connect hook to the contact's implied priority",
    icon: ArrowRight,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  {
    key: "value",
    label: "Value",
    sublabel: "Inside-out: value wedge or activated pillar",
    icon: Sparkles,
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    dot: "bg-violet-400",
  },
  {
    key: "proof",
    label: "Proof",
    sublabel: "EB sentence (gain or pain) + optional customer reference",
    icon: ShieldCheck,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-400",
  },
  {
    key: "cta",
    label: "CTA",
    sublabel: "Specific, low-friction ask",
    icon: MousePointerClick,
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-400",
  },
];

// ── Category colours for variant badges ───────────────────────────────────

const CATEGORY_META: Record<string, { label: string; badge: string; bar: string }> = {
  personal:    { label: "Personal",    badge: "bg-sky-100 text-sky-700 border-sky-200",        bar: "bg-sky-400" },
  company:     { label: "Company",     badge: "bg-amber-100 text-amber-700 border-amber-200",  bar: "bg-amber-400" },
  industry:    { label: "Industry",    badge: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "bg-emerald-400" },
  role:        { label: "Role",        badge: "bg-violet-100 text-violet-700 border-violet-200", bar: "bg-violet-400" },
  colleague:   { label: "Colleague",   badge: "bg-orange-100 text-orange-700 border-orange-200", bar: "bg-orange-400" },
  counterpart: { label: "Counterpart", badge: "bg-rose-100 text-rose-700 border-rose-200",     bar: "bg-rose-400" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Strip the [STRUCTURE_JSON]...[/STRUCTURE_JSON] block and return clean email text */
function stripStructureBlock(raw: string): string {
  return raw.replace(/\s*\[STRUCTURE_JSON\][\s\S]*?\[\/STRUCTURE_JSON\]/g, "").trimEnd();
}

/** Parse the [STRUCTURE_JSON] block out of the raw result */
function parseStructure(raw: string): MessageStructure | null {
  const match = raw.match(/\[STRUCTURE_JSON\]([\s\S]*?)\[\/STRUCTURE_JSON\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed.hook && parsed.bridge && parsed.value && parsed.proof && parsed.cta) {
      return parsed as MessageStructure;
    }
  } catch { /* fall through */ }
  return null;
}

/** Split "Subject: ...\n\nbody" into parts. Works for both old and new results. */
function parseEmailResult(raw: string): { subject: string; body: string } {
  const clean = stripStructureBlock(raw);
  const firstNewline = clean.indexOf("\n");
  if (firstNewline === -1) return { subject: "", body: clean };
  const firstLine = clean.slice(0, firstNewline).trim();
  const rest = clean.slice(firstNewline).replace(/^\n+/, "");
  if (firstLine.toLowerCase().startsWith("subject:")) {
    return { subject: firstLine.slice("subject:".length).trim(), body: rest };
  }
  return { subject: "", body: clean };
}

/** Render a string that may contain **bold** and [text](url) markdown as React nodes. */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Split on **bold** and [text](url) tokens
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="underline text-primary hover:opacity-80 transition-opacity">
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

/** Render an email body string, preserving whitespace/newlines and applying inline markdown. */
function EmailBody({ text }: { text: string }) {
  if (!text) return <span>No content generated.</span>;
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {renderInlineMarkdown(line)}
          {i < lines.length - 1 && "\n"}
        </span>
      ))}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function GeneratingBars() {
  return (
    <span className="inline-flex items-end gap-[3px] h-3.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-blue-400"
          style={{
            animation: "wyBarBounce 1.1s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
            height: "6px",
          }}
        />
      ))}
      <style>{`
        @keyframes wyBarBounce {
          0%, 80%, 100% { transform: scaleY(1); opacity: 0.5; }
          40% { transform: scaleY(2.2); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function RenameDialog({ job, onClose, onSave }: { job: Job; onClose: () => void; onSave: (title: string) => void }) {
  const [value, setValue] = useState(job.title);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Rename job</DialogTitle>
          <DialogDescription className="text-xs">Update the display name for this outreach job.</DialogDescription>
        </DialogHeader>
        <input
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && value.trim()) onSave(value.trim()); }}
          autoFocus
        />
        <div className="flex gap-2 justify-end mt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => value.trim() && onSave(value.trim())} disabled={!value.trim()}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// VariantCard and VariantShelf removed — variants are now navigated from
// within the primary job's JobViewerModal via the variant pill selector.

type ViewTab = "result" | "structure" | "prompt" | "sources";

function MessageStructureTab({ result }: { result: string }) {
  const structure = parseStructure(result);

  if (!structure) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Layers className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No structure data available</p>
        <p className="text-xs text-muted-foreground/70 max-w-xs">
          Message Structure is available for emails generated with the current framework.
          Re-generate this email to see its anatomy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        The anatomy of this email mapped to each layer of the Whyhello Cold Outreach Framework.
        Each section is a verbatim extract from the generated message.
      </p>
      {STRUCTURE_LAYERS.map((layer, idx) => {
        const Icon = layer.icon;
        const text = structure[layer.key];
        return (
          <div key={layer.key} className={cn("rounded-xl border p-4 space-y-2", layer.bg, layer.border)}>
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className={cn("h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0", layer.bg, layer.border, "border")}>
                <Icon className={cn("h-3 w-3", layer.color)} />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("text-[11px] font-black uppercase tracking-widest", layer.color)}>
                  {layer.label}
                </span>
                <span className="text-[10px] text-muted-foreground/70 truncate">— {layer.sublabel}</span>
              </div>
              <span className={cn(
                "ml-auto text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 text-white",
                layer.dot
              )}>
                {idx + 1}
              </span>
            </div>
            {/* Content */}
            <p className="text-[12px] text-foreground leading-relaxed pl-7">
              {text || <span className="text-muted-foreground/50 italic">—</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function JobViewerModal({
  job,
  variants = [],
  onClose,
  initialTab = "result",
}: {
  job: Job;
  variants?: Job[];
  onClose: () => void;
  initialTab?: ViewTab;
}) {
  const [tab, setTab] = useState<ViewTab>(initialTab);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  // Primary job is index 0; completed variants follow
  const allJobs = [job, ...variants];
  const activeJob = allJobs[activeIdx] ?? job;
  const isActiveGenerating = activeJob.status === "generating";

  const raw = activeJob.result ?? "";
  const { subject, body } = parseEmailResult(raw);
  const cleanEmail = subject ? `Subject: ${subject}\n\n${body}` : body;

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadText(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasStructure = !!parseStructure(raw);

  const tabs: { id: ViewTab; label: string; show: boolean }[] = [
    { id: "result",    label: "Email",             show: true },
    { id: "structure", label: "Message Structure", show: true },
    { id: "prompt",    label: "Prompt",            show: true },
    { id: "sources",   label: "Sources",           show: true },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ width: "58vw", maxWidth: "58vw", maxHeight: "84vh", display: "flex", flexDirection: "column" }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-7 py-5 border-b border-border/60 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold">{job.title}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 capitalize">
                {job.type.replace(/_/g, " ")} · {job.params?.length} · {job.params?.tone} · {timeAgo(job.createdAt)}
              </DialogDescription>
            </div>
            {!isActiveGenerating && (
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                <Button
                  variant="outline" size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => copyToClipboard(cleanEmail)}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => downloadText(cleanEmail, `${activeJob.title.replace(/\s+/g, "-").toLowerCase()}.txt`)}
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── Variant selector pill strip ── */}
        {variants.length > 0 && (
          <div className="flex items-center gap-1.5 px-7 py-2.5 border-b border-border/60 flex-shrink-0 bg-secondary/20 overflow-x-auto">
            {allJobs.map((j, i) => {
              const isActive = activeIdx === i;
              const isGen = j.status === "generating";
              const cat = j.params?.variantCategory;
              const label = i === 0
                ? "Primary"
                : (cat ? (CATEGORY_META[cat]?.label ?? cat) : `Variant ${i}`);
              return (
                <button
                  key={j.id}
                  disabled={isGen}
                  onClick={() => {
                    if (!isGen) {
                      setActiveIdx(i);
                      setTab("result");
                      setCopied(false);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isGen
                        ? "bg-secondary/60 text-muted-foreground/40 cursor-not-allowed"
                        : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  )}
                >
                  {isGen && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-border/60 flex-shrink-0">
          {tabs.filter(t => t.show).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                t.id === "structure" && !hasStructure && "opacity-50"
              )}
            >
              {t.label}
              {t.id === "structure" && hasStructure && (
                <span className="ml-1.5 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold">5</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {isActiveGenerating ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground">Generating this variant…</p>
            </div>
          ) : (
            <>
              {tab === "result" && (
                <div className="space-y-4">
                  {subject ? (
                    <div className="flex items-baseline gap-2 pb-4 border-b border-border/50">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-shrink-0">Subject</span>
                      <span className="text-sm font-semibold text-foreground">{subject}</span>
                    </div>
                  ) : null}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    <EmailBody text={body} />
                  </div>
                </div>
              )}
              {tab === "structure" && <MessageStructureTab result={raw} />}
              {tab === "prompt" && (
                <pre className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono bg-secondary/40 rounded-xl p-4">
                  {activeJob.prompt ?? "Prompt not stored."}
                </pre>
              )}
              {tab === "sources" && (
                <div className="space-y-2">
                  {(activeJob.sources ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No sources recorded.</p>
                  ) : (
                    (activeJob.sources ?? []).map((raw, i) => {
                      // Format: "category-id|Title|mediaType|score" (older jobs: just "category-id")
                      const [idPart = raw, title = "", mediaType = "", scoreStr = ""] = raw.split("|");
                      const lastDash = idPart.lastIndexOf("-");
                      const catKey = lastDash !== -1 ? idPart.slice(0, lastDash) : idPart;
                      const meta = CATEGORY_META[catKey];
                      const mediaLabel = mediaType.replace(/_/g, " ");
                      const score = scoreStr !== "" ? parseInt(scoreStr, 10) : null;
                      const scoreColor = score === null ? ""
                        : score >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : score >= 50 ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-muted-foreground bg-secondary border-border/60";
                      return (
                        <div key={i} className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-secondary/30 border border-border/40">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {meta && (
                                <span className={cn(
                                  "text-[9px] font-bold uppercase tracking-widest px-1.5 py-px rounded border whitespace-nowrap",
                                  meta.badge
                                )}>
                                  {meta.label}
                                </span>
                              )}
                              {mediaLabel && (
                                <span className="text-[10px] text-muted-foreground capitalize">{mediaLabel}</span>
                              )}
                              {score !== null && (
                                <span className={cn(
                                  "ml-auto flex-shrink-0 text-[10px] font-bold px-1.5 py-px rounded border tabular-nums",
                                  scoreColor
                                )}>
                                  {score}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-foreground leading-snug">
                              {title || idPart}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end px-7 py-4 border-t border-border/60 flex-shrink-0">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JobCard({ job, onDeleted, variants = [] }: { job: Job; onDeleted: () => void; variants?: Job[] }) {
  const [viewing, setViewing] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("result");
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useDeleteOutreachJob();
  const renameMutation = useUpdateOutreachJob();

  const handleDelete = useCallback(() => {
    deleteMutation.mutate({ jobId: job.id }, { onSuccess: onDeleted });
  }, [deleteMutation, job.id, onDeleted]);

  const handleRename = useCallback((title: string) => {
    renameMutation.mutate({ jobId: job.id, data: { title } }, { onSuccess: () => setRenaming(false) });
  }, [renameMutation, job.id]);

  function openViewer(tab: ViewTab = "result") {
    setViewTab(tab);
    setViewing(true);
  }

  function downloadFile() {
    const clean = stripStructureBlock(job.result ?? "");
    const blob = new Blob([clean], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function shareJob() {
    const clean = stripStructureBlock(job.result ?? "");
    navigator.clipboard.writeText(clean).catch(console.error);
  }

  const isGenerating = job.status === "generating";
  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";
  const hasStructure = isCompleted && !!parseStructure(job.result ?? "");

  const primaryLabel = job.type === "intro_email" ? "View Email" : "View";

  return (
    <>
      <div
        onClick={() => isCompleted && openViewer("result")}
        className={cn(
          "rounded-xl border px-3.5 py-3 transition-all",
          isGenerating && "border-blue-200/70 bg-gradient-to-r from-blue-50/40 to-indigo-50/20",
          isFailed && "border-red-200/60 bg-red-50/20",
          isCompleted && "bg-card border-border/60 hover:border-primary/40 hover:shadow-sm cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0">
            {isGenerating && <GeneratingBars />}
            {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
            {isFailed && <XCircle className="h-3.5 w-3.5 text-red-400" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-xs font-semibold text-foreground leading-snug truncate">{job.title}</p>
              {isCompleted && variants.length > 0 && (
                <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">
                  <Layers className="h-2 w-2" />
                  {variants.filter(v => v.status === "completed").length + 1} emails
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
              {isGenerating
                ? <span className="text-blue-500/80 font-medium tracking-wide">Writing your email…</span>
                : isFailed
                  ? <span className="text-red-400 font-medium">Generation failed</span>
                  : <>{job.type.replace(/_/g, " ")} · {job.params?.length} · {job.params?.tone} · {timeAgo(job.createdAt)}</>
              }
            </p>
          </div>

          {isCompleted && (
            <div
              className="flex items-center gap-1 flex-shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs font-semibold px-2.5"
                onClick={() => openViewer("result")}
              >
                <Eye className="h-3 w-3" />
                {primaryLabel}
              </Button>

              {hasStructure && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs font-semibold px-2.5 text-violet-600 border-violet-200 hover:bg-violet-50"
                  onClick={() => openViewer("structure")}
                  title="View message anatomy"
                >
                  <Layers className="h-3 w-3" />
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="More actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={shareJob}>
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={() => setRenaming(true)}>
                    <PenLine className="h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={downloadFile}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={() => openViewer("structure")}>
                    <Layers className="h-3.5 w-3.5" />
                    Message Structure
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={() => openViewer("prompt")}>
                    <BookOpen className="h-3.5 w-3.5" />
                    View prompt &amp; sources
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-xs cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {isFailed && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              title="Delete"
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {viewing && <JobViewerModal job={job} variants={variants} initialTab={viewTab} onClose={() => setViewing(false)} />}
      {renaming && <RenameDialog job={job} onClose={() => setRenaming(false)} onSave={handleRename} />}

      {confirmDelete && (
        <Dialog open onOpenChange={(o) => !o && setConfirmDelete(false)}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-sm">Delete job?</DialogTitle>
              <DialogDescription className="text-xs">
                This will permanently delete "{job.title}" and all its entry point variants. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end mt-1">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function OutreachJobsList({ contactId, refetchTrigger }: { contactId: number; refetchTrigger?: number }) {
  const [expanded, setExpanded] = useState(true);

  const { data: jobs = [], refetch } = useListOutreachJobs(contactId, {
    query: {
      refetchInterval: (query) => {
        const data = query.state.data as Job[] | undefined;
        const hasGenerating = data?.some(j => j.status === "generating");
        return hasGenerating ? 1500 : false;
      },
    },
  });

  useEffect(() => {
    if (!refetchTrigger) return;
    refetch();
    setExpanded(true);
  }, [refetchTrigger, refetch]);

  if (jobs.length === 0) return null;

  // Separate top-level emails from variant children
  const allJobs = jobs as Job[];
  const mainJobs = allJobs.filter(j => j.type !== "intro_email_variant");
  const variantsByParent = new Map<number, Job[]>();
  for (const job of allJobs) {
    if (job.type === "intro_email_variant" && job.params?.parentJobId != null) {
      const arr = variantsByParent.get(job.params.parentJobId) ?? [];
      arr.push(job);
      variantsByParent.set(job.params.parentJobId, arr);
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 w-full text-left mb-2"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Generated</span>
        <span className="text-[10px] font-semibold bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">
          {mainJobs.length}
        </span>
        {expanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />}
      </button>
      {expanded && (
        <div className="flex flex-col gap-2">
          {mainJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onDeleted={() => refetch()}
              variants={variantsByParent.get(job.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
