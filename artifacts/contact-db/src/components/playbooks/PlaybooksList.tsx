import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle, BarChart3, BookOpen, ChevronLeft, ChevronRight, ClipboardList,
  Info, Loader2, Plus, ShieldAlert, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlaybookDialog } from "./PlaybookDialog";
import { PlaybookCreationChoice } from "./PlaybookCreationChoice";
import { PlaybooksTable } from "./PlaybooksTable";
import { PlaybooksToolbar } from "./PlaybooksToolbar";
import { createPlaybookRecord, duplicatePlaybookRecord, playbookRequest } from "./list-api";
import { copyConfig, DEFAULT_VIEW, filterPlaybooks, type PlaybookRecord, type ViewConfig } from "./list-model";
import { usePlaybookViews, type SavedView } from "./use-playbook-views";
import "./playbooks-list.css";

export function PlaybooksList({ onTemplates }: {
  onTemplates: () => void;
}) {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const saved = usePlaybookViews(user?.id ?? "");
  const [config, setConfig] = useState<ViewConfig>(() => copyConfig(DEFAULT_VIEW));
  const restoredOwner = useRef("");
  const [tab, setTab] = useState<"all" | "analytics" | "diagnostics">("all");
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [showMailbox, setShowMailbox] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"" | "chooseCreate" | "create" | "saveView" | "renameView" | "rename">("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [pending, setPending] = useState<{ action: string; ids: number[] } | null>(null);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    restoredOwner.current = "";
    setConfig(copyConfig(DEFAULT_VIEW)); setSelected([]); setPage(1);
  }, [user?.id]);
  useEffect(() => {
    const snapshot = `${user?.id}:${saved.selected}`;
    if (saved.ready && user?.id && restoredOwner.current !== snapshot) {
      setConfig(saved.initialConfig); restoredOwner.current = snapshot;
    }
  }, [saved.ready, saved.selected, user?.id]);
  const creator = user?.fullName || user?.firstName || "You";
  const initials = creator.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase();
  const records = useQuery<PlaybookRecord[]>({
    queryKey: ["playbooks", user?.id],
    queryFn: async () => {
      const rows = await playbookRequest<PlaybookRecord[]>("/api/playbooks");
      if (!Array.isArray(rows)) throw new Error("The playbooks response could not be read.");
      return rows;
    },
    enabled: !!user?.id, refetchOnMount: "always", refetchInterval: 30000, staleTime: 10000,
  });
  const accounts = useQuery<unknown[]>({
    queryKey: ["email-accounts", user?.id],
    queryFn: async () => {
      const result = await playbookRequest<unknown[]>("/api/email-accounts");
      if (!Array.isArray(result)) throw new Error("Mailboxes could not be read.");
      return result;
    },
    enabled: !!user?.id, staleTime: 30000,
  });
  const rows = records.data ?? [];
  const filtered = useMemo(() => filterPlaybooks(rows, config, creator), [records.data, config, creator]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); setSelected([]); }, [config.query, config.statuses, config.creators, config.dateRange, config.sort, config.direction, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  useEffect(() => { setSelected(old => old.filter(id => records.data?.some(row => row.id === id))); }, [records.data]);
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : "The action failed. Please try again.";
  const reportError = (error: unknown) => toast({ title: "Unable to complete action", description: errorMessage(error), variant: "destructive" });
  const editLocalView = (operation: () => void) => { try { operation(); } catch (error) { reportError(error); } };
  const chooseView = (id: string) => editLocalView(() => {
    saved.select(id);
    setConfig(copyConfig(saved.views.find(view => view.id === id)?.config ?? DEFAULT_VIEW));
    setFiltersOpen(false); setSelected([]); setPage(1);
  });
  const openCreate = () => { setFormError(""); setDialog("chooseCreate"); };
  const openScratch = () => { setName(""); setDescription(""); setFormError(""); setDialog("create"); };
  const closeDialog = () => { if (!busy) { setDialog(""); setFormError(""); } };
  const rowAction = (action: string, row: PlaybookRecord) => {
    setFormError("");
    if (action === "Edit") { navigate(`/playbooks/${row.id}`); return; }
    if (action === "Analytics") { setAnalyticsId(row.id); setTab("analytics"); return; }
    if (action === "Rename") { setEditingId(row.id); setName(row.name); setDialog("rename"); return; }
    setPending({ action, ids: [row.id] });
  };
  const submitForm = async () => {
    if (!name.trim() || busy) return;
    setFormError("");
    if (dialog === "saveView" || dialog === "renameView") {
      try {
        if (dialog === "saveView") saved.save(name, config);
        else if (editingView) saved.rename(editingView.id, name);
        setDialog(""); toast({ title: "View saved", description: "Private to your account in this browser." });
      } catch (error) { setFormError(errorMessage(error)); }
      return;
    }
    setBusy(true);
    try {
      if (dialog === "rename" && editingId !== null) {
        await playbookRequest(`/api/playbooks/${editingId}`, "PATCH", { name: name.trim() });
        await qc.invalidateQueries({ queryKey: ["playbooks"] });
        setDialog(""); toast({ title: "Playbook renamed" });
      } else {
        const created = await createPlaybookRecord(name, description.trim() || undefined);
        await qc.invalidateQueries({ queryKey: ["playbooks"] });
        navigate(`/playbooks/${created.id}`);
      }
    } catch (error) { setFormError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const perform = async () => {
    if (!pending || busy) return;
    setBusy(true); setFormError("");
    const succeeded: number[] = [], failed: number[] = [];
    let skipped = 0, detail = "";
    for (const id of pending.ids) {
      const row = rows.find(record => record.id === id);
      if (!row) { skipped++; continue; }
      if ((pending.action === "Activate" || pending.action === "Pause") && ["archived", "completed"].includes(row.status)) { skipped++; continue; }
      try {
        if (pending.action === "Duplicate") await duplicatePlaybookRecord(row);
        else if (pending.action === "Delete") {
          await playbookRequest(`/api/playbooks/${id}`, "DELETE");
          try {
            localStorage.removeItem(`playbook_canvas_${id}`);
            localStorage.removeItem(`playbook_canvas_v3_${id}`);
          } catch { toast({ title: "Deleted from server", description: "Browser storage is unavailable, so its canvas cache could not be cleared." }); }
        } else {
          const status = pending.action === "Activate" ? "active" : pending.action === "Pause" ? "paused" : "archived";
          await playbookRequest(`/api/playbooks/${id}`, "PATCH", { status });
        }
        succeeded.push(id);
      } catch (error) { failed.push(id); detail = errorMessage(error); }
    }
    await qc.invalidateQueries({ queryKey: ["playbooks"] });
    setSelected(old => old.filter(id => !succeeded.includes(id)));
    setBusy(false);
    if (failed.length) {
      setPending({ ...pending, ids: failed });
      setFormError(`${succeeded.length} succeeded; ${failed.length} failed. ${detail} Retry affects only failed records.`);
    } else {
      setPending(null);
      toast({ title: `${pending.action} complete`, description: `${succeeded.length} playbook${succeeded.length === 1 ? "" : "s"} updated.${skipped ? ` ${skipped} ineligible or unavailable records skipped.` : ""}` });
    }
  };
  const analyticsRows = analyticsId === null ? rows.filter(row => row.status !== "archived") : rows.filter(row => row.id === analyticsId);
  const analyticsTarget = rows.find(row => row.id === analyticsId);
  const total = (key: "enrollmentCount" | "pausedCount" | "finishedCount" | "sentCount") =>
    analyticsRows.some(row => row[key] === undefined) ? "—" : analyticsRows.reduce((sum, row) => sum + (row[key] ?? 0), 0).toLocaleString();
  const closePending = () => { if (!busy) { setPending(null); setFormError(""); } };
  return <div className="playbooks-operational">
    <header className="pb-header">
      <div><h1>Playbooks</h1><p>Build and manage insight-led, multi-touch outreach.</p></div>
      <div className="pb-header-actions"><button className="pb-secondary-button" disabled={busy} onClick={onTemplates}><BookOpen size={15} />Templates</button><button className="pb-primary-button" disabled={busy} onClick={openCreate}><Plus size={16} />Create playbook</button></div>
    </header>
    <nav className="pb-tabs" aria-label="Playbook sections">
      {([["all", "All Playbooks", ClipboardList], ["analytics", "Analytics", BarChart3], ["diagnostics", "Diagnostics", ShieldAlert]] as const).map(([id, label, Icon]) => <button key={id} className={tab === id ? "is-selected" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { if (id === "analytics") setAnalyticsId(null); setTab(id); }}><Icon size={15} />{label}{id === "all" && <span>{records.isLoading ? "…" : rows.filter(row => row.status !== "archived").length}</span>}</button>)}
    </nav>
    <section className="pb-banners" aria-label="Playbook information">
      {showInfo && <div className="pb-banner pb-info"><Info size={17} /><div><strong>Your playbooks, connected to live data</strong><span>Activation changes status only; it does not send messages. Unrecorded metrics appear as a dash.</span></div><button aria-label="Dismiss information" onClick={() => setShowInfo(false)}><X size={15} /></button></div>}
      {showMailbox && accounts.isSuccess && accounts.data.length === 0 && <div className="pb-banner pb-warning"><AlertTriangle size={17} /><div><strong>No mailbox is linked.</strong> Connect your email account before sending outreach.</div><button className="pb-inline-link" onClick={() => navigate("/settings")}>Link mailbox <ChevronRight size={14} /></button><button aria-label="Dismiss mailbox warning" onClick={() => setShowMailbox(false)}><X size={15} /></button></div>}
      {saved.storageError && <div className="pb-error" role="alert">{saved.storageError}</div>}
      {records.isError && <div className="pb-error" role="alert">{errorMessage(records.error)}<button onClick={() => records.refetch()}>Retry</button></div>}
    </section>
    {tab === "all" && <>
      <PlaybooksToolbar config={config} setConfig={setConfig} views={saved.views} selectedView={saved.selected} selectedCount={selected.length} filtersOpen={filtersOpen} onFilters={() => setFiltersOpen(old => !old)} busy={busy}
        onSelectView={chooseView} onSave={() => { setName(""); setFormError(""); setDialog("saveView"); }}
        onRename={view => { setEditingView(view); setName(view.name); setFormError(""); setDialog("renameView"); }}
        onDuplicateView={id => editLocalView(() => saved.duplicate(id))}
        onDeleteView={id => editLocalView(() => { saved.remove(id); if (saved.selected === id) setConfig(copyConfig(DEFAULT_VIEW)); })}
        onBulk={action => { setFormError(""); setPending({ action, ids: [...selected] }); }} onClearSelection={() => setSelected([])} />
      {records.isLoading ? <div className="pb-skeleton" role="status" aria-label="Loading playbooks">{Array.from({ length: 6 }, (_, index) => <div key={index} />)}</div> : !records.isError && filtered.length === 0 ? <div className="pb-empty">
        <ClipboardList size={24} /><h2>{rows.length ? "No playbooks match your search or filters." : "No playbooks yet"}</h2><p>{rows.length ? "Try changing your search, filters or saved view." : "Create a playbook from scratch or start with a proven template."}</p>
        {rows.length ? <button className="pb-secondary-button" onClick={() => chooseView("all")}>Clear search and filters</button> : <button className="pb-primary-button" onClick={openCreate}><Plus size={16} />Create playbook</button>}
      </div> : !records.isError && <PlaybooksTable rows={visible} config={config} selected={selected} busy={busy} creator={creator} initials={initials} onAction={rowAction}
        onSelect={id => setSelected(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id])}
        onSelectVisible={checked => setSelected(old => checked ? [...new Set([...old, ...visible.map(row => row.id)])] : old.filter(id => !visible.some(row => row.id === id)))} />}
      {!records.isLoading && !records.isError && <footer className="pb-table-foot"><span>Showing <b>{filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)}</b> of <b>{filtered.length}</b> playbooks</span><div><button disabled={page <= 1} aria-label="Previous page" onClick={() => setPage(old => old - 1)}><ChevronLeft size={15} /></button><span>{page} / {pages}</span><button disabled={page >= pages} aria-label="Next page" onClick={() => setPage(old => old + 1)}><ChevronRight size={15} /></button><label>Rows per page <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}><option>10</option><option>25</option><option>50</option><option>100</option></select></label></div></footer>}
    </>}
    {tab === "analytics" && !records.isError && <section className="pb-secondary-page">
      <div className="pb-section-heading"><div><h2>{analyticsTarget?.name ?? "Workspace analytics"}</h2><p>Recorded playbook activity; sent does not imply delivered.</p></div>{analyticsId !== null && <button className="pb-secondary-button" onClick={() => setAnalyticsId(null)}>All playbooks</button>}</div>
      {records.isLoading ? <div className="pb-skeleton" aria-label="Loading analytics"><div /></div> : <>
        <div className="pb-stat-grid">{[["Active enrollments", total("enrollmentCount")], ["Paused enrollments", total("pausedCount")], ["Finished enrollments", total("finishedCount")], ["Emails sent", total("sentCount")]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <p className="pb-helper">Delivery, bounce, spam and reply rates are unavailable until those outcomes are recorded for playbooks.</p>
        <div className="pb-analytics-list">{analyticsRows.map(row => <div key={row.id}><button onClick={() => navigate(`/playbooks/${row.id}`)}>{row.name}</button><span>{row.enrollmentCount} active</span><span>{row.sentCount?.toLocaleString() ?? "—"} sent</span><span>{row.finishedCount?.toLocaleString() ?? "—"} finished</span></div>)}</div>
        {!analyticsRows.length && <p className="pb-helper">No playbook activity to show yet.</p>}
      </>}
    </section>}
    {tab === "diagnostics" && <section className="pb-secondary-page">
      <h2>Diagnostics</h2><p className="pb-helper">Review setup and playbook state. Delivery health is not inferred from missing data.</p>
      <div className="pb-diagnostic"><Info size={18} /><div><strong>Linked mailboxes</strong><p>{accounts.isLoading ? "Checking mailbox connections…" : accounts.isError ? "Mailbox connections could not be checked." : `${accounts.data?.length ?? 0} linked mailbox${accounts.data?.length === 1 ? "" : "es"}`}</p></div><button className="pb-secondary-button" onClick={() => navigate("/settings")}>Email settings</button></div>
      {rows.filter(row => row.status === "paused").map(row => <div className="pb-diagnostic" key={row.id}><ShieldAlert size={18} /><div><strong>{row.name}</strong><p>Playbook status is paused.</p></div><button className="pb-secondary-button" onClick={() => navigate(`/playbooks/${row.id}`)}>Review playbook</button></div>)}
      <div className="pb-diagnostic"><BarChart3 size={18} /><div><strong>Delivery and reply monitoring</strong><p>These outcomes are not recorded by the current playbook API. No health score is fabricated.</p></div></div>
    </section>}
    {dialog === "chooseCreate" && <PlaybookCreationChoice onClose={closeDialog} onScratch={openScratch} onTemplate={() => { setDialog(""); onTemplates(); }} />}
    {dialog && dialog !== "chooseCreate" && <PlaybookDialog title={dialog === "create" ? "Build from scratch" : dialog === "rename" ? "Rename playbook" : dialog === "saveView" ? "Save as new view" : "Rename view"}
      description={dialog === "create" ? "Start as a draft, then build your outreach workflow." : dialog === "rename" ? "Change the name without changing its canvas or enrollments." : "Views save search, filters, sorting, columns and density. Private to your account in this browser."} onClose={closeDialog} busy={busy}>
      <form className="pb-form" onSubmit={event => { event.preventDefault(); void submitForm(); }}>
        <label>{dialog === "create" || dialog === "rename" ? "Playbook name" : "View name"}<input autoFocus required maxLength={255} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
        {dialog === "create" && <label>Optional description<textarea value={description} onChange={event => setDescription(event.target.value)} disabled={busy} rows={3} /><small>The canvas builder replaces this note with its saved workflow.</small></label>}
        {formError && <div className="pb-error" role="alert">{formError}</div>}
        <div className="pb-dialog-actions"><button type="button" className="pb-secondary-button" disabled={busy} onClick={closeDialog}>Cancel</button><button className="pb-primary-button" disabled={!name.trim() || busy}>{busy && <Loader2 size={15} className="animate-spin" />}{dialog === "create" ? "Create playbook" : "Save"}</button></div>
      </form>
    </PlaybookDialog>}
    {pending && <PlaybookDialog title={`${pending.action} ${pending.ids.length === 1 ? "playbook" : `${pending.ids.length} playbooks`}?`} busy={busy} onClose={closePending}
      description={pending.action === "Delete" ? "Permanently remove the selected playbooks and their stored steps and enrollments. This cannot be undone." : pending.action === "Duplicate" ? "Create draft copies of their workflows and saved steps, without enrollments, attached contacts or message history." : pending.action === "Archive" ? "Archive these playbooks and remove them from the default view. Find them later using the Archived status filter." : "Change the playbook status only. This action does not send messages. Completed and archived playbooks are skipped."}>
      {formError && <div className="pb-error mx-5" role="alert">{formError}</div>}
      <div className="pb-dialog-actions pb-confirm-actions"><button className="pb-secondary-button" onClick={closePending} disabled={busy}>Cancel</button><button className={pending.action === "Delete" ? "pb-danger-button" : "pb-primary-button"} disabled={busy} onClick={() => void perform()}>{busy && <Loader2 size={15} className="animate-spin" />}{formError ? "Retry failed records" : pending.action}</button></div>
    </PlaybookDialog>}
  </div>;
}