import { useRoute, Link } from "wouter";
import { useEffect } from "react";
import { CompetitorBadge, useCompetitorIds } from "@/components/CompetitorBadge";
import {
  useGetCompany,
  useGetCompanyInsights,
  useCompanyRevealStatus,
  useRevealCompany,
  useCreditsStatus,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import {
  ArrowLeft, Building2, MapPin, Users, Globe, ExternalLink, Linkedin, Calendar,
  Newspaper, Tv2, Mic2, FileText, Share2, Megaphone, Lock, AlertCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getInitials, formatNumber, cn } from "@/lib/utils";

const MEDIA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  article:        { label: "Article",        icon: Newspaper,  color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
  blog_post:      { label: "Blog Post",      icon: FileText,   color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
  video:          { label: "Video",          icon: Tv2,        color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  podcast:        { label: "Podcast",        icon: Mic2,       color: "text-green-600",  bg: "bg-green-50 border-green-100" },
  linkedin_post:  { label: "LinkedIn Post",  icon: Share2,     color: "text-sky-600",    bg: "bg-sky-50 border-sky-100" },
  press_release:  { label: "Press Release",  icon: Megaphone,  color: "text-amber-600",  bg: "bg-amber-50 border-amber-100" },
};

function getMediaConfig(type: string) {
  return MEDIA_CONFIG[type] ?? { label: type, icon: ExternalLink, color: "text-muted-foreground", bg: "bg-secondary border-border" };
}

const MEDIA_ORDER = ["video", "podcast", "article", "blog_post", "linkedin_post", "press_release"];

function LockedSection({
  onReveal,
  isRevealing,
  outOfCredits,
  creditStatus,
}: {
  onReveal: () => void;
  isRevealing: boolean;
  outOfCredits: boolean;
  creditStatus?: { tier: string; creditsUsed: number; creditsTotal: number | null; isUnlimited: boolean } | null;
}) {
  if (outOfCredits) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Credit limit reached</p>
          <p className="text-xs text-muted-foreground mt-1">
            You've used all {creditStatus?.creditsTotal?.toLocaleString()} credits for this month.
          </p>
          {creditStatus?.tier === "freemium" && (
            <p className="text-xs text-primary font-medium mt-2">Upgrade to Professional for 10,000 monthly credits.</p>
          )}
        </div>
      </div>
    );
  }

  const remaining = creditStatus?.isUnlimited
    ? null
    : (creditStatus?.creditsTotal ?? 0) - (creditStatus?.creditsUsed ?? 0);

  return (
    <div className="flex flex-col items-center gap-4 py-5">
      {/* Blurred preview rows */}
      <div className="w-full space-y-3 blur-sm pointer-events-none select-none" aria-hidden>
        <div className="h-14 bg-muted rounded-xl w-full" />
        <div className="h-14 bg-muted rounded-xl w-full" />
        <div className="h-14 bg-muted rounded-xl w-4/5" />
      </div>

      {/* Reveal button */}
      <div className="flex flex-col items-center gap-2 -mt-1">
        <button
          onClick={onReveal}
          disabled={isRevealing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
        >
          {isRevealing ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Revealing…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Reveal — 1 Credit
            </>
          )}
        </button>
        {creditStatus && !creditStatus.isUnlimited && remaining !== null && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {remaining} credit{remaining !== 1 ? "s" : ""} remaining this month
          </p>
        )}
      </div>
    </div>
  );
}

export default function CompanyProfile() {
  const [, params] = useRoute("/companies/:id");
  const id = parseInt(params?.id || "0");

  const { data: company, isLoading, isError } = useGetCompany(id, {
    query: { enabled: !!id }
  });
  const competitorIds = useCompetitorIds();
  const { data: insights = [] } = useGetCompanyInsights(id, {
    query: { enabled: !!id }
  });
  const { data: revealStatus, isLoading: revealLoading } = useCompanyRevealStatus(id);
  const { data: creditStatus } = useCreditsStatus();
  const revealMutation = useRevealCompany();

  const isRevealed = revealStatus?.isRevealed ?? false;
  const outOfCredits =
    !creditStatus?.isUnlimited &&
    (creditStatus?.creditsUsed ?? 0) >= (creditStatus?.creditsTotal ?? 0);

  const handleReveal = () => {
    if (revealMutation.isPending) return;
    revealMutation.mutate(id);
  };

  useEffect(() => {
    if (company) {
      document.title = `${company.name} on Whyhello`;
    }
    return () => { document.title = "Whyhello"; };
  }, [company]);

  const groupedInsights = insights.reduce<Record<string, typeof insights>>((acc, insight) => {
    const key = insight.mediaType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(insight);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groupedInsights).sort(([a], [b]) => {
    const ai = MEDIA_ORDER.indexOf(a);
    const bi = MEDIA_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 max-w-5xl mx-auto animate-pulse space-y-8">
          <div className="h-10 w-24 bg-muted rounded" />
          <div className="h-64 bg-card border rounded-3xl" />
        </div>
      </Shell>
    );
  }

  if (isError || !company) {
    return (
      <Shell>
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Company not found</h2>
          <Link href="/"><Button>Back to Search</Button></Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/?tab=companies" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Directory
        </Link>

        {/* Company Header Card */}
        <div className="bg-card rounded-3xl shadow-sm border border-border/60 overflow-hidden mb-8">
           {competitorIds.has(id)
             ? <div className="h-24 bg-gradient-to-r from-rose-100 to-red-50 border-b border-rose-200/70" />
             : <div className="h-24 bg-gradient-to-r from-slate-100 to-indigo-50 border-b border-border/50" />
           }
           <div className="px-8 pb-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="-mt-12 relative z-10">
                  <div className="h-24 w-24 rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                </div>
                <div className="flex-1 pt-2 flex justify-between items-start w-full">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h1 className="text-3xl font-display font-bold text-foreground">{company.name}</h1>
                      {competitorIds.has(id) && <CompetitorBadge />}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
                      {company.location && (
                        <span className="flex items-center text-muted-foreground gap-1"><MapPin className="h-4 w-4" /> {company.location}</span>
                      )}
                      {company.website && (
                         <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="flex items-center text-primary hover:underline gap-1">
                           <Globe className="h-4 w-4" /> {company.website} <ExternalLink className="h-3 w-3 ml-0.5" />
                         </a>
                      )}
                    </div>
                  </div>
                  {company.linkedinUrl && (
                    <Button variant="outline" size="sm" className="gap-2 text-[#0A66C2] border-[#0A66C2]/20 hover:bg-[#0A66C2]/10">
                      <Linkedin className="h-4 w-4" /> Follow
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Company Size</p>
                  <p className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {company.size || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Employees</p>
                  <p className="font-semibold">{formatNumber(company.employeeCount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Founded</p>
                  <p className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> {company.foundedYear || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Headquarters</p>
                  <p className="font-semibold">{company.country || 'N/A'}</p>
                </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Left Col: Description + Insights + Contacts */}
           <div className="col-span-1 lg:col-span-2 space-y-8">
              {company.description && (
                <section>
                  <h2 className="text-xl font-bold mb-4">About {company.name}</h2>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    <p className="leading-relaxed text-base">{company.description}</p>
                  </div>
                </section>
              )}

              {/* ── Company Insights (credit-gated) ── */}
              <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Company Insights
                    </h2>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Press coverage, videos, podcasts & announcements
                    </p>
                  </div>
                  {isRevealed && sortedGroups.length > 0 && (
                    <span className="text-xs bg-secondary px-2.5 py-1 rounded-full font-medium text-muted-foreground">
                      {insights.length} {insights.length === 1 ? "result" : "results"}
                    </span>
                  )}
                </div>

                {isRevealed ? (
                  sortedGroups.length > 0 ? (
                    <div className="space-y-8">
                      {sortedGroups.map(([type, items]) => {
                        const cfg = getMediaConfig(type);
                        const Icon = cfg.icon;
                        return (
                          <div key={type}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={cn("w-6 h-6 rounded-md flex items-center justify-center border", cfg.bg)}>
                                <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                              </div>
                              <span className={cn("text-xs font-semibold uppercase tracking-wider", cfg.color)}>
                                {cfg.label}
                              </span>
                              <span className="text-xs text-muted-foreground/50 font-medium">
                                {items.length}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {items.map((insight) => (
                                <a
                                  key={insight.id}
                                  href={insight.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block group"
                                >
                                  <div className="flex gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/25 hover:shadow-sm hover:bg-secondary/30 transition-all duration-200">
                                    <div className={cn(
                                      "w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5",
                                      cfg.bg
                                    )}>
                                      <Icon className={cn("h-4 w-4", cfg.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                                          {insight.title}
                                        </p>
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                                      </div>
                                      {insight.description && (
                                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                                          {insight.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 mt-2.5">
                                        <span className="text-xs font-medium text-muted-foreground/70">
                                          {insight.source}
                                        </span>
                                        {insight.publishedDate && (
                                          <>
                                            <span className="text-muted-foreground/30 text-xs">·</span>
                                            <span className="text-xs text-muted-foreground/60">
                                              {insight.publishedDate}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No insights found for this company.</p>
                  )
                ) : (
                  <LockedSection
                    onReveal={handleReveal}
                    isRevealing={revealMutation.isPending || revealLoading}
                    outOfCredits={outOfCredits}
                    creditStatus={creditStatus}
                  />
                )}
              </section>

              {/* Contacts Table */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Key Contacts</h2>
                  <Badge variant="outline">{company.contacts?.length || 0} employees found</Badge>
                </div>
                
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  {(!company.contacts || company.contacts.length === 0) ? (
                    <div className="p-8 text-center text-muted-foreground">No contacts found for this company.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {company.contacts.map((contact) => (
                        <Link key={contact.id} href={`/contacts/${contact.id}`} className="block hover:bg-muted/50 transition-colors">
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                {getInitials(`${contact.firstName} ${contact.lastName}`)}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{contact.firstName} {contact.lastName}</p>
                                <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                               {contact.department && <span className="text-muted-foreground hidden sm:inline-block">{contact.department}</span>}
                               {contact.seniority && <Badge variant="outline" className="hidden md:inline-flex">{contact.seniority}</Badge>}
                               <Button variant="ghost" size="sm" className="h-8">View Profile</Button>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
           </div>

           {/* Right Col: Sidebar */}
           <div className="col-span-1">
              <div className="bg-secondary/30 rounded-2xl p-6 border border-border/50 sticky top-24">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Similar Companies</h3>
                <div className="text-sm text-muted-foreground text-center py-8">
                   Data enrichment required to view competitors.
                </div>
              </div>
           </div>
        </div>
      </div>
    </Shell>
  );
}
