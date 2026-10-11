import { Building2, ContactRound, UserRound } from "lucide-react";

type AssignmentCompany = { id: number; name: string };
type AssignmentContact = {
  id: number;
  firstName: string;
  lastName: string;
  companyId: number | null;
  jobTitle?: string | null;
};
type AssignmentSeat = { id: string; name: string; contactId: number | null };

export function MultiContactAssignments({
  companyId,
  companies,
  contacts,
  seats,
  activeSeatId,
  readOnly,
  loading,
  error,
  onCompany,
  onContact,
}: {
  companyId: number | null;
  companies: AssignmentCompany[];
  contacts: AssignmentContact[];
  seats: AssignmentSeat[];
  activeSeatId: string;
  readOnly: boolean;
  loading: boolean;
  error?: string;
  onCompany: (id: number | null) => void;
  onContact: (seatId: string, id: number | null) => void;
}) {
  const activeSeat = seats.find(seat => seat.id === activeSeatId);
  const selectedCompany = companies.find(company => company.id === companyId);
  const activeContact = contacts.find(contact => contact.id === activeSeat?.contactId && contact.companyId === companyId);
  const availableContacts = contacts
    .filter(contact => contact.companyId === companyId)
    .filter(contact => !seats.some(seat => seat.id !== activeSeatId && seat.contactId === contact.id))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const contactName = activeContact ? `${activeContact.firstName} ${activeContact.lastName}`.trim() : "";

  return <section aria-labelledby="multi-contact-assignment-title" className="rounded-md border border-border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary/60 text-muted-foreground"><Building2 size={15} aria-hidden="true" /></span>
        <div>
          <h3 id="multi-contact-assignment-title" className="text-xs font-semibold text-foreground">Buying Center assignments</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Choose a company, then match one contact to each seat. A contact can only fill one seat.</p>
        </div>
      </div>
      {activeSeat && <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-[10px] font-semibold text-foreground">
        {activeSeat.name === "Business Champion" && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
        {activeSeat.name}{activeSeat.name === "Business Champion" ? " · Lead" : ""}
      </span>}
    </div>

    {error && <div role="alert" data-testid="error-multi-contact-assignments" className="mx-3.5 mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground">{error}</div>}

    <div className="grid gap-4 p-3.5 sm:grid-cols-2">
      <div>
        <label htmlFor="multi-contact-company" className="mb-1.5 block text-xs font-semibold text-foreground">Company</label>
        <div className="relative">
          <Building2 size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <select
            id="multi-contact-company"
            data-testid="select-multi-contact-company"
            value={companyId ?? ""}
            disabled={readOnly || loading}
            onChange={event => onCompany(event.target.value ? Number(event.target.value) : null)}
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Choose a company</option>
            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>
        {selectedCompany && <p className="mt-1.5 truncate text-[11px] text-muted-foreground" data-testid="text-assignment-company">Showing contacts at {selectedCompany.name}.</p>}
      </div>

      <div>
        <label htmlFor="multi-contact-seat-contact" className="mb-1.5 block text-xs font-semibold text-foreground">
          Contact for {activeSeat?.name ?? "active seat"}{activeSeat?.name === "Business Champion" && <span className="ml-1.5 font-normal text-muted-foreground">(lead)</span>}
        </label>
        {loading ? <div className="h-9 animate-pulse rounded-md bg-secondary" aria-label="Loading contact assignments" /> :
          <div className="relative">
            <UserRound size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <select
              id="multi-contact-seat-contact"
              data-testid={`select-contact-for-seat-${activeSeatId || "none"}`}
              value={activeContact?.id ?? ""}
              disabled={readOnly || !activeSeat || companyId === null}
              onChange={event => onContact(activeSeatId, event.target.value ? Number(event.target.value) : null)}
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{companyId === null ? "Choose a company first" : "Unassigned"}</option>
              {availableContacts.map(contact => <option key={contact.id} value={contact.id}>{`${contact.firstName} ${contact.lastName}`.trim()}{contact.jobTitle ? ` — ${contact.jobTitle}` : ""}</option>)}
            </select>
          </div>}
        {activeContact && <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground" data-testid={`text-assigned-contact-${activeSeatId}`}>
          <ContactRound size={12} aria-hidden="true" /> {contactName}{activeContact.jobTitle ? ` · ${activeContact.jobTitle}` : ""}
        </p>}
        {!loading && companyId !== null && !availableContacts.length && !activeContact && <p className="mt-1.5 text-[11px] text-muted-foreground">No unassigned contacts found for this company.</p>}
      </div>
    </div>
    {readOnly && <p className="border-t border-border/60 px-3.5 py-2 text-[11px] text-muted-foreground">Assignments are read-only for this playbook.</p>}
  </section>;
}
