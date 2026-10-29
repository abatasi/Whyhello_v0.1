import { useRoute, Link } from "wouter";
import { useEffect } from "react";
import { recordCompanyVisit } from "@/lib/recentVisits";
import { CompetitorBadge, useCompetitorIds } from "@/components/CompetitorBadge";
import {
  useGetCompany,
  useGetCompanyInsights,
  useCompanyRevealStatus,
  useRevealCompany,
  useCreditsStatus,
  getGetCompanyQueryKey,
  getGetCompanyInsightsQueryKey,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { ArrowLeft, Building2, MapPin, Globe, ExternalLink, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/utils";
import { CompanyInsightsColumn } from "@/components/company-profile/CompanyInsightsColumn";
import { CompanyContactsColumn } from "@/components/company-profile/CompanyContactsColumn";

function externalHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card dark:bg-background p-3 min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground break-words">{value ?? <span className="text-muted-foreground font-normal">Not available</span>}</p>
    </div>
  );
}

export default function CompanyProfile() {
  const [, params] = useRoute("/companies/:id");
  const id = parseInt(params?.id || "0");

  const { data: company, isLoading, isError } = useGetCompany(id, {
    query: { enabled: !!id, refetchOnMount: "always", queryKey: getGetCompanyQueryKey(id) },
  });
  const competitorIds = useCompetitorIds();
  const insightsQuery = useGetCompanyInsights(id, { query: { enabled: !!id, queryKey: getGetCompanyInsightsQueryKey(id) } });
  const insights = insightsQuery.data ?? [];
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
      recordCompanyVisit(company.id, company.name, company.industry ?? null);
    }
    return () => { document.title = "Whyhello"; };
  }, [company]);

  if (isLoading) {
    return (
      <Shell>
        <div className="flex-1 min-h-0 px-3 sm:px-6 pt-4 grid gap-5 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] animate-pulse" data-testid="status-company-loading">
          {[0, 1, 2].map(k => (
            <div key={k} className="space-y-3">
              <div className="h-24 rounded-2xl border border-border bg-muted/50" />
              <div className="h-40 rounded-2xl border border-border bg-muted/40" />
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (isError || !company) {
    return (
      <Shell>
        <div className="p-8 text-center mt-20" data-testid="status-company-not-found">
          <h2 className="text-2xl font-bold mb-4">Company not found</h2>
          <Link href="/directory/companies"><Button>Back to Directory</Button></Link>
        </div>
      </Shell>
    );
  }

  const isCompetitor = competitorIds.has(id);
  const contacts = company.contacts ?? [];

  return (
    <Shell>
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden overflow-x-hidden">
        <div className="px-3 sm:px-6 pt-3 flex-shrink-0">
          <Link href="/directory/companies" data-testid="link-back-directory"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Directory
          </Link>
        </div>

        <div className="flex-none md:flex-1 min-h-0 px-3 sm:px-6 pt-3 pb-6 md:pb-4 grid gap-6 md:gap-5 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] md:[grid-template-rows:minmax(0,1fr)]">
          {/* Center: identity + overview (first on mobile) */}
          <section className="md:order-2 md:h-full md:min-h-0 md:overflow-y-auto scroll-thin flex flex-col gap-4 min-w-0" data-testid="column-company-overview">
            <header data-testid="company-sticky-identity"
              className="md:sticky top-0 z-20 flex-shrink-0 rounded-2xl border border-border bg-card dark:bg-background px-4 py-3 shadow-sm sm:px-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold text-foreground leading-tight" data-testid="text-company-name">{company.name}</h1>
                    {company.liveTargetMarketName && (
                      <Badge variant="outline"
                        className="border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-background dark:text-teal-300"
                        title={`Meets all criteria for your live Target Market: ${company.liveTargetMarketName}`}>
                        Live Target Market · {company.liveTargetMarketName}
                      </Badge>
                    )}
                    {isCompetitor && <CompetitorBadge />}
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-muted-foreground mt-1">
                    {company.industry && <span>{company.industry}</span>}
                    {company.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{company.location}</span>}
                  </div>
                </div>
              </div>
              {(company.website || company.linkedinUrl) && (
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {company.website && (
                    <a href={externalHref(company.website)} target="_blank" rel="noreferrer" data-testid="link-company-website"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors max-w-full">
                      <Globe className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{company.website}</span><ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  )}
                  {company.linkedinUrl && (
                    <a href={externalHref(company.linkedinUrl)} target="_blank" rel="noreferrer" data-testid="link-company-linkedin"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                      <Linkedin className="h-3.5 w-3.5" />LinkedIn<ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </header>

            <div className="rounded-2xl border border-border bg-card dark:bg-background p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">About {company.name}</h2>
              {company.description ? (
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line" data-testid="text-company-description">{company.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description available for this company.</p>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Company Facts</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Fact label="Industry" value={company.industry} />
                <Fact label="Company Size" value={company.size} />
                <Fact label="Employees" value={company.employeeCount != null ? formatNumber(company.employeeCount) : null} />
                <Fact label="Founded" value={company.foundedYear} />
                <Fact label="Location" value={company.location} />
                <Fact label="Country" value={company.country} />
              </div>
            </div>
          </section>

          <div className="md:order-1 min-w-0 md:min-h-0">
            <CompanyInsightsColumn
              insights={insights}
              insightsLoading={insightsQuery.isLoading}
              insightsError={insightsQuery.isError}
              onRetry={() => insightsQuery.refetch()}
              isRevealed={isRevealed}
              revealLoading={revealLoading}
              isRevealing={revealMutation.isPending}
              revealError={revealMutation.isError}
              onReveal={handleReveal}
              outOfCredits={outOfCredits}
              creditStatus={creditStatus}
            />
          </div>

          <div className="md:order-3 min-w-0 md:min-h-0">
            <CompanyContactsColumn contacts={contacts} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
