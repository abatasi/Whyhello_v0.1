import { Link } from "wouter";
import { ChevronRight, Users } from "lucide-react";
import type { ContactSummary } from "@workspace/api-client-react";
import { getInitials } from "@/lib/utils";

export function CompanyContactsColumn({ contacts }: { contacts: ContactSummary[] }) {
  return (
    <section className="md:h-full md:min-h-0 md:overflow-y-auto scroll-thin md:pr-1" data-testid="column-company-contacts">
      <div className="md:sticky top-0 z-10 bg-background pb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">People</h2>
        <span className="text-xs border border-border px-2 py-0.5 rounded-full text-muted-foreground" data-testid="text-contact-count">
          {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
        </span>
      </div>
      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-5 text-center">
          <Users className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No contacts found for this company.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => {
            const name = `${c.firstName} ${c.lastName}`;
            const meta = [c.department, c.seniority].filter(Boolean).join(" · ");
            return (
              <Link key={c.id} href={`/contacts/${c.id}`} data-testid={`link-contact-${c.id}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card dark:bg-background p-3 hover:border-foreground/30 transition-colors">
                <div className="h-9 w-9 rounded-full border border-border bg-muted text-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {getInitials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  {c.jobTitle && <p className="text-xs text-muted-foreground truncate">{c.jobTitle}</p>}
                  {meta && <p className="text-[11px] text-muted-foreground/80 truncate">{meta}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
