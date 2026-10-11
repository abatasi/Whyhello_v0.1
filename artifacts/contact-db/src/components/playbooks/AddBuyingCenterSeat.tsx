import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { BUYING_CENTER_SEATS, type SeatWorkflow } from "./contact-mode-model";
import { buyingCenterIcon } from "./buying-center-icons";
import { PlaybookDialog } from "./PlaybookDialog";
import { useToast } from "@/hooks/use-toast";

export function AddBuyingCenterSeat({ selectedSeats, onAdd, onClose, converting = false }: {
  selectedSeats: string[]; onAdd: (seats: string[]) => Promise<boolean>; onClose: () => void; converting?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const available = BUYING_CENTER_SEATS.filter(seat => !selectedSeats.includes(seat));
  async function add() {
    if (!selected.length || pending || !selected.every(seat => available.includes(seat as typeof BUYING_CENTER_SEATS[number]))) return;
    setPending(true);
    try { if (await onAdd(selected)) onClose(); }
    catch (error) { toast({ title: "Seats could not be added", description: error instanceof Error ? error.message : "Retry adding these seats.", variant: "destructive" }); }
    finally { setPending(false); }
  }
  return <PlaybookDialog title="Add Buying Center seat" description={converting
    ? "Your existing sequence becomes Business Champion's sequence. Choose one or more additional seats to make this a Multi-Contact Playbook."
    : "Choose one or more unselected seats. Each will have its own independent, empty sequence."} onClose={() => { if (!pending) onClose(); }}>
    <div className="space-y-3 px-5 pb-5 pt-3">
      <div className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2" role="group" aria-label="Available Buying Center seats">
        {available.map(seat => {
          const Icon = buyingCenterIcon(seat);
          return <button key={seat} type="button" aria-pressed={selected.includes(seat)} disabled={pending}
            data-testid={`choose-bc-seat-${seat.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => setSelected(current => current.includes(seat) ? current.filter(value => value !== seat) : [...current, seat])}
            className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-xs font-semibold disabled:opacity-50 ${selected.includes(seat) ? "border-primary bg-primary text-white" : "border-border bg-background text-foreground hover:bg-muted"}`}>
            <Icon size={14} className="shrink-0" aria-hidden="true" /><span className="flex-1">{seat}</span>{selected.includes(seat) && <Check size={12} />}
          </button>;
        })}
      </div>
      {!available.length && <p className="text-xs text-muted-foreground">All Buying Center seats are already included.</p>}
      <p className="text-xs text-muted-foreground">Most playbooks target 2–4 seats. Assign the new seat a contact from the playbook's company.</p>
      <div className="flex justify-end gap-2">
        <button type="button" disabled={pending} onClick={onClose} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Cancel</button>
        <button type="button" data-testid="button-confirm-add-bc-seat" disabled={!selected.length || pending || !selected.every(seat => available.includes(seat as typeof BUYING_CENTER_SEATS[number]))} onClick={() => void add()} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-45"><Plus size={14} />{pending ? "Adding…" : selected.length > 1 ? `Add ${selected.length} seats` : "Add seat"}</button>
      </div>
    </div>
  </PlaybookDialog>;
}

export function SingleSeatNavigation({ flush, snapshot, onAdd, disabled }: {
  flush: () => Promise<boolean>; snapshot: () => SeatWorkflow;
  onAdd: (workflow: SeatWorkflow, seats: string[]) => Promise<boolean>; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const Icon = buyingCenterIcon("Business Champion");
  return <>
    <div className="flex min-w-0 items-center gap-2">
      <div role="tablist" aria-label="Buying Center seats" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <button type="button" role="tab" aria-selected="true" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white"><Icon size={12} aria-hidden="true" />Business Champion<span className="text-[10px] opacity-80">Lead</span></button>
      <button type="button" aria-label="Add Buying Center seat" data-testid="button-add-bc-seat" disabled={disabled} onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center rounded-md border border-border p-2 disabled:opacity-45"><Plus size={14} /></button>
      </div>
    </div>
    {open && <AddBuyingCenterSeat selectedSeats={["Business Champion"]} converting onClose={() => setOpen(false)} onAdd={async seat => {
      if (disabled) return false;
      if (!await flush()) { toast({ title: "Changes haven't synced", description: "Retry auto-save before adding a seat.", variant: "destructive" }); return false; }
      return onAdd(snapshot(), seat);
    }} />}
  </>;
}
