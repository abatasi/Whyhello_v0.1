import { useRoute, Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  useGetContact,
  useGetContactInsights,
  useGetContactIndustryInsights,
  useGetContactRoleInsights,
  useGetContactColleagueInsights,
  useGetContactCounterpartInsights,
  useGetCompanyInsights,
  useRevealStatus,
  useRevealContact,
  useCreditsStatus,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { ComposeDrawer } from "@/components/ComposeDrawer";
import {
  ArrowLeft, Mail, Phone, MapPin, Building, Briefcase,
  Linkedin, Twitter, ExternalLink, Newspaper, Tv2,
  Mic2, FileText, Share2, Megaphone, ChevronDown,
  Lock, Zap, AlertCircle, Send, User, TrendingUp,
  Users, Handshake, MessageSquare, Sparkles, PenLine,
  StickyNote, Globe, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getInitials, cn } from "@/lib/utils";

// ── Media type config ──────────────────────────────────────────────────────

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

// ── Insight category definitions ───────────────────────────────────────────

type InsightItem = { id: number; title: string; url: string; source: string; publishedDate?: string | null; mediaType: string; description?: string | null };

interface InsightCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  accentBg: string;
  accentBorder: string;
}

const INSIGHT_CATEGORIES: InsightCategory[] = [
  { id: "personal",     label: "Personal",     description: "Posts, videos & features about this contact",  icon: User,        color: "text-indigo-600",  accentBg: "bg-indigo-50",  accentBorder: "border-indigo-200" },
  { id: "company",      label: "Company",      description: "News, press releases & content from the company", icon: Building,    color: "text-amber-600",   accentBg: "bg-amber-50",   accentBorder: "border-amber-200"  },
  { id: "industry",     label: "Industry",     description: "Trends & publications across the industry",     icon: TrendingUp,  color: "text-emerald-600", accentBg: "bg-emerald-50", accentBorder: "border-emerald-200"},
  { id: "role",         label: "Role",         description: "Content relevant to this contact's function",   icon: Briefcase,   color: "text-violet-600",  accentBg: "bg-violet-50",  accentBorder: "border-violet-200" },
  { id: "colleague",    label: "Colleague",    description: "Content featuring teammates & peers",           icon: Users,       color: "text-sky-600",     accentBg: "bg-sky-50",     accentBorder: "border-sky-200"    },
  { id: "counterpart",  label: "Counterpart",  description: "Competitor & partner-side perspectives",        icon: Handshake,   color: "text-rose-600",    accentBg: "bg-rose-50",    accentBorder: "border-rose-200"   },
];

// ── Main component ─────────────────────────────────────────────────────────

export default function ContactProfile() {
  const [, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");

  const { data: contact, isLoading, isError } = useGetContact(id, { query: { enabled: !!id } });
  const { data: personalInsights = [] } = useGetContactInsights(id, { query: { enabled: !!id } });
  const { data: industryInsights = [] } = useGetContactIndustryInsights(id, { query: { enabled: !!id } });
  const { data: roleInsights = [] } = useGetContactRoleInsights(id, { query: { enabled: !!id } });
  const { data: colleagueInsights = [] } = useGetContactColleagueInsights(id, { query: { enabled: !!id } });
  const { data: counterpartInsights = [] } = useGetContactCounterpartInsights(id, { query: { enabled: !!id } });
  const companyIdForInsights = contact?.company?.id ?? 0;
  const { data: companyInsights = [] } = useGetCompanyInsights(companyIdForInsights, { query: { enabled: companyIdForInsights > 0 } });
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
    if (contact) document.title = `${contact.firstName} ${contact.lastName} on Whyhello`;
    return () => { document.title = "Whyhello"; };
  }, [contact]);

  const categoryData: Record<string, InsightItem[]> = {
    personal:     personalInsights as InsightItem[],
    industry:     industryInsights as InsightItem[],
    role:         roleInsights as InsightItem[],
    colleague:    colleagueInsights as InsightItem[],
    counterpart:  counterpartInsights as InsightItem[],
    company:      companyInsights as InsightItem[],
  };

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-6 w-24 bg-muted rounded" />
          <div className="grid grid-cols-[30%_1fr_30%] gap-5">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-xl" />)}
            </div>
            <div className="space-y-4">
              <div className="h-40 bg-muted rounded-2xl" />
              <div className="h-32 bg-muted rounded-2xl" />
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}
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

  return (
    <Shell>
      <div className="bg-[#F8FAFC] min-h-full">
        <div className="px-6 py-6">

          {/* Back nav */}
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-5 transition-colors gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>

          {/* ── Three-column grid: 20 / 60 / 20 ──────────────────────────── */}
          <div className="grid gap-5 items-start" style={{ gridTemplateColumns: "20% 1fr 20%" }}>

            {/* ══════════════════════════════════════════════════════════════
                LEFT COLUMN — Insights
            ═══════════════════════════════════════════════════════════════ */}
            <aside className="space-y-3 sticky top-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Insights</h2>
                <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {personalInsights.length + industryInsights.length + roleInsights.length + colleagueInsights.length + counterpartInsights.length + companyInsights.length} sources
                </span>
              </div>

              {INSIGHT_CATEGORIES.map((cat) => {
                const items = categoryData[cat.id] ?? [];
                const isPlaceholder = false;
                const isLocked = cat.id === "personal" && !isRevealed;

                return (
                  <InsightCategoryPanel
                    key={cat.id}
                    category={cat}
                    items={items}
                    isPlaceholder={isPlaceholder}
                    isLocked={isLocked}
                    onReveal={handleReveal}
                    isRevealing={revealMutation.isPending || revealLoading}
                    outOfCredits={outOfCredits}
                  />
                );
              })}
            </aside>

            {/* ══════════════════════════════════════════════════════════════
                CENTER COLUMN — Contact Hub
            ═══════════════════════════════════════════════════════════════ */}
            <main className="flex flex-col gap-5">

              {/* ── Merged Identity + Contact Details card ── */}
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="h-20 bg-gradient-to-r from-primary/15 via-indigo-100/60 to-violet-100/40" />
                <div className="px-6 pb-5">
                  <div className="flex items-end gap-4 -mt-10 mb-3">
                    <div className="h-18 w-18 rounded-full border-4 border-card bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-xl font-bold text-primary shadow-md flex-shrink-0" style={{ height: "4.5rem", width: "4.5rem" }}>
                      {getInitials(`${contact.firstName} ${contact.lastName}`)}
                    </div>
                    <div className="pb-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-bold text-foreground leading-tight">
                          {contact.firstName} {contact.lastName}
                        </h1>
                        {contact.seniority && (
                          <Badge variant="success" className="text-xs">{contact.seniority}</Badge>
                        )}
                      </div>
                    </div>
                    {isRevealed && (
                      <div className="flex gap-2 flex-shrink-0 pb-1">
                        {contact.email && (
                          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setComposeOpen(true)}>
                            <Send className="h-3.5 w-3.5" /> Email
                          </Button>
                        )}
                        {contact.linkedinUrl && (
                          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10">
                              <Linkedin className="h-3.5 w-3.5" /> Connect
                            </Button>
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Role + Company */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-medium text-foreground">{contact.jobTitle}</span>
                    {contact.department && (
                      <><span className="opacity-40">·</span><span>{contact.department}</span></>
                    )}
                    {contact.company && (
                      <>
                        <span className="opacity-40">at</span>
                        <Link href={`/companies/${contact.company.id}`} className="text-primary font-semibold hover:underline flex items-center gap-1">
                          {contact.company.name}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </>
                    )}
                  </div>

                  {contact.bio && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                      {contact.bio}
                    </p>
                  )}

                  {/* ── Contact Details (merged) ── */}
                  <div className="border-t border-border/40 mt-4 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Contact Details</p>
                    {isRevealed ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                        {contact.email && (
                          <ContactDetailField icon={Mail} label="Email">
                            <a href={`mailto:${contact.email}`} className="text-primary hover:underline break-all text-xs">
                              {contact.email}
                            </a>
                          </ContactDetailField>
                        )}
                        {contact.phone && (
                          <ContactDetailField icon={Phone} label="Phone">
                            <a href={`tel:${contact.phone}`} className="text-foreground hover:text-primary transition-colors text-xs">
                              {contact.phone}
                            </a>
                          </ContactDetailField>
                        )}
                        {(contact.location || contact.country) && (
                          <ContactDetailField icon={MapPin} label="Location">
                            <span className="text-xs">{[contact.location, contact.country].filter(Boolean).join(", ")}</span>
                          </ContactDetailField>
                        )}
                        {contact.linkedinUrl && (
                          <ContactDetailField icon={Linkedin} label="LinkedIn">
                            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[#0A66C2] hover:underline flex items-center gap-1 text-xs">
                              View Profile <ExternalLink className="h-3 w-3" />
                            </a>
                          </ContactDetailField>
                        )}
                        {contact.twitterHandle && (
                          <ContactDetailField icon={Twitter} label="Twitter">
                            <a href={`https://twitter.com/${contact.twitterHandle.replace("@", "")}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs">
                              {contact.twitterHandle}
                            </a>
                          </ContactDetailField>
                        )}
                        {contact.company?.industry && (
                          <ContactDetailField icon={TrendingUp} label="Industry">
                            <span className="text-xs">{contact.company.industry}</span>
                          </ContactDetailField>
                        )}
                        {contact.company?.size && (
                          <ContactDetailField icon={Users} label="Company Size">
                            <span className="text-xs">{contact.company.size} employees</span>
                          </ContactDetailField>
                        )}
                        {contact.company?.website && (
                          <ContactDetailField icon={Globe} label="Website">
                            <a href={contact.company.website} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-xs truncate">
                              {contact.company.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          </ContactDetailField>
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
                  </div>
                </div>
              </div>

              {/* ── Strategy Assistant (live chatbot) ── */}
              <ContactChat id={id} contact={contact} />
            </main>

            {/* ══════════════════════════════════════════════════════════════
                RIGHT COLUMN — Outreach Sandbox
            ═══════════════════════════════════════════════════════════════ */}
            <aside className="space-y-3 sticky top-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Outreach</h2>
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Sandbox</span>
              </div>

              {/* Draft Email */}
              <SandboxCard
                icon={PenLine}
                title="Draft Email"
                description="Compose a personalized email using insights from this contact's profile."
                action={isRevealed && contact.email ? (
                  <Button size="sm" className="w-full h-8 text-xs gap-1.5 mt-3" onClick={() => setComposeOpen(true)}>
                    <Send className="h-3.5 w-3.5" /> Open Composer
                  </Button>
                ) : undefined}
                locked={!isRevealed}
              />

              {/* LinkedIn Message */}
              <SandboxCard
                icon={Linkedin}
                title="LinkedIn Message"
                description="Craft a connection request or InMail tailored to this contact."
                comingSoon
              />

              {/* Talking Points */}
              <SandboxCard
                icon={MessageSquare}
                title="Talking Points"
                description="Generate a list of conversation starters based on recent activity and shared context."
                comingSoon
              />

              {/* Notes */}
              <SandboxCard
                icon={StickyNote}
                title="Notes"
                description="Capture your observations, ideas, and next steps for this contact."
                comingSoon
              />
            </aside>

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
          insights={personalInsights}
          companyInsights={companyInsights}
        />
      )}
    </Shell>
  );
}

// ── InsightCategoryPanel ───────────────────────────────────────────────────

function InsightCategoryPanel({
  category,
  items,
  isPlaceholder,
  isLocked,
  onReveal,
  isRevealing,
  outOfCredits,
}: {
  category: InsightCategory;
  items: InsightItem[];
  isPlaceholder: boolean;
  isLocked: boolean;
  onReveal: () => void;
  isRevealing: boolean;
  outOfCredits: boolean;
}) {
  const [open, setOpen] = useState(true);
  const Icon = category.icon;
  const count = items.length;

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all",
      open ? "border-border/80 shadow-sm" : "border-border/40",
    )}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 group"
      >
        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 border", category.accentBg, category.accentBorder)}>
          <Icon className={cn("h-3.5 w-3.5", category.color)} />
        </div>
        <span className="flex-1 text-left text-xs font-semibold text-foreground">{category.label}</span>
        {isPlaceholder ? (
          <span className="text-[9px] font-medium text-muted-foreground/60 bg-secondary px-1.5 py-0.5 rounded-full">Soon</span>
        ) : isLocked ? (
          <Lock className="h-3 w-3 text-muted-foreground/50" />
        ) : count > 0 ? (
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", category.accentBg, category.color)}>
            {count}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">0</span>
        )}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground/60 transition-transform flex-shrink-0",
          open ? "rotate-180" : ""
        )} />
      </button>

      {open && (
        <div className="border-t border-border/40">
          {isPlaceholder ? (
            <PlaceholderCategoryContent category={category} />
          ) : isLocked ? (
            <LockedCategoryContent onReveal={onReveal} isRevealing={isRevealing} outOfCredits={outOfCredits} />
          ) : count === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 px-3">
              No sources found.
            </p>
          ) : (
            <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
              {items.map((item) => {
                const cfg = getMediaConfig(item.mediaType);
                const MIcon = cfg.icon;
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 px-3 py-2.5 hover:bg-secondary/40 transition-colors group"
                  >
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border", cfg.bg)}>
                      <MIcon className={cn("h-2.5 w-2.5", cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {item.source}{item.publishedDate ? ` · ${item.publishedDate}` : ""}
                      </p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceholderCategoryContent({ category }: { category: InsightCategory }) {
  const Icon = category.icon;
  return (
    <div className="px-3 py-4 flex flex-col items-center gap-2 text-center">
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center border", category.accentBg, category.accentBorder)}>
        <Icon className={cn("h-4 w-4 opacity-40", category.color)} />
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">{category.label} insights</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{category.description}</p>
      </div>
      <span className="text-[10px] font-semibold text-primary/70 bg-primary/8 px-2 py-0.5 rounded-full border border-primary/15">
        Coming soon
      </span>
    </div>
  );
}

function LockedCategoryContent({
  onReveal, isRevealing, outOfCredits,
}: {
  onReveal: () => void;
  isRevealing: boolean;
  outOfCredits: boolean;
}) {
  return (
    <div className="px-3 py-4 flex flex-col items-center gap-2 text-center">
      <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {outOfCredits ? (
        <p className="text-[10px] text-muted-foreground">Credit limit reached this month.</p>
      ) : (
        <>
          <p className="text-[10px] text-muted-foreground">Reveal this contact to unlock insights.</p>
          <Button
            size="sm"
            className="h-7 text-xs px-3 gap-1"
            onClick={onReveal}
            disabled={isRevealing}
          >
            <Zap className="h-3 w-3" />
            {isRevealing ? "Unlocking…" : "Reveal"}
          </Button>
        </>
      )}
    </div>
  );
}

// ── SandboxCard ────────────────────────────────────────────────────────────

function SandboxCard({
  icon: Icon,
  title,
  description,
  action,
  comingSoon,
  locked,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  comingSoon?: boolean;
  locked?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 transition-all",
      comingSoon || locked ? "opacity-70 border-border/40" : "border-border/70 shadow-sm",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
          comingSoon || locked ? "bg-secondary" : "bg-primary/10",
        )}>
          <Icon className={cn("h-3.5 w-3.5", comingSoon || locked ? "text-muted-foreground" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            {comingSoon && (
              <span className="text-[9px] font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">Soon</span>
            )}
            {locked && (
              <Lock className="h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          {action}
        </div>
      </div>
    </div>
  );
}

// ── ContactDetailField ─────────────────────────────────────────────────────

function ContactDetailField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-0.5">{label}</p>
        <div className="truncate">{children}</div>
      </div>
    </div>
  );
}

// ── ContactChat ────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

const STARTERS = (firstName: string) => [
  `What are ${firstName}'s key professional priorities right now?`,
  `Suggest a conversation opener based on their recent activity`,
  `Draft a short LinkedIn outreach message to ${firstName}`,
  `What topics would resonate most with ${firstName}?`,
];

function ContactChat({ id, contact }: { id: number; contact: { firstName: string } }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const resp = await fetch(`/api/contacts/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!resp.ok || !resp.body) throw new Error("Request failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) break;
            if (data.content) {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "assistant",
                  content: next[next.length - 1].content + data.content,
                };
                return next;
              });
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Please try again." };
        return next;
      });
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div
      className="flex flex-col rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden"
      style={{ height: "calc(100vh - 24rem)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-foreground">Strategy Assistant</span>
        <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
          AI
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ask me about {contact.firstName}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                I have access to their insights, company context, and professional background.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {STARTERS(contact.firstName).map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/70 border border-border text-muted-foreground text-left transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-foreground rounded-tl-sm",
                  )}
                >
                  {msg.content || (
                    isStreaming && i === messages.length - 1 ? (
                      <span className="inline-flex gap-1 items-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/40 p-3 flex gap-2 flex-shrink-0 bg-card">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder={`Ask about ${contact.firstName}…`}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50 disabled:opacity-50"
          disabled={isStreaming}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming}
          className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── LockedSection ──────────────────────────────────────────────────────────

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

  const remaining = creditStatus?.isUnlimited ? null : (creditStatus?.creditsTotal ?? 0) - (creditStatus?.creditsUsed ?? 0);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="w-full space-y-3 blur-sm pointer-events-none select-none" aria-hidden>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/70 flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 bg-muted rounded w-12" />
              <div className="h-3 bg-muted rounded" style={{ width: `${60 + i * 20}px` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="text-center space-y-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Contact details are private</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use 1 credit to permanently reveal this contact's details and insights.
            {remaining !== null && ` ${remaining} credits remaining.`}
          </p>
        </div>
        <Button
          onClick={onReveal}
          disabled={isRevealing}
          className="gap-2"
          size="sm"
        >
          <Zap className="h-3.5 w-3.5" />
          {isRevealing ? "Revealing…" : "Reveal Contact"}
        </Button>
      </div>
    </div>
  );
}
