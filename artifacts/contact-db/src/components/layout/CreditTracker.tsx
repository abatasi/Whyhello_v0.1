import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { Zap, Users, Building2, Loader2 } from "lucide-react";
import { useCreditsStatus, useListCreditUsage } from "@workspace/api-client-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CreditTracker({ wartime, staticOnly = false }: { wartime: boolean; staticOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const { data: status, refetch } = useCreditsStatus();
  const userId = user?.id;
  const usage = useListCreditUsage({
    query: {
      enabled: open && !!userId,
      queryKey: ["credits", "usage", userId],
      staleTime: 0,
      refetchInterval: open ? 30_000 : false,
    },
  });

  useEffect(() => { if (open) void refetch(); }, [open, refetch]);

  if (!status) return null;
  const unlimited = status.isUnlimited;
  const available = Math.max(0, (status.creditsTotal ?? 0) - status.creditsUsed);
  const value = unlimited ? "∞" : available.toLocaleString();
  const label = unlimited ? "Unlimited credits available" : `${available.toLocaleString()} credits available`;
  const tone = wartime ? "text-[#7C3E2A] dark:text-[#E0BBA8]" : "text-[#6F5BAF] dark:text-primary";

  const face = (
    <>
      <Zap className="h-3 w-3 flex-shrink-0" aria-hidden />
      <span className="tabular-nums">{value}</span>
      <span className="hidden font-normal text-muted-foreground/80 sm:inline">credits available</span>
    </>
  );
  const base = "flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold";
  if (staticOnly) {
    return <div title={label} className={cn(base, "select-none", tone)}>{face}<span className="sr-only">{label}</span></div>;
  }

  const events = (usage.data ?? []).slice(0, 20);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}. Show recent credit usage`}
          title={label}
          className={cn(base, "rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tone)}
        >
          {face}
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Recent credit usage" align="end" className="w-[min(22rem,calc(100vw-1rem))] border-border bg-popover p-0 text-popover-foreground">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">{unlimited ? "Unlimited credits" : `${available.toLocaleString()} credits available`}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {unlimited ? "Your plan has no credit limit." : "Balance resets monthly."} Latest 20 credit-consuming actions.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!userId || usage.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading usage…
            </div>
          ) : usage.isError ? (
            <div className="px-3 py-5 text-center text-xs text-foreground">
              Couldn’t load usage.
              <button type="button" onClick={() => usage.refetch()} className="ml-2 rounded px-1.5 py-0.5 font-semibold underline">Retry</button>
            </div>
          ) : events.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No credits used yet. Revealing a contact or company will show up here.</p>
          ) : (
            <ul>
              {events.map((e) => {
                const Icon = e.recordType === "company" ? Building2 : Users;
                const row = (
                  <>
                    <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{e.recordName}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {e.recordType === "company" ? "Revealed company" : "Revealed contact"} · <time dateTime={e.createdAt} title={new Date(e.createdAt).toLocaleString()}>{when(e.createdAt)}</time>
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-xs font-semibold tabular-nums">-{e.creditsUsed}</span>
                  </>
                );
                const cls = "flex items-center gap-2.5 px-3 py-2";
                return (
                  <li key={e.id} className="border-b border-border last:border-0">
                    {e.recordId != null ? (
                      <Link
                        href={`/${e.recordType === "company" ? "companies" : "contacts"}/${e.recordId}`}
                        onClick={() => setOpen(false)}
                        className={cn(cls, "hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none")}
                      >{row}</Link>
                    ) : <div className={cls}>{row}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
