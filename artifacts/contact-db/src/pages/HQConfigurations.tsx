import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import type { HqConfigurationWorkspace } from "@workspace/api-client-react";
import { Plus, Pencil, Trash2, Radio, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { invalidateCompetitorCache } from "@/components/CompetitorBadge";
import { Shell } from "@/components/layout/Shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { HQEditor } from "./HQ";

const LIVE_PROFILE_URL = "/api/hq/profile";
const DNA_STORAGE_KEY = "whyhello_dna_v4";
const BLANK = "__blank__";

type SaveState = { loaded: boolean; saved: boolean; saveError: string; loadError: boolean };

async function request(url: string, init?: RequestInit): Promise<HqConfigurationWorkspace> {
  const r = await apiFetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    let msg = "Request failed";
    try { const j = await r.json() as { error?: string }; if (j?.error) msg = j.error; } catch { /* ignore */ }
    if (r.status === 409) msg = msg === "Request failed" ? "HQ changed elsewhere — reload and try again" : msg;
    throw new Error(msg);
  }
  return r.json();
}

const btn = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const btnOutline = `${btn} border border-border bg-background text-foreground hover:bg-secondary`;
const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
const btnLive = `${btn} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500`;
const btnDanger = `${btn} bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500`;

export default function HQConfigurations() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["hq-configurations", user?.id ?? "signed-out"],
    enabled: !!user?.id,
    queryFn: async () => {
      const r = await apiFetch("/api/hq/configurations");
      if (!r.ok) throw new Error("Could not load HQ configurations");
      return await r.json() as HqConfigurationWorkspace;
    },
    staleTime: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [sync, setSync] = useState<SaveState>({ loaded: false, saved: false, saveError: "", loadError: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<null | "new" | "rename" | "delete" | "live">(null);
  const [nameDraft, setNameDraft] = useState("");
  const [copyFrom, setCopyFrom] = useState(BLANK);

  const onState = useCallback((s: SaveState) => setSync(s), []);

  const ws = q.data;

  if (!user || q.isLoading) {
    return (
      <Shell>
        <div className="p-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading HQ…
        </div>
      </Shell>
    );
  }
  if (q.isError || !ws) {
    return (
      <Shell>
        <div className="flex flex-col items-start gap-3 p-10" role="alert">
          <p className="text-sm text-foreground">Could not load HQ.</p>
          <button className={btnPrimary} onClick={() => void q.refetch()}><RefreshCw className="h-3.5 w-3.5" />Retry</button>
        </div>
      </Shell>
    );
  }

  // Ordinary accounts retain the existing single editor. An empty master
  // workspace is an error, never an excuse to bypass the configuration layer.
  if (!ws.canManage) {
    return <HQEditor key={`single:${user.id}`} profileUrl={LIVE_PROFILE_URL} live />;
  }
  if (!ws.items.length) {
    return <Shell><div className="p-8" role="alert">No HQ configurations were returned. <button onClick={() => void q.refetch()}>Retry</button></div></Shell>;
  }

  const liveItem = ws.items.find(i => i.id === ws.liveId) ?? ws.items.find(i => i.isLive) ?? null;
  const currentId = ws.items.some(i => i.id === selectedId) ? selectedId! : (liveItem?.id ?? ws.items[0].id);
  const current = ws.items.find(i => i.id === currentId)!;
  const isLive = current.id === liveItem?.id;
  const settled = sync.loaded && sync.saved && !sync.saveError && !sync.loadError;
  const locked = !settled || busy;
  // Even the live editor is ID-scoped: a delayed save from another tab must
  // keep editing its original HQ after someone activates a different one.
  const profileUrl = `/api/hq/configurations/${encodeURIComponent(current.id)}/profile`;

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }
  function applyWorkspace(w: HqConfigurationWorkspace) {
    queryClient.setQueryData(["hq-configurations", user?.id ?? "signed-out"], w);
  }
  function openDialog(kind: "new" | "rename") {
    setError("");
    setNameDraft(kind === "rename" ? current.name : "");
    setCopyFrom(BLANK);
    setDialog(kind);
  }
  function switchTo(id: string) {
    if (locked || id === currentId) return;
    setSync({ loaded: false, saved: false, saveError: "", loadError: false });
    setSelectedId(id);
  }

  const create = () => run(async () => {
    const name = nameDraft.trim();
    if (!name) throw new Error("Name is required");
    const body: { name: string; copyFromId?: string } = { name };
    if (copyFrom !== BLANK) body.copyFromId = copyFrom;
    const before = new Set(ws.items.map(i => i.id));
    const w = await request("/api/hq/configurations", { method: "POST", body: JSON.stringify(body) });
    applyWorkspace(w);
    const added = w.items.find(i => !before.has(i.id));
    setDialog(null);
    if (added) { setSync({ loaded: false, saved: false, saveError: "", loadError: false }); setSelectedId(added.id); }
  });
  const rename = () => run(async () => {
    const name = nameDraft.trim();
    if (!name) throw new Error("Name is required");
    applyWorkspace(await request(`/api/hq/configurations/${encodeURIComponent(current.id)}`, { method: "PATCH", body: JSON.stringify({ name }) }));
    setDialog(null);
  });
  const remove = () => run(async () => {
    if (isLive) throw new Error("The live HQ can't be deleted");
    applyWorkspace(await request(`/api/hq/configurations/${encodeURIComponent(current.id)}`, { method: "DELETE" }));
    setDialog(null);
    setSync({ loaded: false, saved: false, saveError: "", loadError: false });
    setSelectedId(null);
  });
  const activate = () => run(async () => {
    const w = await request(`/api/hq/configurations/${encodeURIComponent(current.id)}/activate`, {
      method: "POST", body: JSON.stringify({ expectedLiveId: ws.liveId }),
    });
    try { localStorage.removeItem(DNA_STORAGE_KEY); } catch { /* server is authoritative */ }
    invalidateCompetitorCache();
    queryClient.setQueryData(["hq-configurations", user?.id ?? "signed-out"], w);
    void queryClient.invalidateQueries();
    setDialog(null);
    setSync({ loaded: false, saved: false, saveError: "", loadError: false });
    setSelectedId(w.liveId ?? current.id);
    setEpoch(e => e + 1);
  });

  const statusText = !sync.loaded ? (sync.loadError ? "Load failed" : "Loading…")
    : sync.saveError ? sync.saveError : sync.saved ? "All changes saved" : "Saving…";

  const toolbar = (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-card px-4 py-3" data-testid="hq-configurations">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56 max-w-full">
          <Select value={currentId} onValueChange={switchTo} disabled={locked}>
            <SelectTrigger aria-label="HQ configuration" className="bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ws.items.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.name}{i.id === liveItem?.id ? " — LIVE" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLive && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-bold tracking-wide text-white dark:bg-emerald-600">
            <Radio className="h-3 w-3" />LIVE
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className={btnOutline} disabled={locked} onClick={() => openDialog("new")}><Plus className="h-3.5 w-3.5" />New HQ</button>
          <button className={btnOutline} disabled={locked} onClick={() => openDialog("rename")}><Pencil className="h-3.5 w-3.5" />Rename</button>
          {!isLive && (
            <>
              <button className={btnOutline} disabled={locked} onClick={() => { setError(""); setDialog("delete"); }}><Trash2 className="h-3.5 w-3.5" />Delete</button>
              <button className={btnLive} disabled={locked} onClick={() => { setError(""); setDialog("live"); }}><Radio className="h-3.5 w-3.5" />Make Live</button>
            </>
          )}
        </div>
      </div>
      {!isLive && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300" role="status">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Editing draft — platform uses {liveItem?.name ?? "the live HQ"}. Drafts never go live until you press Make Live.
        </p>
      )}
      <p className={cn("text-[11px]", sync.saveError || sync.loadError ? "text-destructive" : "text-muted-foreground")} role={sync.saveError ? "alert" : "status"}>
        {statusText}{!settled && !sync.loadError && !sync.saveError ? " — switching is disabled until saved." : ""}
        {sync.saveError ? " Fix the save error before switching." : ""}
      </p>
      {error && !dialog && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );

  return (
    <>
      <HQEditor
        key={`${current.id}:${epoch}`}
        profileUrl={profileUrl}
        live={isLive}
        onSaveStateChange={onState}
        toolbar={toolbar}
      />

      <Dialog open={dialog === "new" || dialog === "rename"} onOpenChange={o => { if (!o && !busy) setDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogTitle>{dialog === "rename" ? "Rename HQ" : "New HQ"}</DialogTitle>
          <DialogDescription>
            {dialog === "rename" ? "Names are labels only; nothing goes live." : "Created as a draft. The platform keeps using the live HQ."}
          </DialogDescription>
          <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void (dialog === "rename" ? rename() : create()); }}>
            <input
              autoFocus
              value={nameDraft}
              maxLength={80}
              onChange={e => setNameDraft(e.target.value)}
              placeholder="HQ name"
              aria-label="HQ name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            {dialog === "new" && (
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger aria-label="Start from" className="bg-background text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={BLANK}>Start blank</SelectItem>
                  {ws.items.map(i => <SelectItem key={i.id} value={i.id}>Copy of {i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={btnOutline} disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className={btnPrimary} disabled={busy || !nameDraft.trim()}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{dialog === "rename" ? "Save name" : "Create HQ"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={o => { if (!o && !busy) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete “{current.name}”?</AlertDialogTitle>
          <AlertDialogDescription>This draft will be removed permanently. The live HQ is not affected.</AlertDialogDescription>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnOutline} disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
            <button className={btnDanger} disabled={busy} onClick={() => void remove()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Delete HQ
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "live"} onOpenChange={o => { if (!o && !busy) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>Make “{current.name}” live?</AlertDialogTitle>
          <AlertDialogDescription>
            The platform will switch from {liveItem?.name ?? "the current HQ"} to {current.name} for voice, audiences and every consumer. Nothing else changes.
          </AlertDialogDescription>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnOutline} disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
            <button className={btnLive} disabled={busy} onClick={() => void activate()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Make Live
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
