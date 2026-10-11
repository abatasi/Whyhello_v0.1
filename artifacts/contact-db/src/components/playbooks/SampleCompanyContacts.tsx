import { Building2, Check, ContactRound, Info, UserRound } from "lucide-react";
import { buyingCenterIcon } from "./buying-center-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SampleCompany = { id: number; name: string };
export type SampleCompanyContact = {
  id: number;
  firstName: string;
  lastName: string;
  companyId: number | null;
  jobTitle?: string | null;
  matchingSeats: string[];
};
export type SampleBuyingCenterSeat = { id: string; name: string };

export type SampleCompanyContactsProps = {
  companies: SampleCompany[];
  contacts: SampleCompanyContact[];
  seats: SampleBuyingCenterSeat[];
  companyId: number | null;
  contactIds: Record<string, number | null>;
  manualSeatIds: string[];
  loading: boolean;
  saving: boolean;
  readOnly: boolean;
  error?: string;
  criteriaName?: string | null;
  onCompany: (id: number | null) => void;
  onContact: (seatId: string, id: number | null) => void;
};

const NONE = "none";

function seatMatchesContact(contact: SampleCompanyContact, seat: SampleBuyingCenterSeat) {
  return contact.matchingSeats.includes(seat.id) || contact.matchingSeats.includes(seat.name);
}

function contactLabel(contact: SampleCompanyContact) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return contact.jobTitle ? `${name} — ${contact.jobTitle}` : name;
}

export function SampleCompanyContacts({
  companies,
  contacts,
  seats,
  companyId,
  contactIds,
  manualSeatIds,
  loading,
  saving,
  readOnly,
  error,
  criteriaName,
  onCompany,
  onContact,
}: SampleCompanyContactsProps) {
  const companyContacts = contacts
    .filter(contact => contact.companyId === companyId)
    .sort((a, b) => contactLabel(a).localeCompare(contactLabel(b)));
  const selectedCompany = companies.find(company => company.id === companyId);

  return (
    <section
      aria-labelledby="sample-company-contacts-title"
      className="overflow-hidden rounded-lg border border-border bg-card"
      data-testid="panel-sample-company-contacts"
    >
      <header className="flex items-start gap-3 border-b border-border/70 px-4 py-3.5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary/60 text-muted-foreground">
          <Building2 size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id="sample-company-contacts-title" className="text-sm font-semibold text-foreground">
              Company &amp; contacts
            </h3>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Sample previews
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Choose a sample company and one contact for each Buying Center seat.
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="rounded-md border border-primary/20 bg-primary/[0.045] px-3 py-2.5">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
            <Info size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              These contacts only inform message previews. They do not enroll anyone or send messages.
            </span>
          </p>
        </div>

        {error && (
          <div role="alert" data-testid="error-sample-company-contacts" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="sample-contact-company" className="mb-1.5 block text-xs font-semibold text-foreground">
            Sample company
          </label>
          <Select
            value={companyId === null ? NONE : String(companyId)}
            onValueChange={value => onCompany(value === NONE ? null : Number(value))}
            disabled={readOnly || loading}
          >
            <SelectTrigger id="sample-contact-company" data-testid="select-sample-company" className="h-9 w-full bg-background text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Building2 size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder="Choose a company" />
              </span>
            </SelectTrigger>
            <SelectContent className="z-[250]">
              <SelectItem value={NONE}>Choose a company</SelectItem>
              {companies.map(company => (
                <SelectItem key={company.id} value={String(company.id)}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCompany && (
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground" data-testid="text-sample-company">
              Previewing contacts at {selectedCompany.name}.
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-foreground">Seat samples</h4>
            {saving && (
              <span className="text-[10px] text-muted-foreground" role="status" data-testid="status-saving-samples">
                Saving samples…
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-2" aria-label="Loading sample contacts">
              {seats.map(seat => (
                <div key={seat.id} className="h-[74px] animate-pulse rounded-md border border-border/70 bg-secondary/50" />
              ))}
            </div>
          ) : seats.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground" data-testid="empty-sample-seats">
              No Buying Center seats to preview.
            </div>
          ) : (
            <div className="space-y-2">
              {seats.map(seat => {
                const SeatIcon = buyingCenterIcon(seat.name);
                const contactId = contactIds[seat.id] ?? null;
                const contact = companyContacts.find(item => item.id === contactId);
                const matchesCriteria = !!contact && seatMatchesContact(contact, seat);
                const isManual = manualSeatIds.includes(seat.id);
                const status = !contact
                  ? { label: "Missing match", className: "border-amber-500/30 bg-amber-500/[0.07] text-amber-800 dark:text-amber-300" }
                  : matchesCriteria && !isManual
                    ? { label: "Criteria match", className: "border-emerald-600/25 bg-emerald-600/[0.07] text-emerald-800 dark:text-emerald-300" }
                    : { label: "Manual sample", className: "border-border bg-secondary/60 text-muted-foreground" };

                return (
                  <article key={seat.id} className="rounded-md border border-border/80 bg-background p-3" data-testid={`row-sample-seat-${seat.id}`}>
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary/70 text-muted-foreground">
                          <SeatIcon size={14} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 truncate text-xs font-semibold text-foreground" data-testid={`text-sample-seat-${seat.id}`}>
                          {seat.name}
                        </span>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${status.className}`}
                        data-testid={`status-sample-seat-${seat.id}`}
                      >
                        {matchesCriteria && !isManual && <Check size={11} aria-hidden="true" />}
                        {status.label}
                      </span>
                    </div>

                    <Select
                      value={contact ? String(contact.id) : NONE}
                      onValueChange={value => onContact(seat.id, value === NONE ? null : Number(value))}
                      disabled={readOnly || companyId === null}
                    >
                      <SelectTrigger data-testid={`select-sample-contact-${seat.id}`} className="h-9 w-full bg-background text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <UserRound size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                          <SelectValue placeholder={companyId === null ? "Choose a company first" : "Choose a sample contact"} />
                        </span>
                      </SelectTrigger>
                      <SelectContent className="z-[250]">
                        <SelectItem value={NONE}>No sample contact</SelectItem>
                        {companyContacts.map(item => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {contactLabel(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {contact ? (
                      <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] leading-snug text-muted-foreground" data-testid={`text-sample-contact-${seat.id}`}>
                        <ContactRound size={12} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {contactLabel(contact)}
                          {matchesCriteria && criteriaName ? ` · matches ${criteriaName}` : ""}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground" data-testid={`text-sample-status-${seat.id}`}>
                        {companyId === null
                          ? "Choose a company to select a sample contact."
                          : companyContacts.length === 0
                            ? "No contacts are listed for this company yet."
                            : "No sample contact selected. Choose a criteria match or a fallback contact to preview this seat."}
                      </p>
                    )}
                    {contact && (isManual || !matchesCriteria) && (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground" data-testid={`text-sample-fallback-${seat.id}`}>
                        {isManual && matchesCriteria
                          ? "Manually selected sample contact. It informs previews only."
                          : "Fallback sample contact: this person does not match the seat criteria, but can still inform the preview."}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {readOnly && (
          <p className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground" data-testid="text-samples-read-only">
            Sample selections are read-only for this playbook.
          </p>
        )}
      </div>
    </section>
  );
}

export default SampleCompanyContacts;
