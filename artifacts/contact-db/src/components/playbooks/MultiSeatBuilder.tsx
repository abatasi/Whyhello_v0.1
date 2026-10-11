import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { buyingCenterIcon } from "./buying-center-icons";
import { AddBuyingCenterSeat } from "./AddBuyingCenterSeat";
import { PlaybookDialog } from "./PlaybookDialog";
import { playbookRequest } from "./list-api";
import { BUYING_CENTER_SEATS, appendBuyingCenterSeats, clearRecipientPreviews, readMultiContactDocument, updateSeatWorkflow, type MultiContactDocument, type SeatWorkflow } from "./contact-mode-model";
import { MultiContactAssignments } from "./MultiContactAssignments";
import { SampleCompanyContacts } from "./SampleCompanyContacts";
import type { GetPlaybookSampleContacts200 } from "@workspace/api-client-react";
import { chooseSampleCompany, chooseSampleContact, populateAddedSamples, sampleViewFor } from "./sample-view-model";
import { PlaybookSeatBusy, PlaybookSeatRecipient, PlaybookSeatIdentity } from "./PlaybookSeatContext";
import { usePlaybookConfirm } from "./PlaybookConfirmProvider";
import { useToast } from "@/hooks/use-toast";

type Contact = { id: number; firstName: string; lastName: string; companyId: number | null; jobTitle?: string | null };
function SeatTabList({ activeId, children }: { activeId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    const selected = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (container && selected) container.scrollLeft = Math.max(0, selected.offsetLeft - (container.clientWidth - selected.offsetWidth) / 2);
  }, [activeId]);
  return <div ref={ref} role="tablist" aria-label="Buying Center seats" className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">{children}</div>;
}
export type SeatBuilderProps = {
  seatId: string; workflow: SeatWorkflow; contactId: number | null;
  navigation: (flush: () => Promise<boolean>) => ReactNode;
  save: (workflow: SeatWorkflow) => Promise<boolean>;
  activationReason?: string; saveStatus?: string; saveError: boolean; retry: () => void; contacts: () => void;
};
export function MultiSeatBuilder({ id, status, initial, primaryLaneId, persist, render, initialSeatName }: {
  id: number; status: string; initial: MultiContactDocument; primaryLaneId: string;
  persist: (raw: string) => Promise<boolean>; render: (props: SeatBuilderProps) => ReactNode; initialSeatName?: string;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirm = usePlaybookConfirm();
  const key = `playbook_multi_v1_${user?.id}_${id}`;
  const baseline = useRef(JSON.stringify(initial));
  const [document, setDocument] = useState(() => {
    if (["active", "archived", "completed"].includes(status)) return initial;
    try {
      if (localStorage.getItem(key + "_baseline") === baseline.current) return readMultiContactDocument(localStorage.getItem(key)) ?? initial;
    } catch { /* Server remains authoritative if browser storage is unavailable. */ }
    return initial;
  });
  const latest = useRef(document);
  const tail = useRef<Promise<boolean>>(Promise.resolve(true));
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const [activeId, setActiveId] = useState(document.seatSequences.find(seat => seat.name === initialSeatName)?.id ?? document.seatSequences[0].id);
  const [addingSeat, setAddingSeat] = useState(false);
  const [editingContacts, setEditingContacts] = useState(false);
  const [editingSample, setEditingSample] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string>();
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(0);
  const reportBusy = useCallback((delta: number) => setBusy(count => Math.max(0, count + delta)), []);
  const [failed, setFailed] = useState(JSON.stringify(document) !== baseline.current);
  const readOnly = ["active", "archived", "completed"].includes(status);
  const sample = sampleViewFor(document);
  const sampleContactId = sample.contactIds[activeId] ?? null;
  const companies = useQuery({
    queryKey: ["playbook-companies", user?.id], enabled: !!user,
    queryFn: async () => {
      const rows: { id: number; name: string }[] = [];
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        const result = await playbookRequest<{ data: { id: number; name: string }[]; totalPages: number }>(`/api/companies?limit=100&page=${page}`);
        if (!Array.isArray(result.data)) throw new Error("Companies could not be read.");
        rows.push(...result.data); pages = result.totalPages || 1;
      }
      return rows;
    },
  });
  const contacts = useQuery({
    queryKey: ["playbook-seat-contacts", user?.id, document.companyId], enabled: !!user && !!document.companyId,
    queryFn: async () => {
      const rows: Contact[] = [];
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        const result = await playbookRequest<{ data: Contact[]; totalPages: number }>(`/api/contacts?companyId=${document.companyId}&limit=100&page=${page}`);
        if (!Array.isArray(result.data)) throw new Error("Company contacts could not be read.");
        rows.push(...result.data); pages = result.totalPages || 1;
      }
      return rows;
    },
  });
  const sampleContacts = useQuery({
    queryKey: ["playbook-sample-contacts", user?.id, id, sample.companyId, document.buyingCenterId],
    enabled: !!user && !!sample.companyId,
    queryFn: () => playbookRequest<GetPlaybookSampleContacts200>(`/api/playbooks/${id}/sample-contacts/${sample.companyId}`),
    staleTime: 30_000,
  });
  function queue(next: MultiContactDocument) {
    latest.current = next; setDocument(next); setPending(count => count + 1);
    try { localStorage.setItem(key, JSON.stringify(next)); localStorage.setItem(key + "_baseline", baseline.current); } catch { /* Failure stays explicit below. */ }
    const raw = JSON.stringify(next);
    const job = tail.current.catch(() => false).then(() => persist(raw)).then(ok => {
      setFailed(!ok);
      if (ok) {
        baseline.current = raw;
        try {
          if (JSON.stringify(latest.current) === raw) { localStorage.removeItem(key); localStorage.removeItem(key + "_baseline"); }
          else localStorage.setItem(key + "_baseline", raw);
        } catch { /* Server acknowledgement is still valid. */ }
      }
      return ok;
    }).catch(() => { setFailed(true); return false; }).finally(() => setPending(count => count - 1));
    tail.current = job;
    return job;
  }
  useEffect(() => {
    if (!readOnly && JSON.stringify(latest.current) !== baseline.current) void queue(latest.current);
  }, []);
  const seat = document.seatSequences.find(item => item.id === activeId)!;
  async function guarded(action: () => void | Promise<unknown>) {
    if (busy) { toast({ title: "Generation in progress", description: "Wait for the preview to finish before changing seats or contacts." }); return; }
    if (!await flushRef.current() || !await tail.current) {
      toast({ title: "Changes haven't synced", description: "Retry auto-save before changing seats or contacts.", variant: "destructive" }); return;
    }
    await action();
  }
  async function assignContact(seatId: string, contactId: number | null) {
    await guarded(async () => {
      const next = structuredClone(latest.current);
      const target = next.seatSequences.find(item => item.id === seatId)!;
      const contact = contacts.data?.find(item => item.id === contactId);
      if (contactId && (!contact || contact.companyId !== next.companyId || next.seatSequences.some(item => item.id !== seatId && item.contactId === contactId))) return;
      target.contactId = contactId;
      target.workflow.prospects = [{ laneId: primaryLaneId, isPrimary: true, cascadeEnabled: true,
        ...(contact ? { contactId: contact.id, contactName: `${contact.firstName} ${contact.lastName}` } : {}) }];
      target.workflow.nodes = target.workflow.nodes.map(node => {
        const data = { ...clearRecipientPreviews(node).data };
        if (data.blockType === "prospect-added") { data.contactId = contactId ?? undefined; data.contactName = contact ? `${contact.firstName} ${contact.lastName}` : undefined; }
        return { ...node, data };
      });
      if (await queue(updateSeatWorkflow(next, seatId, target.workflow))) await queryClient.invalidateQueries({ predicate: query => query.queryKey.includes(id) });
    });
  }
  const incomplete = document.seatSequences.some(item => !item.workflow.nodes.some(node => !["placeholder", "prospect-added", "trigger-detected", "added-to-playbook"].includes(String(node.data.blockType)))) ? "Build a sequence for every selected Buying Center seat."
    : failed || pending ? "Wait for all company and seat changes to sync." : undefined;
  const navigation = (flush: () => Promise<boolean>) => {
    flushRef.current = flush;
    return <div className="flex min-w-0 flex-1 items-center gap-2">
      <SeatTabList activeId={activeId}>
        {document.seatSequences.map(item => { const Icon = buyingCenterIcon(item.name); return <button key={item.id} type="button" role="tab" aria-selected={activeId === item.id} data-testid={`tab-bc-${item.id}`} onClick={() => void guarded(() => setActiveId(item.id))}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${activeId === item.id ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
          <Icon size={12} aria-hidden="true" />{item.name}{item.name === "Business Champion" && <span className="text-[10px] opacity-80">Lead</span>}
        </button>; })}
      <button type="button" aria-label="Add Buying Center seat" data-testid="button-add-bc-seat" disabled={readOnly || !!busy || !!pending || failed || BUYING_CENTER_SEATS.every(name => document.seatSequences.some(seat => seat.name === name))}
        onClick={() => void guarded(() => setAddingSeat(true))} className="inline-flex shrink-0 items-center rounded-md border border-border p-2 disabled:opacity-45"><Plus size={14} /></button>
      </SeatTabList>
      <button type="button" aria-label="Company & contacts" data-testid="button-company-seats" onClick={() => void guarded(() => setEditingSample(true))} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-semibold"><Users size={14} /><span className="hidden sm:inline">Company & contacts</span></button>
    </div>;
  };
  return <>
    {addingSeat && <AddBuyingCenterSeat selectedSeats={document.seatSequences.map(seat => seat.name)} onClose={() => setAddingSeat(false)} onAdd={async names => {
      let added = false;
      await guarded(async () => {
        if (readOnly) return;
        const firstAdded = latest.current.seatSequences.length;
        const next = populateAddedSamples(appendBuyingCenterSeats(latest.current, names), sampleContacts.data?.contacts ?? []);
        await queue(next);
        setActiveId(next.seatSequences[firstAdded].id);
        added = true;
      });
      return added;
    }} />}
    <PlaybookSeatBusy.Provider value={reportBusy}><PlaybookSeatIdentity.Provider value={seat.id}><PlaybookSeatRecipient.Provider value={sampleContactId}>
      {render({ seatId: `${seat.id}:${sampleContactId ?? "unassigned"}:${sample.companyId ?? "none"}:${seat.contactId}:${document.companyId}`, workflow: seat.workflow, contactId: sampleContactId, navigation,
        save: workflow => queue(updateSeatWorkflow(latest.current, activeId, workflow)),
        activationReason: incomplete, saveStatus: failed ? "Company / seat changes not saved" : pending ? "Saving changes…" : undefined,
        saveError: failed, retry: () => { void queue(latest.current); }, contacts: () => setEditingContacts(true) })}
    </PlaybookSeatRecipient.Provider></PlaybookSeatIdentity.Provider></PlaybookSeatBusy.Provider>
    {editingSample && <PlaybookDialog title="Company & Contacts" description="Choose preview samples for each seat. Changing samples clears older recipient-specific previews, not your steps, templates or context." busy={pending > 0 || sampleLoading} onClose={() => setEditingSample(false)}>
      <SampleCompanyContacts companyId={sample.companyId} companies={companies.data ?? []} contacts={sampleContacts.data?.contacts ?? []}
        seats={document.seatSequences} contactIds={sample.contactIds} manualSeatIds={sample.manualSeatIds}
        criteriaName={sampleContacts.data?.criteriaName} readOnly={readOnly}
        loading={companies.isLoading || sampleContacts.isLoading || sampleLoading} saving={pending > 0}
        error={sampleError ?? (companies.error instanceof Error ? companies.error.message : sampleContacts.error instanceof Error ? sampleContacts.error.message : undefined)}
        onCompany={companyId => void guarded(async () => {
          if (readOnly) return;
          setSampleLoading(true); setSampleError(undefined);
          try {
            const result = companyId === null ? { contacts: [], criteriaName: null } : await queryClient.fetchQuery({
              queryKey: ["playbook-sample-contacts", user?.id, id, companyId, latest.current.buyingCenterId],
              queryFn: () => playbookRequest<GetPlaybookSampleContacts200>(`/api/playbooks/${id}/sample-contacts/${companyId}`),
              staleTime: 0,
            });
            if (await queue(chooseSampleCompany(latest.current, companyId, result.contacts)))
              await queryClient.invalidateQueries({ predicate: query => query.queryKey.includes(id) });
          } catch (error) { setSampleError(error instanceof Error ? error.message : "Sample contacts could not be loaded."); }
          finally { setSampleLoading(false); }
        })}
        onContact={(seatId, contactId) => void guarded(async () => {
          if (sampleViewFor(latest.current).companyId !== sample.companyId) {
            toast({ title: "Sample company changed", description: "Choose a sample contact from the current company." }); return;
          }
          if (readOnly || !sample.companyId || (contactId !== null && !sampleContacts.data?.contacts.some(contact => contact.id === contactId && contact.companyId === sample.companyId))) return;
          if (await queue(chooseSampleContact(latest.current, seatId, contactId)))
            await queryClient.invalidateQueries({ predicate: query => query.queryKey.includes(id) });
        })} />
      {failed && <p role="alert" className="mx-5 mb-4 text-xs text-destructive">Sample settings haven't saved. <button type="button" className="underline" onClick={() => void queue(latest.current)}>Retry auto-save</button></p>}
      {sampleContacts.isError && <button type="button" onClick={() => void sampleContacts.refetch()} className="mx-5 mb-4 rounded-md border border-border px-3 py-2 text-xs font-semibold">Retry loading sample contacts</button>}
    </PlaybookDialog>}
    {editingContacts && <PlaybookDialog title="Enroll company contacts" description="Actual outreach recipients, separate from sample-preview contacts. Assign one company contact to each seat." onClose={() => setEditingContacts(false)} busy={pending > 0}>
        <MultiContactAssignments companyId={document.companyId} companies={companies.data ?? []} contacts={contacts.data ?? []} seats={document.seatSequences} activeSeatId={activeId} readOnly={readOnly || pending > 0} loading={companies.isLoading || (!!document.companyId && contacts.isLoading)}
          error={companies.isError || contacts.isError ? "Company records couldn't be loaded. Close and reopen to retry." : undefined}
          onContact={(seatId, contactId) => void assignContact(seatId, contactId)}
          onCompany={companyId => void guarded(async () => {
            if (companyId === latest.current.companyId) return;
            if (latest.current.seatSequences.some(item => item.contactId) && !await confirm({ title: "Change company?", description: "This clears the existing contact assignments and previews. Each seat's sequence and settings will remain.", confirmLabel: "Change company", cancelLabel: "Keep company" })) return;
            const next = structuredClone(latest.current); next.companyId = companyId;
            for (const item of next.seatSequences) {
              item.contactId = null; item.workflow.prospects = [];
              item.workflow.nodes = item.workflow.nodes.map(node => ({ ...node, data: { ...clearRecipientPreviews(node).data, contactId: undefined, contactName: undefined } }));
            }
            await queue(updateSeatWorkflow(next, next.seatSequences[0].id, next.seatSequences[0].workflow));
          })} />
        <p className="mt-4 text-xs text-muted-foreground">Each seat has an independent sequence. Switch seat tabs to assign another contact. Assigning contacts does not send messages.</p>
        {failed && <p role="alert" className="mt-3 text-xs text-destructive">Contact assignments haven't saved. <button type="button" className="underline" onClick={() => void queue(latest.current)}>Retry auto-save</button></p>}
        <button type="button" disabled={!document.companyId || document.seatSequences.some(item => !item.contactId) || pending > 0 || failed} onClick={() => void guarded(async () => {
          if (!await confirm({ title: "Enroll these company contacts?", description: "Enroll the contacts assigned to the selected Buying Center seats. This does not send an email or activate the Playbook.", confirmLabel: "Enroll contacts", cancelLabel: "Cancel" })) return;
          try {
            await playbookRequest(`/api/playbooks/${id}/enrollments`, "POST", { contactIds: document.seatSequences.map(item => item.contactId) });
            await Promise.all([queryClient.invalidateQueries({ queryKey: ["playbooks"] }), queryClient.invalidateQueries({ predicate: query => query.queryKey.includes(id) })]);
            toast({ title: "Company contacts enrolled" });
          }
          catch (error) { toast({ title: "Enrollment failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }); }
        })} className="mt-4 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Enroll assigned contacts</button>
    </PlaybookDialog>}
  </>;
}
