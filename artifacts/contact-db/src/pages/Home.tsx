import { useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { Building2, ClipboardList, Send, SlidersHorizontal, Target, UserCheck } from "lucide-react";
import { useBatchRevealStatuses, useHomeActivity, useTopBuyers, useTopLeads } from "@workspace/api-client-react";
import type { HomeActivity, TopBuyer, TopLead } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";

export const GREETING_LIBRARY = [
  "Why hello, Leandro",
  "Hell yeah, Leandro",
  "Why hello, stranger",
  "Leandro returns!",
  "And we’re back.",
  "There you are, Leandro.",
  "Ah, Leandro. We meet again.",
  "Howdy, Leandro",
  "Well, well, well… Leandro.",
  "Leandro has entered the building.",
  "Ready when you are, Leandro.",
  "Another day, another prospect.",
  "Shall we find some buyers, Leandro?",
  "Let’s see who’s worth knowing today.",
  "Bonjour, Leandro",
  "Hola, Leandro",
  "Guten Tag, Leandro",
  "Marhaba, Leandro",
  "Salam, Leandro",
  "Buongiorno, Leandro",
  "Morning, Leandro",
  "Good afternoon, Leandro.",
  "Evening, Leandro",
  "Early start today, Leandro?",
  "Burning the midnight oil, Leandro?",
  "Who are we meeting today, Leandro?",
  "Let’s find someone worth talking to.",
  "Your Buyers await, Leandro.",
  "Who should we get to know today?",
  "Let’s make some introductions.",
  "Let’s find your next conversation.",
  "Who’s on the radar today, Leandro?",
  "Let’s find a reason to say hello.",
] as const;

const TIME_AWARE_GREETINGS = new Set([
  "Morning, Leandro",
  "Good afternoon, Leandro.",
  "Evening, Leandro",
  "Early start today, Leandro?",
  "Burning the midnight oil, Leandro?",
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
  if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  if (score >= 75) return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
  if (score >= 50) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
  return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
}

function LeadRow({ lead, revealed }: { lead: TopLead; revealed: boolean }) {
  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-secondary/20 transition-colors">
      <td className="px-5 py-4">
        <Link href={`/contacts/${lead.id}`} className="group flex items-center gap-3 min-w-[180px]">
          <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
            {lead.firstName[0]}{lead.lastName[0]}
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-foreground transition-colors group-hover:text-primary">
            {lead.firstName} {lead.lastName}
          </span>
        </Link>
      </td>
      <td className="px-5 py-4">
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap", scoreBadgeClass(lead.score))}>
          {lead.score} · {lead.scoreCategory}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        {revealed && lead.email ? (
          <a href={`mailto:${lead.email}`} className="text-[11px] text-primary hover:underline">{lead.email}</a>
        ) : (
          <span className="inline-flex rounded-md border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Access Email
          </span>
        )}
      </td>
      <td className="px-5 py-4 text-[11px] text-muted-foreground min-w-[150px]">{lead.jobTitle || "—"}</td>
      <td className="px-5 py-4 text-[11px] text-muted-foreground min-w-[140px]">
        {lead.companyName ? <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{lead.companyName}</span> : "—"}
      </td>
      <td className="px-5 py-4 text-[11px] text-muted-foreground whitespace-nowrap">
        {lead.location || "—"}
      </td>
    </tr>
  );
}

function BuyerRow({ buyer }: { buyer: TopBuyer }) {
  const buyerLocation = [buyer.location, buyer.country].filter(Boolean).join(", ") || "—";
  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-secondary/20 transition-colors">
      <td className="px-5 py-4">
        <Link href={`/companies/${buyer.id}`} className="group flex min-w-[180px] items-center gap-3">
          <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <Building2 className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-foreground transition-colors group-hover:text-primary">
            {buyer.name}
          </span>
        </Link>
      </td>
      <td className="px-5 py-4">
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap", scoreBadgeClass(buyer.score))}>
          {buyer.score} · {buyer.scoreCategory}
        </span>
      </td>
      <td className="px-5 py-4 text-[11px] text-muted-foreground">{buyer.industry || "—"}</td>
      <td className="px-5 py-4 text-[11px] text-muted-foreground">
        {buyer.matchedTargetMarket
          ? `${buyer.matchedTargetMarket} · ${buyer.matchedDimensions}/${buyer.configuredDimensions} criteria`
          : "—"}
      </td>
      <td className="px-5 py-4 text-[11px] text-muted-foreground">{buyer.matchedContacts}</td>
      <td className="px-5 py-4 text-[11px] text-muted-foreground whitespace-nowrap">{buyerLocation}</td>
    </tr>
  );
}

function SkeletonRows({ columns = 6 }: { columns?: number }) {
  return (
    <>{Array.from({ length: 6 }).map((_, index) => (
      <tr key={index} className="border-b border-border/70">
        {Array.from({ length: columns }).map((__, cell) => (
          <td key={cell} className="px-5 py-5"><div className={cn("h-4 animate-pulse rounded bg-muted", cell === 0 ? "w-36" : "w-24")} /></td>
        ))}
      </tr>
    ))}</>
  );
}

function relativeActivityTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ActivityIcon({ type }: { type: HomeActivity["type"] }) {
  const Icon = type === "message" ? Send
    : type === "contact-activated" ? UserCheck
      : type === "playbook" ? ClipboardList
        : type === "hq" ? SlidersHorizontal : Target;
  return <Icon className="h-4 w-4" />;
}

function ActivitySkeleton() {
  return <>{Array.from({ length: 4 }).map((_, index) => (
    <div key={index} className="flex min-h-[58px] items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
      <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
    </div>
  ))}</>;
}

function activityTone(type: HomeActivity["type"]): string {
  if (type === "contact-activated") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  if (type === "hq") return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
  if (type === "playbook") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  return "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400";
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
  const { data: buyers, isLoading: buyersLoading, isError: buyersError, error: buyersErrorDetail } = useTopBuyers();
  const { data: activity, isLoading: activityLoading, isError: activityError } = useHomeActivity();
  const leadIds = (leads ?? []).map((lead) => lead.id);
  const { data: revealStatuses } = useBatchRevealStatuses(leadIds);
  const revealedIds = new Set(revealStatuses?.revealedIds ?? []);

  return (
    <Shell>
      <div className="home-approved-design flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1240px] px-6 pb-[70px] pt-8 md:px-[42px]">
          <section className="mb-6 border-b border-border pb-[18px]">
            <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.035em] text-foreground">{greeting}</h1>
          </section>

          <section className="mb-6">
            <div className="overflow-hidden rounded-[10px] border border-border bg-card">
              <div className="flex min-h-[56px] items-center border-b border-border px-5">
                <h2 className="flex items-center gap-2 text-[14px] font-bold tracking-tight text-foreground">
                  <span aria-hidden="true">🏄</span>
                  <span>Your latest moves</span>
                </h2>
              </div>
              {activityLoading ? <ActivitySkeleton /> : activityError ? (
                <div className="px-5 py-6 text-sm text-muted-foreground">Recent activity is unavailable right now.</div>
              ) : activity?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {activity.map((item) => {
                    const content = (
                      <>
                        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", activityTone(item.type))}>
                          <ActivityIcon type={item.type} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-foreground">{item.title}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.detail}</span>
                        </span>
                        <time className="shrink-0 text-[9px] text-muted-foreground">{relativeActivityTime(item.occurredAt)}</time>
                      </>
                    );
                    return item.href ? (
                      <Link key={item.id} href={item.href} className="flex min-h-[58px] items-center gap-2.5 border-b border-border/60 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-secondary/30 md:[&:nth-child(odd)]:border-r md:[&:nth-last-child(-n+2)]:border-b-0">
                        {content}
                      </Link>
                    ) : (
                      <div key={item.id} className="flex min-h-[58px] items-center gap-2.5 border-b border-border/60 px-4 py-2.5 last:border-b-0 md:[&:nth-child(odd)]:border-r md:[&:nth-last-child(-n+2)]:border-b-0">
                        {content}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-6 text-sm text-muted-foreground">No recent moves yet.</div>
              )}
            </div>
          </section>

          <section className="mb-6">
            <div className="overflow-hidden rounded-[10px] border border-border bg-card">
              <div className="flex min-h-[56px] items-center border-b border-border px-5">
                <h2 className="text-[14px] font-bold tracking-tight text-foreground">Your next conversation</h2>
              </div>
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
                          <th key={heading} className="px-5 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? <SkeletonRows /> : leads?.length
                        ? leads.map((lead) => <LeadRow key={lead.id} lead={lead} revealed={revealedIds.has(lead.id)} />)
                        : (
                          <tr><td colSpan={6} className="px-6 py-14 text-center">
                             <p className="font-semibold text-foreground">No scored conversations yet.</p>
                             <p className="mt-1 text-sm text-muted-foreground">Score contacts in HQ to start building your next conversations.</p>
                          </td></tr>
                        )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="overflow-hidden rounded-[10px] border border-border bg-card">
              <div className="flex min-h-[56px] items-center border-b border-border px-5">
                <h2 className="text-[14px] font-bold tracking-tight text-foreground">Your next buyer</h2>
              </div>
              {buyersError ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-semibold text-foreground">Top buyers are unavailable right now.</p>
                  <p className="mt-1 text-sm text-muted-foreground">{buyersErrorDetail instanceof Error ? buyersErrorDetail.message : "Please try again shortly."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        {["Company", "HQ fit", "Industry", "Target market", "Known contacts", "Location"].map((heading) => (
                          <th key={heading} className="px-5 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buyersLoading ? <SkeletonRows /> : buyers?.length
                        ? buyers.map((buyer) => <BuyerRow key={buyer.id} buyer={buyer} />)
                        : (
                          <tr><td colSpan={6} className="px-6 py-14 text-center">
                            <p className="font-semibold text-foreground">No scored buyers yet.</p>
                            <p className="mt-1 text-sm text-muted-foreground">Score contacts in HQ to identify your best-fit companies.</p>
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