import { useRoute, Link } from "wouter";
import { useEffect, useState } from "react";
import {
  useGetContact,
  useGetContactInsights,
  useRevealStatus,
  useRevealContact,
  useCreditsStatus,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { ComposeDrawer } from "@/components/ComposeDrawer";
import {
  ArrowLeft, Mail, Phone, MapPin, Building, Briefcase,
  Linkedin, Twitter, ExternalLink, Newspaper, Tv2,
  Mic2, FileText, Share2, Megaphone, ChevronRight,
  Lock, Zap, AlertCircle, Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getInitials, cn } from "@/lib/utils";

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

export default function ContactProfile() {
  const [, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");

  const { data: contact, isLoading, isError } = useGetContact(id, {
    query: { enabled: !!id }
  });
  const { data: insights = [] } = useGetContactInsights(id, {
    query: { enabled: !!id }
  });
  const { data: revealStatus, isLoading: revealLoading } = useRevealStatus(id);
  const { data: creditStatus } = useCreditsStatus();
  const revealMutation = useRevealContact();

  const isRevealed = revealStatus?.isRevealed ?? false;
  const outOfCredits =
    !creditStatus?.isUnlimited &&
    (creditStatus?.creditsUsed ?? 0) >= (creditStatus?.creditsTotal ?? 0);

  const [composeOpen, setComposeOpen] = useState(false);

  const handleReveal = () => {
    if (revealMutation.isPending) return;
    revealMutation.mutate(id);
  };

  useEffect(() => {
    if (contact) {
      document.title = `${contact.firstName} ${contact.lastName} on Whyhello`;
    }
    return () => { document.title = "Whyhello"; };
  }, [contact]);

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 max-w-5xl mx-auto animate-pulse space-y-6">
          <div className="h-8 w-28 bg-muted rounded" />
          <div className="bg-card border rounded-2xl p-8 flex items-start gap-6">
            <div className="w-28 h-28 bg-muted rounded-full flex-shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="h-7 bg-muted rounded w-2/5" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (isError || !contact) {
    return (
      <Shell>
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Contact not found</h2>
          <Link href="/"><Button>Back to Search</Button></Link>
        </div>
      </Shell>
    );
  }

  // Group insights by media type
  const groupedInsights = insights.reduce<Record<string, typeof insights>>((acc, insight) => {
    const key = insight.mediaType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(insight);
    return acc;
  }, {});

  const mediaOrder = ["article", "press_release", "video", "podcast", "blog_post", "linkedin_post"];
  const sortedGroups = Object.entries(groupedInsights).sort(([a], [b]) => {
    const ai = mediaOrder.indexOf(a);
    const bi = mediaOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const hasContactInfo = contact.email || contact.phone || contact.linkedinUrl || contact.twitterHandle || contact.location || contact.country;

  return (
    <Shell>
      <div className="bg-[#F8FAFC] min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>

          {/* ── Hero Card ───────────────────────────────────── */}
          <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden mb-6">
            <div className="h-28 bg-gradient-to-r from-primary/15 via-indigo-100/60 to-violet-100/40" />
            <div className="px-8 pb-7">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* Avatar */}
                <div className="-mt-14 flex-shrink-0">
                  <div className="h-28 w-28 rounded-full border-4 border-card bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-3xl font-bold text-primary shadow-md">
                    {getInitials(`${contact.firstName} ${contact.lastName}`)}
                  </div>
                </div>

                {/* Name + title */}
                <div className="flex-1 pt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold text-foreground">
                        {contact.firstName} {contact.lastName}
                      </h1>
                      {contact.seniority && (
                        <Badge variant="success" className="text-xs">{contact.seniority}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm flex-wrap">
                      <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{contact.jobTitle}</span>
                      {contact.department && <><span className="opacity-40">·</span><span>{contact.department}</span></>}
                      {contact.company && (
                        <>
                          <span className="opacity-40">at</span>
                          <Link href={`/companies/${contact.company.id}`} className="text-primary font-medium hover:underline">
                            {contact.company.name}
                          </Link>
                        </>
                      )}
                    </div>
                    {contact.bio && (
                      <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed line-clamp-2">
                        {contact.bio}
                      </p>
                    )}
                  </div>

                  {/* CTA buttons — only shown when revealed */}
                  {isRevealed && (
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {contact.email && (
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => setComposeOpen(true)}
                        >
                          <Send className="h-4 w-4" /> Send Email
                        </Button>
                      )}
                      {contact.linkedinUrl && (
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-2 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10">
                            <Linkedin className="h-4 w-4" /> Connect
                          </Button>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Two-column layout ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              {/* ── 1. Contact Info ─────────────────────────── */}
              {hasContactInfo && (
                <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                    Contact Info
                  </h2>

                  {isRevealed ? (
                    <div className="space-y-4">
                      {contact.email && (
                        <ContactInfoRow icon={Mail} label="Email">
                          <a href={`mailto:${contact.email}`} className="text-primary hover:underline break-all">
                            {contact.email}
                          </a>
                        </ContactInfoRow>
                      )}
                      {contact.phone && (
                        <ContactInfoRow icon={Phone} label="Phone">
                          <a href={`tel:${contact.phone}`} className="text-foreground hover:text-primary transition-colors">
                            {contact.phone}
                          </a>
                        </ContactInfoRow>
                      )}
                      {(contact.location || contact.country) && (
                        <ContactInfoRow icon={MapPin} label="Location">
                          <span>{[contact.location, contact.country].filter(Boolean).join(", ")}</span>
                        </ContactInfoRow>
                      )}
                      {contact.linkedinUrl && (
                        <ContactInfoRow icon={Linkedin} label="LinkedIn">
                          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[#0A66C2] hover:underline flex items-center gap-1">
                            View Profile <ExternalLink className="h-3 w-3" />
                          </a>
                        </ContactInfoRow>
                      )}
                      {contact.twitterHandle && (
                        <ContactInfoRow icon={Twitter} label="Twitter">
                          <a href={`https://twitter.com/${contact.twitterHandle.replace("@", "")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:underline">
                            {contact.twitterHandle}
                          </a>
                        </ContactInfoRow>
                      )}
                    </div>
                  ) : (
                    <LockedSection
                      onReveal={handleReveal}
                      isRevealing={revealMutation.isPending || revealLoading}
                      outOfCredits={outOfCredits}
                      creditStatus={creditStatus}
                    />
                  )}
                </section>
              )}

              {/* Current Company */}
              {contact.company && (
                <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    Current Company
                  </h2>
                  <Link href={`/companies/${contact.company.id}`} className="block group">
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors -mx-1">
                      <div className="h-11 w-11 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
                        <Building className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                          {contact.company.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[contact.company.industry, contact.company.size ? `${contact.company.size} emp.` : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                </section>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-2 space-y-6">
              {/* About */}
              {contact.bio && (
                <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    About {contact.firstName}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{contact.bio}</p>
                </section>
              )}

              {/* ── 2. Personal Insights ───────────────────── */}
              <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Personal Insights
                    </h2>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Online presence — articles, videos, podcasts & more
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
                    <p className="text-sm text-muted-foreground text-center py-4">No insights found for this contact.</p>
                  )
                ) : (
                  <LockedSection
                    onReveal={handleReveal}
                    isRevealing={revealMutation.isPending || revealLoading}
                    outOfCredits={outOfCredits}
                    creditStatus={creditStatus}
                    variant="insights"
                  />
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {contact.email && (
        <ComposeDrawer
          isOpen={composeOpen}
          onClose={() => setComposeOpen(false)}
          contact={{
            id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            jobTitle: contact.jobTitle,
            companyName: contact.company?.name,
          }}
          insights={insights}
        />
      )}
    </Shell>
  );
}

function LockedSection({
  onReveal,
  isRevealing,
  outOfCredits,
  creditStatus,
  variant = "contact",
}: {
  onReveal: () => void;
  isRevealing: boolean;
  outOfCredits: boolean;
  creditStatus?: { tier: string; creditsUsed: number; creditsTotal: number | null; isUnlimited: boolean } | null;
  variant?: "contact" | "insights";
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
        {variant === "contact" ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary/70 flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 bg-muted rounded w-12" />
                <div className="h-3 bg-muted rounded w-40" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary/70 flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 bg-muted rounded w-10" />
                <div className="h-3 bg-muted rounded w-32" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary/70 flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 bg-muted rounded w-14" />
                <div className="h-3 bg-muted rounded w-36" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="h-14 bg-muted rounded-xl w-full" />
            <div className="h-14 bg-muted rounded-xl w-full" />
            <div className="h-14 bg-muted rounded-xl w-4/5" />
          </>
        )}
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
            {remaining.toLocaleString()} credit{remaining !== 1 ? "s" : ""} remaining this month
          </p>
        )}
      </div>
    </div>
  );
}

function ContactInfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-secondary/70 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}
