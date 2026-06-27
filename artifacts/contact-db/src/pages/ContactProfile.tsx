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
  StickyNote, Globe, ChevronRight, ChevronLeft,
  Layers, Shield, Theater, HelpCircle, Wand2,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
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

// ── Outreach output types ───────────────────────────────────────────────────

interface OutputType {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  description: string;
}

const OUTPUT_TYPES: OutputType[] = [
  { id: "intro_email",      label: "Intro Email",       icon: Mail,        color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200",   description: "A personalized first-touch email tailored to this contact's background and current context." },
  { id: "email_sequence",   label: "Email Sequence",    icon: Layers,      color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-200", description: "A multi-step email cadence built around this contact's role, interests, and timing." },
  { id: "battlecard",       label: "Battlecard",        icon: Shield,      color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200",   description: "A competitive one-pager to prep your team for this deal — objections, differentiators, and positioning." },
  { id: "sales_simulation", label: "Sales Simulation",  icon: Theater,     color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",  description: "Simulate a sales call with this contact as the prospect so you can practice before the real thing." },
  { id: "talk_track",       label: "Talk Track",        icon: Mic2,        color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", description: "A structured verbal guide to keep your next conversation focused, confident, and on point." },
  { id: "quiz",             label: "Quiz",              icon: HelpCircle,  color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-200",  description: "Test how well you know this contact — their priorities, company context, and hot-button topics." },
];

// ── IntroEmailModal ────────────────────────────────────────────────────────

const EMAIL_LENGTHS = [
  { id: "short",  label: "Short",  chars: "~100 chars", description: "One punchy paragraph" },
  { id: "medium", label: "Medium", chars: "~200 chars", description: "Intro + value prop"  },
  { id: "long",   label: "Long",   chars: "~350 chars", description: "Full context + CTA"  },
] as const;

const EMAIL_TONES = ["Professional", "Friendly", "Direct", "Warm", "Authoritative"];

function IntroEmailModal({
  open, onClose, checkedIds, categoryData,
}: {
  open: boolean;
  onClose: () => void;
  checkedIds: Set<string>;
  categoryData: Record<string, InsightItem[]>;
}) {
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [tone, setTone] = useState("professional");
  const [selectedInsights, setSelectedInsights] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) { setLength("medium"); setTone("professional"); setSelectedInsights(new Set()); }
  }, [open]);

  const availableInsights = INSIGHT_CATEGORIES.flatMap(cat =>
    (categoryData[cat.id] ?? [])
      .filter(item => checkedIds.has(`${cat.id}-${item.id}`))
      .map(item => ({ ...item, key: `${cat.id}-${item.id}`, category: cat }))
  );

  function toggleInsight(key: string) {
    setSelectedInsights(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const selectedCount = selectedInsights.size;
  const showWarning = selectedCount > 2;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0 bg-blue-50 border-blue-200">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-base">Intro Email</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">Configure your first-touch email before generating.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">

          {/* Length */}
          <div>
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">Length</p>
            <div className="grid grid-cols-3 gap-2">
              {EMAIL_LENGTHS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setLength(opt.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-lg border text-center transition-colors",
                    length === opt.id
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] opacity-80">{opt.chars}</span>
                  <span className="text-[9px] opacity-60">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">Tone</p>
            <div className="flex flex-wrap gap-1.5">
              {EMAIL_TONES.map(t => (
                <button
                  key={t}
                  onClick={() => setTone(t.toLowerCase())}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    tone === t.toLowerCase()
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Insights to include */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Insights to Include</p>
              {selectedCount > 0 && (
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                  {selectedCount} selected
                </span>
              )}
            </div>

            {availableInsights.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                No insights selected in the panel yet. Check some on the left to make them available here.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto scroll-thin border border-border/60 rounded-lg divide-y divide-border/40">
                {availableInsights.map(({ key, title, source, mediaType, category }) => {
                  const cfg = getMediaConfig(mediaType);
                  const MIcon = cfg.icon;
                  const isSelected = selectedInsights.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleInsight(key)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        isSelected ? "bg-blue-50/50" : "hover:bg-secondary/30"
                      )}
                    >
                      <div className={cn(
                        "h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected ? "bg-blue-100 border-blue-400" : "border-border/50 bg-background"
                      )}>
                        {isSelected && (
                          <svg viewBox="0 0 10 10" className="h-2 w-2 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <MIcon className={cn("h-3 w-3 flex-shrink-0", cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{title}</p>
                        <p className="text-[10px] text-muted-foreground">{cfg.label} · {source}</p>
                      </div>
                      <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", category.accentBg, category.color)}>
                        {category.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {showWarning && (
              <div className="mt-2.5 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-snug">
                  <span className="font-semibold">Heads up:</span> using more than 2 insights risks making the email too long, diluting the focus, and reducing readability. Consider narrowing your selection to the 1–2 most relevant.
                </p>
              </div>
            )}
          </div>

        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-1">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" className="gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
            <Wand2 className="h-3.5 w-3.5" />
            Generate Intro Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const [outreachCollapsed, setOutreachCollapsed] = useState(false);
  const [activeOutput, setActiveOutput] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const all = [
      ...(personalInsights as InsightItem[]).map(i => `personal-${i.id}`),
      ...(industryInsights as InsightItem[]).map(i => `industry-${i.id}`),
      ...(roleInsights as InsightItem[]).map(i => `role-${i.id}`),
      ...(colleagueInsights as InsightItem[]).map(i => `colleague-${i.id}`),
      ...(counterpartInsights as InsightItem[]).map(i => `counterpart-${i.id}`),
      ...(companyInsights as InsightItem[]).map(i => `company-${i.id}`),
    ];
    const newIds = all.filter(id => !seenIdsRef.current.has(id));
    if (newIds.length > 0) {
      newIds.forEach(id => seenIdsRef.current.add(id));
      setCheckedIds(prev => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [personalInsights, industryInsights, roleInsights, colleagueInsights, counterpartInsights, companyInsights]);

  function toggleInsight(key: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(categoryId: string, catItems: InsightItem[]) {
    const keys = catItems.map(i => `${categoryId}-${i.id}`);
    setCheckedIds(prev => {
      const next = new Set(prev);
      const allChecked = keys.every(k => next.has(k));
      if (allChecked) keys.forEach(k => next.delete(k));
      else keys.forEach(k => next.add(k));
      return next;
    });
  }

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
      <div className="flex flex-col overflow-hidden bg-[#F8FAFC]" style={{ height: "calc(100vh - 4rem)" }}>
        {/* Back nav */}
        <div className="px-6 pt-3 pb-2 flex-shrink-0">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>
        </div>

        {/* ── Three-column grid: 20 / 60 / 20 ──────────────────────────── */}
        <div className="flex-1 min-h-0 px-6 pb-4 grid gap-5 overflow-hidden transition-[grid-template-columns] duration-200" style={{ gridTemplateColumns: `${insightsCollapsed ? "3rem" : "20%"} 1fr ${outreachCollapsed ? "3rem" : "20%"}`, gridTemplateRows: "minmax(0, 1fr)" }}>

            {/* ══════════════════════════════════════════════════════════════
                LEFT COLUMN — Insights
            ═══════════════════════════════════════════════════════════════ */}
            {/* ── EXPANDED left column ── */}
            {!insightsCollapsed && (
              <aside className="flex flex-col gap-3 overflow-y-scroll min-h-0 pr-1 scroll-thin">
                <div className="flex items-center justify-between sticky top-0 bg-[#F8FAFC] py-1 z-10 flex-shrink-0">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Insights</h2>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {personalInsights.length + industryInsights.length + roleInsights.length + colleagueInsights.length + counterpartInsights.length + companyInsights.length} sources
                    </span>
                    <button
                      onClick={() => setInsightsCollapsed(true)}
                      title="Collapse insights panel"
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                      checkedIds={checkedIds}
                      onToggle={toggleInsight}
                      onToggleAll={toggleCategory}
                    />
                  );
                })}
              </aside>
            )}

            {/* ── COLLAPSED left column ── */}
            {insightsCollapsed && (
              <aside className="flex flex-col items-center min-h-0 overflow-hidden gap-1 pt-1">
                {/* Expand button */}
                <button
                  onClick={() => setInsightsCollapsed(false)}
                  title="Expand insights panel"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/40 transition-colors flex-shrink-0 mb-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {/* Scrollable icon strip */}
                <TooltipProvider delayDuration={150}>
                  <div className="flex flex-col items-center gap-1 overflow-y-scroll scroll-thin flex-1 min-h-0 w-full pb-2">
                    {INSIGHT_CATEGORIES.flatMap((cat) => {
                      const items = categoryData[cat.id] ?? [];
                      const CatIcon = cat.icon;
                      if (items.length === 0) {
                        return [(
                          <Tooltip key={`cat-${cat.id}`}>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border opacity-40",
                                cat.accentBg, cat.accentBorder
                              )}>
                                <CatIcon className={cn("h-3.5 w-3.5", cat.color)} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8} className="bg-popover border border-border text-popover-foreground shadow-lg p-0 overflow-hidden max-w-56">
                              <div className="px-3 py-2">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{cat.label}</p>
                                <p className="text-xs text-muted-foreground">No sources yet</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )];
                      }
                      return items.map((item) => {
                        const cfg = getMediaConfig(item.mediaType);
                        const MIcon = cfg.icon;
                        const key = `${cat.id}-${item.id}`;
                        const checked = checkedIds.has(key);
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => toggleInsight(key)}
                                className={cn(
                                  "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors",
                                  checked
                                    ? cn(cat.accentBg, cat.accentBorder)
                                    : "bg-background border-border/40 hover:border-border/80"
                                )}
                              >
                                <MIcon className={cn("h-3.5 w-3.5", checked ? cat.color : "text-muted-foreground/60")} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8} className="bg-popover border border-border text-popover-foreground shadow-lg p-0 overflow-hidden max-w-56">
                              <div className={cn("px-2 py-1 text-[9px] font-semibold uppercase tracking-wider", cat.accentBg, cat.color)}>
                                {cat.label}
                              </div>
                              <div className="px-3 py-2 flex flex-col gap-0.5">
                                <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{item.title}</p>
                                <p className="text-[10px] text-muted-foreground">{cfg.label} · {item.source}</p>
                                {item.publishedDate && (
                                  <p className="text-[10px] text-muted-foreground/70">
                                    {new Date(item.publishedDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                                  </p>
                                )}
                                <p className="text-[9px] text-muted-foreground/50 mt-0.5">{checked ? "✓ In context" : "Click to add to context"}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      });
                    })}
                  </div>
                </TooltipProvider>
              </aside>
            )}

            {/* ══════════════════════════════════════════════════════════════
                CENTER COLUMN — Contact Hub
            ═══════════════════════════════════════════════════════════════ */}
            <main className="flex flex-col min-h-0 gap-5">

              {/* ── Merged Identity + Contact Details card ── */}
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden flex-shrink-0">
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
              <ContactChat id={id} contact={contact} checkedIds={checkedIds} />
            </main>

            {/* ══════════════════════════════════════════════════════════════
                RIGHT COLUMN — Outreach
            ═══════════════════════════════════════════════════════════════ */}

            {/* ── EXPANDED right column ── */}
            {!outreachCollapsed && (
              <aside className="flex flex-col gap-3 overflow-y-scroll min-h-0 pr-1 scroll-thin">
                <div className="flex items-center justify-between sticky top-0 bg-[#F8FAFC] py-1 z-10 flex-shrink-0">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Outreach</h2>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Sandbox</span>
                    <button
                      onClick={() => setOutreachCollapsed(true)}
                      title="Collapse outreach panel"
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* 3×2 output grid */}
                <div className="grid grid-cols-3 gap-2">
                  {OUTPUT_TYPES.map((output) => {
                    const Icon = output.icon;
                    return (
                      <button
                        key={output.id}
                        onClick={() => setActiveOutput(output.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border bg-card hover:bg-secondary/30 transition-colors text-center cursor-pointer",
                          output.border
                        )}
                      >
                        <div className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center border",
                          output.bg, output.border
                        )}>
                          <Icon className={cn("h-4 w-4", output.color)} />
                        </div>
                        <span className="text-[10px] font-semibold text-foreground leading-tight">{output.label}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* ── COLLAPSED right column ── */}
            {outreachCollapsed && (
              <aside className="flex flex-col items-center min-h-0 overflow-hidden gap-1 pt-1">
                {/* Expand button */}
                <button
                  onClick={() => setOutreachCollapsed(false)}
                  title="Expand outreach panel"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/40 transition-colors flex-shrink-0 mb-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {/* Scrollable icon strip */}
                <TooltipProvider delayDuration={150}>
                  <div className="flex flex-col items-center gap-1 overflow-y-scroll scroll-thin flex-1 min-h-0 w-full pb-2">
                    {OUTPUT_TYPES.map((output) => {
                      const Icon = output.icon;
                      return (
                        <Tooltip key={output.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setActiveOutput(output.id)}
                              className={cn(
                                "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors",
                                output.bg, output.border, "hover:brightness-95"
                              )}
                            >
                              <Icon className={cn("h-3.5 w-3.5", output.color)} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" sideOffset={8} className="bg-popover border border-border text-popover-foreground shadow-lg p-0 overflow-hidden max-w-52">
                            <div className={cn("px-2 py-1 text-[9px] font-semibold uppercase tracking-wider", output.bg, output.color)}>
                              Outreach
                            </div>
                            <div className="px-3 py-2 flex flex-col gap-0.5">
                              <p className="text-xs font-semibold text-foreground">{output.label}</p>
                              <p className="text-[10px] text-muted-foreground leading-snug">{output.description}</p>
                              <p className="text-[9px] text-muted-foreground/50 mt-0.5">Click to configure</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </aside>
            )}

        </div>
      </div>

      {/* ── Intro Email modal (full params) ── */}
      <IntroEmailModal
        open={activeOutput === "intro_email"}
        onClose={() => setActiveOutput(null)}
        checkedIds={checkedIds}
        categoryData={categoryData}
      />

      {/* ── Generic outreach modal (coming soon) ── */}
      {(() => {
        if (activeOutput === "intro_email") return null;
        const output = OUTPUT_TYPES.find(o => o.id === activeOutput);
        if (!output) return null;
        const Icon = output.icon;
        return (
          <Dialog open={!!activeOutput} onOpenChange={(open) => !open && setActiveOutput(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0", output.bg, output.border)}>
                    <Icon className={cn("h-5 w-5", output.color)} />
                  </div>
                  <div>
                    <DialogTitle className="text-base">{output.label}</DialogTitle>
                    <DialogDescription className="text-xs mt-0.5 leading-snug">{output.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-6 flex flex-col items-center gap-2 text-center">
                <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                  <Wand2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Parameters coming soon</p>
                <p className="text-xs text-muted-foreground max-w-[22rem]">
                  Customisation options for this output type will appear here. For now, click Generate to create with defaults.
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancel</Button>
                </DialogClose>
                <Button size="sm" className={cn("gap-1.5", output.bg, output.color, "border", output.border, "hover:brightness-95")}
                  onClick={() => setActiveOutput(null)}>
                  <Wand2 className="h-3.5 w-3.5" />
                  Generate {output.label}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

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
  checkedIds,
  onToggle,
  onToggleAll,
}: {
  category: InsightCategory;
  items: InsightItem[];
  isPlaceholder: boolean;
  isLocked: boolean;
  onReveal: () => void;
  isRevealing: boolean;
  outOfCredits: boolean;
  checkedIds: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: (categoryId: string, catItems: InsightItem[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const Icon = category.icon;
  const count = items.length;

  const checkedCount = (!isPlaceholder && !isLocked)
    ? items.filter(i => checkedIds.has(`${category.id}-${i.id}`)).length
    : 0;
  const allCategoryChecked = count > 0 && checkedCount === count;
  const someCategoryChecked = checkedCount > 0 && checkedCount < count;

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all flex-shrink-0",
      open ? "border-border/80 shadow-sm" : "border-border/40",
    )}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
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
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleAll(category.id, items); }}
              title={allCategoryChecked ? "Deselect all" : "Select all"}
              className={cn(
                "h-3.5 w-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-colors",
                allCategoryChecked
                  ? cn(category.accentBg, category.accentBorder)
                  : "border-border/50 bg-background"
              )}
            >
              {allCategoryChecked && (
                <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {someCategoryChecked && !allCategoryChecked && (
                <span className="block h-0.5 w-1.5 bg-muted-foreground/60 rounded-full" />
              )}
            </button>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", category.accentBg, category.color)}>
              {count}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">0</span>
        )}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground/60 transition-transform flex-shrink-0",
          open ? "rotate-180" : ""
        )} />
      </div>

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
            <div className="divide-y divide-border/40">
              {items.map((item) => {
                const cfg = getMediaConfig(item.mediaType);
                const MIcon = cfg.icon;
                const key = `${category.id}-${item.id}`;
                const checked = checkedIds.has(key);
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 px-3 py-2.5 hover:bg-secondary/40 transition-colors group"
                  >
                    <button
                      onClick={() => onToggle(key)}
                      title={checked ? "Remove from context" : "Add to context"}
                      className={cn(
                        "h-3.5 w-3.5 rounded flex items-center justify-center flex-shrink-0 border mt-0.5 transition-colors",
                        checked
                          ? cn(category.accentBg, category.accentBorder)
                          : "border-border/40 bg-background hover:border-border/80"
                      )}
                    >
                      {checked && (
                        <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 flex-1 min-w-0"
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
                  </div>
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

function ContactChat({ id, contact, checkedIds }: { id: number; contact: { firstName: string }; checkedIds: Set<string> }) {
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
        body: JSON.stringify({ messages: history, selectedIds: Array.from(checkedIds) }),
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
    <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden">
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
              <p className="text-sm font-semibold text-foreground">Ask me about {contact.firstName} based on {checkedIds.size} selected {checkedIds.size === 1 ? "source" : "sources"}</p>
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
