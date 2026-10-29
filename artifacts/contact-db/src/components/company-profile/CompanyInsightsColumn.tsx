import {
  AlertCircle, ExternalLink, FileText, Lock, Megaphone, Mic2, Newspaper, Share2, Tv2, Zap,
} from "lucide-react";
import type { CompanyInsight } from "@workspace/api-client-react";

const MEDIA_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  article: { label: "Article", icon: Newspaper },
  blog_post: { label: "Blog Post", icon: FileText },
  video: { label: "Video", icon: Tv2 },
  podcast: { label: "Podcast", icon: Mic2 },
  linkedin_post: { label: "LinkedIn Post", icon: Share2 },
  press_release: { label: "Press Release", icon: Megaphone },
};
const MEDIA_ORDER = ["video", "podcast", "article", "blog_post", "linkedin_post", "press_release"];

function getMediaConfig(type: string) {
  return MEDIA_CONFIG[type] ?? { label: type.replace(/_/g, " "), icon: ExternalLink };
}

type CreditStatus = { tier: string; creditsUsed: number; creditsTotal: number | null; isUnlimited: boolean } | null | undefined;

function LockedState({ onReveal, isRevealing, outOfCredits, creditStatus }: {
  onReveal: () => void; isRevealing: boolean; outOfCredits: boolean; creditStatus: CreditStatus;
}) {
  if (outOfCredits) {
    return (
      <div className="rounded-xl border border-border bg-card dark:bg-background p-4 text-center" data-testid="status-company-out-of-credits">
        <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Credit limit reached</p>
        <p className="text-xs text-muted-foreground mt-1">
          You've used all {creditStatus?.creditsTotal?.toLocaleString()} credits for this month.
        </p>
        {creditStatus?.tier === "freemium" && (
          <p className="text-xs text-foreground font-medium mt-2">Upgrade to Professional for 10,000 monthly credits.</p>
        )}
      </div>
    );
  }
  const remaining = creditStatus?.isUnlimited ? null : (creditStatus?.creditsTotal ?? 0) - (creditStatus?.creditsUsed ?? 0);
  return (
    <div className="rounded-xl border border-border bg-card dark:bg-background p-4">
      <div className="space-y-2 blur-sm pointer-events-none select-none" aria-hidden>
        <div className="h-12 bg-muted rounded-lg" />
        <div className="h-12 bg-muted rounded-lg" />
        <div className="h-12 bg-muted rounded-lg w-4/5" />
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
        Press coverage, videos, podcasts and announcements are hidden until this company is revealed.
      </p>
      <button
        type="button"
        onClick={onReveal}
        disabled={isRevealing}
        data-testid="button-reveal-company"
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {isRevealing ? (
          <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Revealing…</>
        ) : (
          <><Lock className="h-4 w-4" />Reveal — 1 Credit</>
        )}
      </button>
      {creditStatus && !creditStatus.isUnlimited && remaining !== null && (
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-2">
          <Zap className="h-3 w-3" />{remaining} credit{remaining !== 1 ? "s" : ""} remaining this month
        </p>
      )}
    </div>
  );
}

export function CompanyInsightsColumn({
  insights, insightsLoading, insightsError, onRetry, isRevealed, revealLoading, isRevealing, revealError,
  onReveal, outOfCredits, creditStatus,
}: {
  insights: CompanyInsight[];
  insightsLoading: boolean;
  insightsError: boolean;
  onRetry: () => void;
  isRevealed: boolean;
  revealLoading: boolean;
  isRevealing: boolean;
  revealError: boolean;
  onReveal: () => void;
  outOfCredits: boolean;
  creditStatus: CreditStatus;
}) {
  const groups = Object.entries(
    insights.reduce<Record<string, CompanyInsight[]>>((acc, i) => {
      (acc[i.mediaType] ??= []).push(i);
      return acc;
    }, {}),
  ).sort(([a], [b]) => {
    const ai = MEDIA_ORDER.indexOf(a), bi = MEDIA_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  let body: React.ReactNode;
  if (revealLoading) {
    body = <div className="space-y-2 animate-pulse">{[0, 1, 2].map(k => <div key={k} className="h-16 rounded-xl border border-border bg-muted/50" />)}</div>;
  } else if (!isRevealed) {
    body = (
      <>
        <LockedState onReveal={onReveal} isRevealing={isRevealing} outOfCredits={outOfCredits} creditStatus={creditStatus} />
        {revealError && <p className="text-xs text-destructive mt-2 text-center">Reveal failed. No insights were unlocked; try again.</p>}
      </>
    );
  } else if (insightsLoading) {
    body = <div className="space-y-2 animate-pulse">{[0, 1, 2].map(k => <div key={k} className="h-16 rounded-xl border border-border bg-muted/50" />)}</div>;
  } else if (insightsError) {
    body = (
      <div className="rounded-xl border border-border p-4 text-center">
        <p className="text-sm text-foreground">Couldn't load company insights.</p>
        <button type="button" onClick={onRetry} data-testid="button-retry-insights" className="mt-2 text-xs font-semibold border border-border rounded-md px-3 py-1.5 hover:bg-muted transition-colors">Retry</button>
      </div>
    );
  } else if (groups.length === 0) {
    body = <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No insights found for this company.</div>;
  } else {
    body = (
      <div className="space-y-5">
        {groups.map(([type, items]) => {
          const cfg = getMediaConfig(type);
          const Icon = cfg.icon;
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />{cfg.label}<span className="text-muted-foreground/60">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(insight => (
                  <a key={insight.id} href={insight.url} target="_blank" rel="noopener noreferrer" data-testid={`link-insight-${insight.id}`}
                    className="group block rounded-xl border border-border bg-card dark:bg-background p-3 hover:border-foreground/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{insight.title}</p>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </div>
                    {insight.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{insight.description}</p>}
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {insight.source}{insight.publishedDate ? ` · ${insight.publishedDate}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className="md:h-full md:min-h-0 md:overflow-y-auto scroll-thin md:pr-1" data-testid="column-company-insights">
      <div className="md:sticky top-0 z-10 bg-background pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Company Insights</h2>
          <p className="text-xs text-muted-foreground/80">Press, video, podcasts and announcements</p>
        </div>
        {isRevealed && insights.length > 0 && (
          <span className="text-xs border border-border px-2 py-0.5 rounded-full text-muted-foreground">{insights.length}</span>
        )}
      </div>
      {body}
    </section>
  );
}
