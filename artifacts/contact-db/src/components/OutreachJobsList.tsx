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
  Copy, Check, MoreVertical, BookOpen,
} from "lucide-react";

type Job = {
  id: number;
  contactId: number;
  type: string;
  status: string;
  title: string;
  params: { length: string; tone: string; selectedInsightKeys: string[] };
  result?: string | null;
  prompt?: string | null;
  sources?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

type ViewTab = "result" | "prompt" | "sources";

/** Split "Subject: ...\n\nbody" into parts. Works for both old and new results. */
function parseEmailResult(raw: string): { subject: string; body: string } {
  const firstNewline = raw.indexOf("\n");
  if (firstNewline === -1) return { subject: "", body: raw };
  const firstLine = raw.slice(0, firstNewline).trim();
  const rest = raw.slice(firstNewline).replace(/^\n+/, "");
  if (firstLine.toLowerCase().startsWith("subject:")) {
    return { subject: firstLine.slice("subject:".length).trim(), body: rest };
  }
  return { subject: "", body: raw };
}

function JobViewerModal({ job, onClose, initialTab = "result" }: { job: Job; onClose: () => void; initialTab?: ViewTab }) {
  const [tab, setTab] = useState<ViewTab>(initialTab);
  const [copied, setCopied] = useState(false);

  const { subject, body } = parseEmailResult(job.result ?? "");
  const fullText = job.result ?? "";

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

  const tabs: { id: ViewTab; label: string }[] = [
    { id: "result", label: "Email" },
    { id: "prompt", label: "Prompt" },
    { id: "sources", label: "Sources" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ width: "52vw", maxWidth: "52vw", maxHeight: "82vh", display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="px-7 py-5 border-b border-border/60 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold">{job.title}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 capitalize">
                {job.type.replace("_", " ")} · {job.params?.length} · {job.params?.tone} · {timeAgo(job.createdAt)}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
              <Button
                variant="outline" size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => copyToClipboard(fullText)}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => downloadText(fullText, `${job.title.replace(/\s+/g, "-").toLowerCase()}.txt`)}
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex border-b border-border/60 flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-5">
          {tab === "result" && (
            <div className="space-y-4">
              {subject ? (
                <div className="flex items-baseline gap-2 pb-4 border-b border-border/50">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-shrink-0">Subject</span>
                  <span className="text-sm font-semibold text-foreground">{subject}</span>
                </div>
              ) : null}
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {body || "No content generated."}
              </div>
            </div>
          )}
          {tab === "prompt" && (
            <pre className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono bg-secondary/40 rounded-xl p-4">
              {job.prompt ?? "Prompt not stored."}
            </pre>
          )}
          {tab === "sources" && (
            <div className="space-y-1.5">
              {(job.sources ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No sources recorded.</p>
              ) : (
                (job.sources ?? []).map((key, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 text-xs text-foreground">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono">{key}</span>
                  </div>
                ))
              )}
            </div>
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

function JobCard({ job, onDeleted }: { job: Job; onDeleted: () => void }) {
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
    const blob = new Blob([job.result ?? ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function shareJob() {
    navigator.clipboard.writeText(job.result ?? "").catch(console.error);
  }

  const isGenerating = job.status === "generating";
  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";

  const primaryLabel = job.type === "intro_email" ? "View Email" : "View";

  return (
    <>
      {/* Card — clicking the body opens the viewer for completed jobs */}
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
          {/* Status icon */}
          <div className="flex-shrink-0">
            {isGenerating && <GeneratingBars />}
            {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
            {isFailed && <XCircle className="h-3.5 w-3.5 text-red-400" />}
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground leading-snug truncate">{job.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
              {isGenerating
                ? <span className="text-blue-500/80 font-medium tracking-wide">Writing your email…</span>
                : isFailed
                  ? <span className="text-red-400 font-medium">Generation failed</span>
                  : <>{job.type.replace("_", " ")} · {job.params?.length} · {job.params?.tone} · {timeAgo(job.createdAt)}</>
              }
            </p>
          </div>

          {/* Actions — only shown when completed */}
          {isCompleted && (
            <div
              className="flex items-center gap-1 flex-shrink-0"
              onClick={e => e.stopPropagation()}
            >
              {/* Primary action */}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs font-semibold px-2.5"
                onClick={() => openViewer("result")}
              >
                <Eye className="h-3 w-3" />
                {primaryLabel}
              </Button>

              {/* More menu */}
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

          {/* Failed — only show delete */}
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

      {viewing && <JobViewerModal job={job} initialTab={viewTab} onClose={() => setViewing(false)} />}
      {renaming && <RenameDialog job={job} onClose={() => setRenaming(false)} onSave={handleRename} />}

      {confirmDelete && (
        <Dialog open onOpenChange={(o) => !o && setConfirmDelete(false)}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-sm">Delete job?</DialogTitle>
              <DialogDescription className="text-xs">
                This will permanently delete "{job.title}". This cannot be undone.
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

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 w-full text-left mb-2"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Generated</span>
        <span className="text-[10px] font-semibold bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">
          {jobs.length}
        </span>
        {expanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />}
      </button>
      {expanded && (
        <div className="flex flex-col gap-1.5">
          {(jobs as Job[]).map(job => (
            <JobCard key={job.id} job={job} onDeleted={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
