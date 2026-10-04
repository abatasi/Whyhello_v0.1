import './_group.css';
import { useState } from 'react';
import { Plus, BookOpen, Loader2, GitBranch, Users, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Exact list-view JSX extracted from the app; network, routing and templates are sandbox stubs.
interface PlaybookMeta {
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


interface PlaybookNodeData { blockType?: string }
interface CanvasState { nodes: { data: PlaybookNodeData }[]; prospects?: {contactId?: number}[] }
const CURRENT_DATA: PlaybookMeta[] = ['Enterprise Prospecting','Product Demo Follow-Up','Strategic Accounts','Q4 Re-Engagement','Executive Outreach'].map((name,i)=>({id:i+1,name,description:null,status:i===0?'active':i===3?'paused':'draft',stepCount:4+i,enrollmentCount:i===0?142:0,dueCount:0,createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-03T12:00:00Z'}));
function CannedLibraryModal({open,onClose}:{open:boolean;onClose:()=>void}) { return open ? <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-card border border-border rounded-xl p-6"><p className="text-sm mb-4">Template library — current design reference</p><button onClick={onClose} className="text-sm text-primary">Close</button></div></div> : null; }
function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}


function PlaybooksList() {
  const navigate = (_path: string) => {};
  const qc = { invalidateQueries: (_options: unknown) => {} };
  const toast = (_options: unknown) => {};
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showCanned, setShowCanned] = useState(false);

  const [playbooks, setPlaybooks] = useState<PlaybookMeta[]>(CURRENT_DATA);
  const isLoading = false;
  async function createPlaybook(name: string) {
    setCreating(true);
    setPlaybooks(rows => [...rows, { id: Date.now(), name: name || 'Untitled Playbook', description: null, status: 'draft', stepCount: 0, enrollmentCount: 0, dueCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    setShowNew(false); setNewName(''); setCreating(false);
  }
  async function deletePlaybook(id: number) { setPlaybooks(rows => rows.filter(row => row.id !== id)); }

  const CATEGORY_COLORS: Record<string, string> = {
    draft: "bg-secondary text-muted-foreground border-border/60",
    active: "bg-green-50 text-green-700 border-green-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Playbooks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Build and manage your multi-touch outreach sequences</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCanned(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary/40 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Templates
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Playbook
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading playbooks…
          </div>
        ) : playbooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-secondary/60 border border-border/60 flex items-center justify-center">
              <GitBranch className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No playbooks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start from scratch or choose a proven template.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary/40 transition-colors">Start from Scratch</button>
              <button onClick={() => setShowCanned(true)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Choose a Template</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 max-w-4xl">
            {playbooks.map(pb => {
              const storageKey = `playbook_canvas_v3_${pb.id}`;
              let blockCount = 0;
              let prospectCount = 0;
              try {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                  const cs = JSON.parse(raw) as CanvasState;
                  blockCount = cs.nodes.filter(n => (n.data as PlaybookNodeData).blockType !== "placeholder").length;
                  prospectCount = (cs.prospects ?? []).filter(p => p.contactId).length;
                }
              } catch {}
              return (
                <div
                  key={pb.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => navigate(`/playbooks/${pb.id}`)}
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{pb.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">Updated {formatRelative(pb.updatedAt)}</span>
                      {blockCount > 0 && <span className="text-[11px] text-muted-foreground">{blockCount} block{blockCount !== 1 ? "s" : ""}</span>}
                      {prospectCount > 0 && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" /> {prospectCount} thread{prospectCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {pb.enrollmentCount > 0 && <span className="text-[11px] text-muted-foreground">{pb.enrollmentCount} enrolled</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", CATEGORY_COLORS[pb.status] ?? CATEGORY_COLORS.draft)}>
                      {pb.status ?? "draft"}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); deletePlaybook(pb.id); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New playbook inline form */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-96 p-5 flex flex-col gap-4">
            <p className="text-sm font-bold">New Playbook</p>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createPlaybook(newName); if (e.key === "Escape") setShowNew(false); }}
              placeholder="Playbook name…"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary/40">Cancel</button>
              <button
                onClick={() => createPlaybook(newName)}
                disabled={creating}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <CannedLibraryModal open={showCanned} onClose={() => setShowCanned(false)} />
    </div>
  );
}

export function Current() { return <div className="dark playbooks-current min-h-screen h-screen bg-background text-foreground"><PlaybooksList /></div>; }
