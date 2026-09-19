import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { ArrowUpRight, MapPin, Users } from "lucide-react";
import { useBatchRevealStatuses, useTopLeads } from "@workspace/api-client-react";
import type { TopLead } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";

export const GREETING_LIBRARY = [
  "Why hello, Leandro 👋",
  "Why hello, stranger 👋",
  "Leandro returns!",
  "And we’re back.",
  "There you are, Leandro.",
  "Ah, Leandro. We meet again.",
  "Howdy, Leandro 🤠",
  "Well, well, well… Leandro.",
  "Leandro has entered the building.",
  "Ready when you are, Leandro.",
  "Another day, another prospect.",
  "Shall we find some buyers, Leandro?",
  "Let’s see who’s worth knowing today.",
  "Bonjour, Leandro 👋",
  "Hola, Leandro 👋",
  "Guten Tag, Leandro 👋",
  "Marhaba, Leandro 👋",
  "Salam, Leandro 👋",
  "Buongiorno, Leandro ☀️",
  "Morning, Leandro ☀️",
  "Good afternoon, Leandro.",
  "Evening, Leandro 🌙",
  "Early start today, Leandro? ☕",
  "Burning the midnight oil, Leandro? 🌙",
  "Who are we meeting today, Leandro?",
  "Let’s find someone worth talking to.",
  "Your Buyers await, Leandro.",
  "Who should we get to know today?",
  "Let’s make some introductions.",
  "Let’s find your next conversation.",
  "Who’s on the radar today, Leandro?",
  "Let’s find a reason to say hello. 👋",
] as const;

const TIME_AWARE_GREETINGS = new Set([
  "Morning, Leandro ☀️",
  "Good afternoon, Leandro.",
  "Evening, Leandro 🌙",
  "Early start today, Leandro? ☕",
  "Burning the midnight oil, Leandro? 🌙",
]);

function greetingForHour(hour: number): string[] {
  const timeGreetings = GREETING_LIBRARY.filter((greeting) => TIME_AWARE_GREETINGS.has(greeting));
  const appropriate = hour < 5 || hour >= 22
    ? timeGreetings.filter((greeting) => greeting.includes("midnight"))
    : hour < 12
      ? timeGreetings.filter((greeting) => greeting.includes("Morning") || greeting.includes("Early"))
      : hour < 18
        ? timeGreetings.filter((greeting) => greeting.includes("afternoon"))
        : timeGreetings.filter((greeting) => greeting.includes("Evening"));
  return appropriate.length > 0
    ? [...GREETING_LIBRARY.filter((greeting) => !TIME_AWARE_GREETINGS.has(greeting)), ...appropriate]
    : [...GREETING_LIBRARY];
}

function scoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 75) return "bg-blue-50 text-blue-700 border-blue-200";
  if (score >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function LeadRow({ lead, revealed }: { lead: TopLead; revealed: boolean }) {
  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-secondary/20 transition-colors">
      <td className="px-5 py-4">
        <Link href={`/contacts/${lead.id}`} className="group flex items-center gap-3 min-w-[180px]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {lead.firstName[0]}{lead.lastName[0]}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-foreground group-hover:text-primary transition-colors">
              {lead.firstName} {lead.lastName}
            </span>
            <ArrowUpRight className="mt-0.5 inline h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </Link>
      </td>
      <td className="px-5 py-4">
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap", scoreBadgeClass(lead.score))}>
          {lead.score} · {lead.scoreCategory}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        {revealed && lead.email ? (
          <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline">{lead.email}</a>
        ) : (
          <span className="inline-flex rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Access Email
          </span>
        )}
      </td>
      <td className="px-5 py-4 text-sm text-muted-foreground min-w-[150px]">{lead.jobTitle || "—"}</td>
      <td className="px-5 py-4 text-sm text-foreground min-w-[140px]">{lead.companyName || "—"}</td>
      <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
        {lead.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{lead.location}</span> : "—"}
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <>{Array.from({ length: 6 }).map((_, index) => (
      <tr key={index} className="border-b border-border/70">
        {Array.from({ length: 6 }).map((__, cell) => (
          <td key={cell} className="px-5 py-5"><div className={cn("h-4 animate-pulse rounded bg-muted", cell === 0 ? "w-36" : "w-24")} /></td>
        ))}
      </tr>
    ))}</>
  );
}

export default function Home() {
  const { user } = useUser();
  const firstName = user?.firstName?.trim() || "Leandro";
  const [greetingIndex] = useState(() => {
    const choices = greetingForHour(new Date().getHours());
    return Math.floor(Math.random() * choices.length);
  });
  const choices = greetingForHour(new Date().getHours());
  const greeting = choices[greetingIndex % choices.length].replaceAll("Leandro", firstName);
  const { data: leads, isLoading, isError, error } = useTopLeads();
  const leadIds = (leads ?? []).map((lead) => lead.id);
  const { data: revealStatuses } = useBatchRevealStatuses(leadIds);
  const revealedIds = new Set(revealStatuses?.revealedIds ?? []);

  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1480px] px-6 py-10 md:px-10 md:py-14">
          <section className="mb-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Relationship intelligence</p>
            <h1 className="max-w-3xl text-4xl font-display font-bold tracking-tight text-foreground md:text-5xl">{greeting}</h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">A clearer path to the people and companies worth knowing today.</p>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="text-xl font-display font-bold text-foreground">Top Leads for {firstName}</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Stack-ranked by relationship score.</p>
              </div>
              <Link href="/directory" className="text-sm font-medium text-primary hover:underline">Open Directory</Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {isError ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-semibold text-foreground">Top leads are unavailable right now.</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Please try again shortly."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[940px] text-left">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        {["Name", "Score", "Email", "Title", "Company", "Location"].map((heading) => (
                          <th key={heading} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? <SkeletonRows /> : leads?.length
                        ? leads.map((lead) => <LeadRow key={lead.id} lead={lead} revealed={revealedIds.has(lead.id)} />)
                        : (
                          <tr><td colSpan={6} className="px-6 py-14 text-center">
                            <p className="font-semibold text-foreground">No scored leads yet.</p>
                            <p className="mt-1 text-sm text-muted-foreground">Score contacts in HQ to start building your top leads.</p>
                          </td></tr>
                        )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}