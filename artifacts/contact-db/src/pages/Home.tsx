import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  Building2,
  ClipboardList,
  Send,
  SlidersHorizontal,
  Target,
  UserCheck,
  ChevronRight,
  ArrowRight,
  MapPin,
  Mail,
  ExternalLink,
  User,
  Building,
  TrendingUp,
  Briefcase,
  Users,
  Handshake
} from "lucide-react";
import {
  useBatchRevealStatuses,
  useHomeActivity,
  useTopBuyers,
  useTopLeads,
  useGetContact,
  useGetContactInsights,
  useGetContactIndustryInsights,
  useGetContactRoleInsights,
  useGetContactColleagueInsights,
  useGetContactCounterpartInsights,
  useGetCompanyInsights,
  useGetInsightRelevance,
  useTriggerInsightRelevance,
  useGetContactMetaScore,
  useInsightMeta
} from "@workspace/api-client-react";
import type { ContactMetaScore, HomeActivity, InsightRelevanceScore, TopBuyer, TopLead } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { OverallScorePill } from "@/components/OverallScorePill";
import { cn } from "@/lib/utils";
import { getContactProfileImage } from "@/lib/contactProfileImages";

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

function getCategoryStyle(category: string): string {
  const cat = category.toLowerCase();
  switch(cat) {
    case 'personal':
      return "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400 border-pink-200 dark:border-pink-500/20";
    case 'company':
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20";
    case 'industry':
      return "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20";
    case 'role':
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
    case 'colleague':
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20";
    case 'counterpart':
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20";
  }
}

function getCategoryIcon(category: string) {
  switch (category.toLowerCase()) {
    case "personal": return User;
    case "company": return Building;
    case "industry": return TrendingUp;
    case "role": return Briefcase;
    case "colleague": return Users;
    case "counterpart": return Handshake;
    default: return Target;
  }
}

function ScoringBreakdownCard({ metaScore }: { metaScore: ContactMetaScore }) {
  const categories = [
    { label: "Personal", value: metaScore.personalBest },
    { label: "Company", value: metaScore.companyBest },
    { label: "Industry", value: metaScore.industryBest },
    { label: "Role", value: metaScore.roleBest },
  ];

  return (
    <div className="mt-5 rounded-lg border border-border/70 bg-background/60 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scoring breakdown</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Aggregate relevance across four signal categories</p>
        </div>
        <OverallScorePill score={metaScore.metaScore} />
      </div>
      <div className="space-y-2">
        {categories.map(({ label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[10px] text-muted-foreground">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  value >= 75 ? "bg-violet-400" : value >= 50 ? "bg-blue-400" : value >= 25 ? "bg-slate-400" : "bg-slate-300 dark:bg-slate-600",
                )}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-[10px] font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[9px] text-muted-foreground">
        {metaScore.signalCount} signal{metaScore.signalCount !== 1 ? "s" : ""} scored
      </p>
    </div>
  );
}

type IcebreakerSource = {
  id: number;
  title: string;
  url: string;
  source: string;
  mediaType: string;
  description?: string | null;
  publishedDate?: string | null;
};

function IcebreakerCard({
  relevance,
  insight,
}: {
  relevance: InsightRelevanceScore;
  insight?: IcebreakerSource;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const { data: metadata } = useInsightMeta(insight?.url ?? "");
  const image = !imageFailed ? metadata?.ogImage : null;
  const source = metadata?.source || insight?.source;
  const publishedDate = metadata?.publishedDate || insight?.publishedDate;
  const CategoryIcon = getCategoryIcon(relevance.signalType);
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <div className="h-[82px] w-[112px] shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/50">
          {image ? (
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {insight?.mediaType || relevance.signalType}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <span className={cn(
              "inline-flex items-center justify-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              getCategoryStyle(relevance.signalType),
            )}>
              <CategoryIcon className="h-2.5 w-2.5" />
              {relevance.signalType}
            </span>
            {insight?.url && <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
            {insight?.title || "Untitled insight"}
          </p>
          {(source || publishedDate) && (
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {[source, publishedDate].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
      <div className={cn(
        "flex h-[82px] flex-col items-center justify-center rounded-md border",
        relevance.score >= 75
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
          : relevance.score >= 50
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
            : relevance.score >= 25
              ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400"
              : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400",
      )}>
        <span className="text-[38px] font-bold leading-none tracking-tight">
          {relevance.score}
        </span>
      </div>
      <div className="min-w-0 border-t border-border/60 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Relevance</p>
        <p className="text-[12px] leading-relaxed text-foreground/80">
          {relevance.description}
        </p>
        {relevance.matchedHqSignals.length > 0 && (
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            {relevance.matchedHqSignals.slice(0, 2).join(" · ")}
          </p>
        )}
      </div>
    </>
  );

  return insight?.url ? (
    <a
      href={insight.url}
      target="_blank"
      rel="noopener noreferrer"
      className="grid gap-3 rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:bg-background md:grid-cols-[minmax(230px,0.9fr)_92px_minmax(0,1.8fr)]"
      aria-label={`Open insight: ${insight.title}`}
    >
      {content}
    </a>
  ) : (
    <div className="grid gap-3 rounded-lg border border-border/60 bg-background/50 p-3 md:grid-cols-[minmax(230px,0.9fr)_92px_minmax(0,1.8fr)]">
      {content}
    </div>
  );
}

function ExpandedLeadContent({ lead }: { lead: TopLead }) {
  const profileImage = getContactProfileImage(lead.id);
  const { data: contact, isLoading: contactLoading } = useGetContact(lead.id);
  const { data: personalInsights = [], isLoading: personalLoading } = useGetContactInsights(lead.id);
  const { data: industryInsights = [], isLoading: industryLoading } = useGetContactIndustryInsights(lead.id);
  const { data: roleInsights = [], isLoading: roleLoading } = useGetContactRoleInsights(lead.id);
  const { data: colleagueInsights = [], isLoading: colleagueLoading } = useGetContactColleagueInsights(lead.id);
  const { data: counterpartInsights = [], isLoading: counterpartLoading } = useGetContactCounterpartInsights(lead.id);
  const companyId = contact?.company?.id ?? 0;
  const { data: companyInsights = [], isLoading: companyLoading } = useGetCompanyInsights(companyId, {
    query: { enabled: companyId > 0 },
  });
  const { data: insights, isLoading, isError } = useGetInsightRelevance(lead.id);
  const { data: metaScore, isLoading: metaScoreLoading } = useGetContactMetaScore(lead.id);
  const triggerRelevance = useTriggerInsightRelevance();
  const triggered = useRef(false);

  useEffect(() => {
    if (!isLoading && !isError && insights && insights.length === 0 && !triggered.current) {
      triggered.current = true;
      triggerRelevance.mutate(lead.id);
    }
  }, [insights, isLoading, isError, lead.id, triggerRelevance]);

  const topInsights = useMemo(() => {
    if (!insights) return [];
    return [...insights].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [insights]);
  const sourceInsights = useMemo(() => {
    const map = new Map<string, IcebreakerSource>();
    const groups: Array<[string, IcebreakerSource[]]> = [
      ["personal", personalInsights],
      ["company", companyInsights],
      ["industry", industryInsights],
      ["role", roleInsights],
      ["colleague", colleagueInsights],
      ["counterpart", counterpartInsights],
    ];
    groups.forEach(([category, items]) => {
      items.forEach((item) => map.set(`${category}-${item.id}`, item));
    });
    return map;
  }, [personalInsights, companyInsights, industryInsights, roleInsights, colleagueInsights, counterpartInsights]);
  const sourceInsightsLoading = contactLoading || personalLoading || companyLoading || industryLoading || roleLoading || colleagueLoading || counterpartLoading;

  return (
    <div className="mx-[18px] mb-[18px] mt-2 rounded-[10px] border border-border bg-card shadow-sm overflow-hidden" data-testid={`expanded-lead-${lead.id}`}>
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Left column: Rich contact view */}
        <div className="p-5 md:w-1/3 flex flex-col justify-between bg-muted/10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-[13px] font-bold text-primary">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={`${lead.firstName} ${lead.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>{lead.firstName[0]}{lead.lastName[0]}</>
                )}
              </span>
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{lead.firstName} {lead.lastName}</h3>
                <p className="text-[12px] text-muted-foreground">{lead.jobTitle}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {lead.companyName && (
                <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{lead.companyName}</span>
                </div>
              )}
              {lead.location && (
                <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{lead.location}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <a href={`mailto:${lead.email}`} className="truncate hover:text-primary transition-colors">{lead.email}</a>
                </div>
              )}
            </div>
            {metaScoreLoading ? (
              <div className="mt-5 h-[150px] animate-pulse rounded-lg border border-border/60 bg-muted/40" />
            ) : metaScore ? (
              <ScoringBreakdownCard metaScore={metaScore} />
            ) : null}
          </div>
          <div className="mt-6">
            <Link
              href={`/contacts/${lead.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              Open Full Profile <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Right column: Top Insights */}
        <div className="p-5 md:w-2/3">
          <h4 className="mb-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">🧊 Top Icebreakers</h4>

          <div className="space-y-3">
            {isLoading || sourceInsightsLoading || (insights?.length === 0 && triggerRelevance.isPending) ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-[58px] rounded-lg bg-muted/50 border border-border/50" />
                ))}
              </div>
            ) : isError || triggerRelevance.isError ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-500 dark:text-red-400">
                Failed to load insights.
              </div>
            ) : topInsights.length > 0 ? (
              topInsights.map((relevance) => (
                <IcebreakerCard
                  key={`${relevance.signalType}-${relevance.signalId}`}
                  relevance={relevance}
                  insight={sourceInsights.get(`${relevance.signalType}-${relevance.signalId}`)}
                />
              ))
            ) : (
              <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border/60">
                <p className="text-sm text-muted-foreground">No insights discovered yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  revealed,
  isExpanded,
  onToggle
}: {
  lead: TopLead;
  revealed: boolean;
  isExpanded: boolean;
  onToggle: () => void
}) {
  const profileImage = getContactProfileImage(lead.id);

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "group/row cursor-pointer transition-colors hover:bg-secondary/20",
          isExpanded ? "border-b-0 bg-secondary/5" : "border-b border-border/70 last:border-0"
        )}
        data-testid={`row-lead-${lead.id}`}
      >
        <td className="px-5 py-4 relative">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid={`button-toggle-lead-${lead.id}`}
              className="text-muted-foreground/50 transition-colors group-hover/row:text-muted-foreground"
              aria-label={isExpanded ? "Collapse row" : "Expand row"}
              aria-expanded={isExpanded}
              aria-controls={`expanded-lead-${lead.id}`}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-90")} />
            </button>
            <Link href={`/contacts/${lead.id}`} onClick={(e) => e.stopPropagation()} className="group flex items-center gap-3 min-w-[150px]">
              <span className="grid h-[29px] w-[29px] shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={`${lead.firstName} ${lead.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>{lead.firstName[0]}{lead.lastName[0]}</>
                )}
              </span>
              <span className="min-w-0 truncate text-[11px] font-semibold text-foreground transition-colors group-hover:text-primary">
                {lead.firstName} {lead.lastName}
              </span>
            </Link>
          </div>
        </td>
        <td className="px-5 py-4">
          <OverallScorePill score={lead.score} category={lead.scoreCategory} />
        </td>
        <td className="px-5 py-4 whitespace-nowrap">
          {revealed && lead.email ? (
            <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-primary hover:underline">{lead.email}</a>
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
      {isExpanded && (
        <tr id={`expanded-lead-${lead.id}`} className="border-b border-border/70 bg-secondary/5">
          <td colSpan={6} className="p-0">
            <ExpandedLeadContent lead={lead} />
          </td>
        </tr>
      )}
    </>
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
        <OverallScorePill score={buyer.score} category={buyer.scoreCategory} />
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

  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);
  const initializedExpanded = useRef(false);

  useEffect(() => {
    if (leads?.length && !initializedExpanded.current) {
      initializedExpanded.current = true;
      setExpandedLeadId(leads[0].id);
    }
  }, [leads]);

  return (
    <Shell>
      <div className="home-approved-design flex-1 overflow-y-auto">
        <div className="w-full px-6 pb-[70px] pt-8 md:px-[42px]">
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
                        ? leads.map((lead) => (
                          <LeadRow
                            key={lead.id}
                            lead={lead}
                            revealed={revealedIds.has(lead.id)}
                            isExpanded={expandedLeadId === lead.id}
                            onToggle={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                          />
                        ))
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
