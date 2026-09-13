import { apiFetch } from "@/lib/apiFetch";
import { useRoute, Link } from "wouter";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { recordContactVisit } from "@/lib/recentVisits";
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
  useCreateOutreachJob,
  useListChatMessages,
  useCreateChatMessage,
  useClearChatMessages,
  useInsightMeta,
  useGetInsightRelevance,
  useTriggerInsightRelevance,
  useGetContactMetaScore,
  useGetTopRelevantContact,
  useGetInsightQuotes,
  useExtractInsightQuotes,
  type InsightRelevanceScore,
  type ContactMetaScore,
  type TopRelevantContact,
  type InsightQuote,
} from "@workspace/api-client-react";
import lostFriendoImg from "@/assets/lost-friendo.png";
import { Shell } from "@/components/layout/Shell";
import { CompetitorBadge, useCompetitorIds } from "@/components/CompetitorBadge";
import { ComposeDrawer } from "@/components/ComposeDrawer";
import { OutreachJobsList } from "@/components/OutreachJobsList";
import {
  ArrowLeft, Mail, Phone, MapPin, Building, Briefcase,
  Linkedin, Twitter, ExternalLink, Newspaper, Tv2,
  Mic2, FileText, Share2, Megaphone, ChevronDown,
  Lock, Zap, AlertCircle, Send, User, TrendingUp,
  Users, Handshake, MessageSquare, Sparkles, PenLine,
  StickyNote, Globe, ChevronRight, ChevronLeft,
  Layers, Shield, Theater, HelpCircle, Wand2, X, Maximize2, Minimize2, Loader2, BookOpen, RefreshCw, ChevronUp, ArrowUpDown, Quote,
  Activity, Clock, Eye, MousePointerClick, CheckCheck, ListChecks, Volume2, Check,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getInitials, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  CallButton,
  PreCallModal,
  ActiveCallWidget,
  PostCallPanel,
  useVoiceCall,
} from "@/components/VoiceCall";

// ── Buying Center seat context (used when embedded in Multi-threading) ────────

const SEAT_COLOR_MAP: Record<string, { iconBg: string; iconColor: string; chipBg: string; chipText: string; border: string; bg: string }> = {
  violet:  { bg: "bg-violet-50/60",  iconBg: "bg-violet-100",  iconColor: "text-violet-600",  chipBg: "bg-violet-100",  chipText: "text-violet-700",  border: "border-violet-200"  },
  emerald: { bg: "bg-emerald-50/60", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", chipBg: "bg-emerald-100", chipText: "text-emerald-700", border: "border-emerald-200" },
  blue:    { bg: "bg-blue-50/60",    iconBg: "bg-blue-100",    iconColor: "text-blue-600",    chipBg: "bg-blue-100",    chipText: "text-blue-700",    border: "border-blue-200"    },
  amber:   { bg: "bg-amber-50/60",   iconBg: "bg-amber-100",   iconColor: "text-amber-600",   chipBg: "bg-amber-100",   chipText: "text-amber-700",   border: "border-amber-200"   },
  slate:   { bg: "bg-slate-50/60",   iconBg: "bg-slate-100",   iconColor: "text-slate-500",   chipBg: "bg-slate-100",   chipText: "text-slate-600",   border: "border-slate-200"   },
  sky:     { bg: "bg-sky-50/60",     iconBg: "bg-sky-100",     iconColor: "text-sky-600",     chipBg: "bg-sky-100",     chipText: "text-sky-700",     border: "border-sky-200"     },
  rose:    { bg: "bg-rose-50/60",    iconBg: "bg-rose-100",    iconColor: "text-rose-600",    chipBg: "bg-rose-100",    chipText: "text-rose-600",    border: "border-rose-200"    },
};

const SEAT_DESCRIPTIONS: Record<string, (firstName: string) => string> = {
  "Business Champion":               fn => `As Business Champion, ${fn} is responsible for championing this solution internally and rallying cross-functional buy-in.`,
  "Economic Buyer":                  fn => `As Economic Buyer, ${fn} controls the budget and holds final authority over the purchasing decision.`,
  "Technical Buyer":                 fn => `As Technical Buyer, ${fn} evaluates technical fit and leads the solution assessment.`,
  "Decision Maker":                  fn => `As Decision Maker, ${fn} has the authority to make the final call and move the deal forward.`,
  "End User":                        fn => `As End User, ${fn} will use the solution day-to-day — their satisfaction drives adoption and renewal.`,
  "Executive Sponsor":               fn => `As Executive Sponsor, ${fn} connects this initiative to executive priorities and provides top-level backing.`,
  "Business Owner":                  fn => `As Business Owner, ${fn} owns the business problem this solution is meant to solve.`,
  "Security or Compliance Reviewer": fn => `As Security or Compliance Reviewer, ${fn} assesses risk and ensures regulatory requirements are met.`,
  "Procurement":                     fn => `As Procurement, ${fn} manages the commercial and purchasing process.`,
  "Legal":                           fn => `As Legal, ${fn} reviews and negotiates contractual obligations.`,
  "Finance":                         fn => `As Finance contact, ${fn} validates costs, ROI, and budget alignment.`,
  "Implementer":                     fn => `As Implementer, ${fn} will own deployment and configuration.`,
  "Influencer":                      fn => `As Influencer, ${fn} shapes requirements and builds internal opinion.`,
  "Blocker":                         fn => `As a potential Blocker, ${fn} has the ability to delay or oppose the purchase.`,
  "Coach":                           fn => `As Coach, ${fn} helps navigate the account and understand internal dynamics.`,
};

export type SeatContactMini = {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  seniority?: string | null;
  department?: string | null;
};

export type SeatContext = {
  seatName: string;
  seatRole: string;
  icon: React.ElementType;
  colorKey: string;
  matches: SeatContactMini[];
  allCompanyContacts: SeatContactMini[];
  currentContactId: number;
  onReassign: (contactId: number) => void;
};

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

// ── MetaScoreBadge ──────────────────────────────────────────────────────────

function MetaScoreBadge({ metaScore }: { metaScore: ContactMetaScore }) {
  const { metaScore: score, personalBest, companyBest, industryBest, roleBest, signalCount } = metaScore;

  const colorClass =
    score >= 75 ? "bg-violet-50 text-violet-700 border-violet-200" :
    score >= 50 ? "bg-blue-50 text-blue-700 border-blue-200" :
    score >= 25 ? "bg-slate-50 text-slate-600 border-slate-200" :
                  "bg-slate-50 text-slate-400 border-slate-200";

  const tier =
    score >= 75 ? "Strong" :
    score >= 50 ? "Good" :
    score >= 25 ? "Fair" : "Weak";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border font-bold cursor-default flex-shrink-0 px-2 py-0.5 text-[10px]",
          colorClass
        )}>
          <Activity className="h-2.5 w-2.5" />
          {score}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={4}
        className="z-[300] max-w-[240px] border border-border/80 bg-card p-3 text-foreground shadow-xl ring-1 ring-black/5"
      >
        <p className="text-[10px] font-bold text-foreground mb-2">Meta Score: {score}/100 — {tier}</p>
        <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
          Aggregate relevance across all four signal categories. Higher = richer, more actionable signal picture.
        </p>
        <div className="space-y-1">
          {[
            { label: "Personal", value: personalBest },
            { label: "Company", value: companyBest },
            { label: "Industry", value: industryBest },
            { label: "Role", value: roleBest },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground w-14 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", value >= 75 ? "bg-violet-400" : value >= 50 ? "bg-blue-400" : value >= 25 ? "bg-slate-400" : "bg-slate-200")}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-[9px] font-medium text-foreground w-5 text-right flex-shrink-0">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground mt-2">{signalCount} signal{signalCount !== 1 ? "s" : ""} scored</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── RelevanceBadge ─────────────────────────────────────────────────────────

function RelevanceBadge({ score, description, size = "sm" }: { score: number; description: string; size?: "xs" | "sm" }) {
  const colorClass =
    score >= 75 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" :
    score >= 25 ? "bg-orange-50 text-orange-700 border-orange-200" :
                  "bg-slate-50 text-slate-500 border-slate-200";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "inline-flex items-center gap-0.5 rounded border font-bold cursor-default flex-shrink-0 leading-none select-none",
          size === "xs" ? "px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px]",
          colorClass
        )}>
          <Sparkles className={size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2"} />
          {score}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-[260px] p-3">
        <p className="text-[10px] font-bold text-foreground mb-1">Relevance: {score}/100</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns null if the value is a meaningless sentinel ("N/A", "-", "none", etc.) */
function meaningful(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  return /^(n\/a|-+|none|null|undefined)$/i.test(s) ? null : s || null;
}

// ── Insight category definitions ───────────────────────────────────────────

type InsightSourceContact = { name: string; jobTitle?: string | null; companyName?: string | null };
type InsightItem = { id: number; title: string; url: string; source: string; publishedDate?: string | null; mediaType: string; description?: string | null; sourceContact?: InsightSourceContact | null; counterpartGroup?: 1 | 2 | null };

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
  { id: "intro_email",      label: "Single Message",    icon: Mail,        color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200",   description: "A personalized first-touch message tailored to this contact's background and current context." },
  { id: "email_sequence",   label: "Playbook",          icon: Layers,      color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-200", description: "A multi-step outreach cadence built around this contact's role, interests, and timing." },
  { id: "battlecard",       label: "Battlecard",        icon: Shield,      color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200",   description: "A competitive one-pager to prep your team for this deal — objections, differentiators, and positioning." },
  { id: "sales_simulation", label: "Sales Simulation",  icon: Theater,     color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",  description: "Simulate a sales call with this contact as the prospect so you can practice before the real thing." },
  { id: "talk_track",       label: "Talk Track",        icon: Mic2,        color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", description: "A structured verbal guide to keep your next conversation focused, confident, and on point." },
  { id: "quiz",             label: "Quiz",              icon: HelpCircle,  color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-200",  description: "Test how well you know this contact — their priorities, company context, and hot-button topics." },
];

// ── DNA voice profile loader ────────────────────────────────────────────────

const DNA_STORAGE_KEY = "whyhello_dna_v4";

interface VoiceProfileData {
  toneTags: string[];
  communicationStyle: string;
  writingNotes: string;
  trainingText: string;
  suppressions: string[];
  suppressionNotes: string;
}

function loadHqCompanyName(): string | null {
  try {
    const raw = localStorage.getItem(DNA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { company?: { name?: string } };
    return parsed.company?.name?.trim() || null;
  } catch { return null; }
}

function loadVoiceProfile(): VoiceProfileData | null {
  try {
    const raw = localStorage.getItem(DNA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { voice?: Partial<VoiceProfileData> };
    const v = parsed.voice;
    if (!v) return null;
    const hasData = (v.toneTags?.length ?? 0) > 0 || !!v.communicationStyle || !!v.writingNotes || !!v.trainingText || (v.suppressions?.length ?? 0) > 0 || !!v.suppressionNotes;
    if (!hasData) return null;
    return {
      toneTags: v.toneTags ?? [],
      communicationStyle: v.communicationStyle ?? "",
      writingNotes: v.writingNotes ?? "",
      trainingText: v.trainingText ?? "",
      suppressions: v.suppressions ?? [],
      suppressionNotes: v.suppressionNotes ?? "",
    };
  } catch { return null; }
}

// ── IntroEmailModal ────────────────────────────────────────────────────────

const EMAIL_LENGTHS = [
  { id: "short",  label: "Short",  chars: "~100 chars", description: "One punchy paragraph" },
  { id: "medium", label: "Medium", chars: "~200 chars", description: "Intro + value prop"  },
  { id: "long",   label: "Long",   chars: "~350 chars", description: "Full context + CTA"  },
] as const;

const EMAIL_TONES = ["Professional", "Friendly", "Direct", "Warm", "Authoritative"];

const EMPTY_RELEVANCE_MAP = new Map<string, InsightRelevanceScore>();

function IntroEmailModal({
  open, onClose, onGenerate, checkedIds, categoryData, relevanceMap = EMPTY_RELEVANCE_MAP, quoteMap = new Map(),
}: {
  open: boolean;
  onClose: () => void;
  onGenerate: (params: { length: string; tone: string; selectedInsightKeys: string[]; voiceProfile?: VoiceProfileData }) => void;
  checkedIds: Set<string>;
  categoryData: Record<string, InsightItem[]>;
  relevanceMap?: Map<string, InsightRelevanceScore>;
  quoteMap?: Map<string, InsightQuote>;
}) {
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [tone, setTone] = useState("professional");
  const [selectedInsights, setSelectedInsights] = useState<Set<string>>(new Set());
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfileData | null>(null);

  const availableInsights = useMemo(() => {
    const items = INSIGHT_CATEGORIES.flatMap(cat =>
      (categoryData[cat.id] ?? [])
        .filter(item => checkedIds.has(`${cat.id}-${item.id}`))
        .map(item => ({ ...item, key: `${cat.id}-${item.id}`, category: cat }))
    );
    // Sort by relevance score descending, unscored items go to the bottom
    return items.sort((a, b) => {
      const sa = relevanceMap.get(a.key)?.score ?? -1;
      const sb = relevanceMap.get(b.key)?.score ?? -1;
      return sb - sa;
    });
  }, [categoryData, checkedIds, relevanceMap]);

  useEffect(() => {
    if (open) {
      setLength("medium");
      setTone("professional");
      setVoiceProfile(loadVoiceProfile());
      // Auto-select the single highest-scored insight
      if (availableInsights.length > 0) {
        const top = availableInsights[0];
        setSelectedInsights(new Set([top.key]));
      } else {
        setSelectedInsights(new Set());
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <DialogContent className="p-0 gap-0 overflow-hidden" style={{ width: "75vw", maxWidth: "75vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-4 px-7 py-5 border-b border-border/60 bg-gradient-to-r from-blue-50/60 to-background">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center border flex-shrink-0 bg-blue-100 border-blue-200 shadow-sm">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold">Single Message</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Craft a first-touch email using this contact's intelligence. Configure the parameters below, then generate.
            </DialogDescription>
          </div>
        </div>

        {/* ── Body ── */}
        <div
          className="grid gap-0 px-0 flex-1 overflow-y-auto"
          style={{ gridTemplateColumns: "minmax(0, 1.1fr) 1px minmax(0, 1fr)" }}
        >

          {/* Left column: email shape */}
          <div className="px-7 py-6 space-y-6">

            {/* Length */}
            <div>
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3">Length</p>
              <div className="grid grid-cols-3 gap-2.5">
                {EMAIL_LENGTHS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setLength(opt.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3.5 px-3 rounded-xl border text-center transition-all",
                      length === opt.id
                        ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm ring-1 ring-blue-200"
                        : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-[11px] font-medium opacity-75">{opt.chars}</span>
                    <span className="text-[10px] opacity-55 leading-tight">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3">Tone</p>
              <div className="flex flex-wrap gap-2">
                {EMAIL_TONES.map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t.toLowerCase())}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-semibold border transition-all",
                      tone === t.toLowerCase()
                        ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm ring-1 ring-blue-200"
                        : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* My Voice Profile option */}
              {voiceProfile && (
                <div className="mt-3">
                  <button
                    onClick={() => setTone("my_voice_profile")}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                      tone === "my_voice_profile"
                        ? "bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-200"
                        : "bg-card border-border/60 hover:bg-secondary/40 hover:border-indigo-200"
                    )}
                  >
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border mt-0.5",
                      tone === "my_voice_profile" ? "bg-indigo-100 border-indigo-200" : "bg-secondary border-border/60"
                    )}>
                      <Sparkles className={cn("h-3.5 w-3.5", tone === "my_voice_profile" ? "text-indigo-600" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold", tone === "my_voice_profile" ? "text-indigo-700" : "text-foreground")}>
                        My Voice Profile
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {[
                          voiceProfile.toneTags.length > 0 && voiceProfile.toneTags.slice(0, 3).join(", "),
                          voiceProfile.communicationStyle && `${voiceProfile.communicationStyle} style`,
                          voiceProfile.suppressions.length > 0 && `${voiceProfile.suppressions.length} suppression${voiceProfile.suppressions.length > 1 ? "s" : ""}`,
                        ].filter(Boolean).join(" · ") || "Defined in HQ"}
                      </p>
                    </div>
                    {tone === "my_voice_profile" && (
                      <div className="h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-1">
                        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Divider */}
          <div className="bg-border/40 self-stretch" />

          {/* Right column: insights */}
          <div className="px-7 py-6 flex flex-col gap-4">

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Insights to Include</p>
                {selectedCount > 0 && (
                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    {selectedCount} selected
                  </span>
                )}
              </div>

              {availableInsights.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border border-dashed border-border/60 text-center text-muted-foreground">
                  <AlertCircle className="h-5 w-5 opacity-40" />
                  <p className="text-xs leading-snug max-w-[200px]">No insights checked in the left panel yet. Select some to include them here.</p>
                </div>
              ) : (
                <div className="overflow-y-auto scroll-thin border border-border/60 rounded-xl divide-y divide-border/40" style={{ maxHeight: "320px" }}>
                  {availableInsights.map(({ key, title, source, mediaType, category }) => {
                    const cfg = getMediaConfig(mediaType);
                    const MIcon = cfg.icon;
                    const isSelected = selectedInsights.has(key);
                    const rel = relevanceMap.get(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleInsight(key)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          isSelected ? "bg-blue-50/60" : "hover:bg-secondary/30"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors",
                          isSelected ? "bg-blue-100 border-blue-400" : "border-border/60 bg-background"
                        )}>
                          {isSelected && (
                            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <MIcon className={cn("h-3.5 w-3.5 flex-shrink-0", cfg.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{cfg.label} · {source}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {rel && (
                            <RelevanceBadge score={rel.score} description={rel.description} size="xs" />
                          )}
                          {quoteMap.has(key) && (
                            <span
                              title="This insight has an attached quotable"
                              className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                            >
                              <Quote className="h-2.5 w-2.5" />
                              Quotable
                            </span>
                          )}
                          <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", category.accentBg, category.color)}>
                            {category.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {showWarning && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-snug">
                  <span className="font-semibold">Heads up:</span> more than 2 insights risks diluting focus and reducing readability. Narrow to 1–2 most relevant.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-border/60 bg-secondary/20">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="h-9 px-5">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            className="h-9 px-5 gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            onClick={() => {
              onGenerate({
                length,
                tone,
                selectedInsightKeys: Array.from(selectedInsights),
                ...(tone === "my_voice_profile" && voiceProfile ? { voiceProfile } : {}),
              });
              onClose();
            }}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate Single Message
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ── BattlecardModal ──────────────────────────────────────────────────────────

function BattlecardModal({ open, onClose, contactId, contactName, onGenerate }: {
  open: boolean;
  onClose: () => void;
  contactId: number;
  contactName: string;
  onGenerate: () => void;
}) {
  // Reset when modal closes
  useEffect(() => { if (!open) return; }, [open]);

  function handleGenerate() {
    onGenerate();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0 bg-rose-50 border-rose-200">
              <Shield className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-base">Battlecard</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 leading-snug">
                A one-page PowerPoint overview of this contact — ready to download.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* What's included */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">What's included</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Contact details",  desc: "Name, title, company, email, phone, location" },
              { label: "Personal insight", desc: "A signal from the contact's own content" },
              { label: "Company insight",  desc: "A recent development at their organisation" },
              { label: "Industry insight", desc: "A relevant sector trend or publication" },
              { label: "Role insight",     desc: "Content relevant to their function" },
            ].map(({ label, desc }) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
                <p className="text-xs font-semibold text-foreground leading-snug">{label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={handleGenerate}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white border-0"
          >
            <Shield className="h-3.5 w-3.5" /> Generate Battlecard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PlaybookPickerModal ────────────────────────────────────────────────────

function PlaybookPickerModal({
  open,
  onClose,
  contactId,
  contactName,
}: {
  open: boolean;
  onClose: () => void;
  contactId: number;
  contactName: string;
}) {
  const { toast } = useToast();
  const [enrolling, setEnrolling] = useState<number | null>(null);

  const { data: playbooks = [], isLoading } = useQuery<{ id: number; name: string; stepCount: number; enrollmentCount: number }[]>({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const r = await apiFetch("/api/playbooks");
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    },
    enabled: open,
  });

  async function handleEnroll(seqId: number) {
    setEnrolling(seqId);
    try {
      const res = await apiFetch(`/api/playbooks/${seqId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [contactId] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to enroll");
      }
      toast({ title: "Enrolled", description: `${contactName} added to playbook` });
      onClose();
    } catch (err) {
      toast({
        title: "Enrollment failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setEnrolling(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/60">
          <DialogTitle className="text-base">Add to Playbook</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Choose a sequence to enroll {contactName} into.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading playbooks…
            </div>
          ) : playbooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center text-muted-foreground">
              <ListChecks className="h-8 w-8 opacity-30" />
              <div>
                <p className="text-sm font-medium">No playbooks yet</p>
                <p className="text-xs mt-0.5">Create a playbook first from the Playbooks page.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {playbooks.map(seq => (
                <li key={seq.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{seq.name}</p>
                    <p className="text-xs text-muted-foreground">{seq.stepCount} step{seq.stepCount !== 1 ? "s" : ""} · {seq.enrollmentCount} enrolled</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-shrink-0"
                    disabled={enrolling === seq.id}
                    onClick={() => handleEnroll(seq.id)}
                  >
                    {enrolling === seq.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enroll"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-6 py-3 border-t border-border/60 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ContactProfileView({ contactId, embedded, seatContext }: { contactId: number; embedded?: boolean; seatContext?: SeatContext }) {
  const id = contactId;

  const { data: contact, isLoading, isError } = useGetContact(id, { query: { enabled: !!id } });
  const competitorIds = useCompetitorIds();
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
  const createJobMutation = useCreateOutreachJob();
  const [jobRefetchTrigger, setJobRefetchTrigger] = useState(0);
  const { data: relevanceData = [], refetch: refetchRelevance } = useGetInsightRelevance(id, { query: { enabled: !!id } });
  const relevanceMutation = useTriggerInsightRelevance();
  const { data: metaScore } = useGetContactMetaScore(id, { query: { enabled: !!id } });
  const hasAutoScoredRef = useRef<number | null>(null); // stores the contactId that was last scored
  const [showLostFriendo, setShowLostFriendo] = useState(false);
  const { data: topContact } = useGetTopRelevantContact(id, showLostFriendo);
  const { data: quotesData = [], refetch: refetchQuotes } = useGetInsightQuotes(id, { query: { enabled: !!id } });
  const quotesMutation = useExtractInsightQuotes();
  const hasAutoExtractedQuotesRef = useRef<number | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const RELEVANCE_REFRESH_WINDOW_MS = 10 * 60 * 1000;
  const refreshRelevance = useCallback(() => {
    if (!id || relevanceMutation.isPending) return;
    hasAutoScoredRef.current = id;
    relevanceMutation.mutate({ contactId: id, force: true }, { onSuccess: () => refetchRelevance() });
  }, [id, relevanceMutation, refetchRelevance]);

  // Effect 1: show toast whenever scores are settled and max ≤ 50
  useEffect(() => {
    if (relevanceData.length === 0 || relevanceMutation.isPending) return;
    const maxScore = Math.max(...relevanceData.map(s => s.score), 0);
    if (maxScore <= 50) setShowLostFriendo(true);
  }, [relevanceData, relevanceMutation.isPending]);

  // Effect 2: auto-trigger scoring when scores are missing or older than ten
  // minutes. The API enforces the same window so duplicate requests cannot
  // trigger another AI scoring run.
  // Tracks the last contactId scored (not a boolean) so it resets automatically
  // when navigating to a different contact within the same component instance.
  useEffect(() => {
    if (!id || hasAutoScoredRef.current === id || relevanceMutation.isPending) return;

    const allInsightKeys = [
      ...personalInsights.map(i => `personal-${i.id}`),
      ...companyInsights.map(i => `company-${i.id}`),
      ...industryInsights.map(i => `industry-${i.id}`),
      ...roleInsights.map(i => `role-${i.id}`),
      ...colleagueInsights.map(i => `colleague-${i.id}`),
      ...counterpartInsights.map(i => `counterpart-${i.id}`),
    ];
    if (allInsightKeys.length === 0) return; // insights not loaded yet

    const latestComputedAt = relevanceData.reduce((latest, score) => {
      const timestamp = new Date(score.computedAt).getTime();
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);
    const scoresAreFresh = latestComputedAt > 0
      && Date.now() - latestComputedAt < RELEVANCE_REFRESH_WINDOW_MS;
    if (scoresAreFresh) {
      hasAutoScoredRef.current = id;
      return;
    }

    hasAutoScoredRef.current = id;
    relevanceMutation.mutate(id, { onSuccess: () => refetchRelevance() });
  }, [id, relevanceData, personalInsights, companyInsights, industryInsights, roleInsights,
    colleagueInsights, counterpartInsights, relevanceMutation.isPending]);

  // Effect 3: auto-extract quotes once when insights load and no quotes exist yet
  useEffect(() => {
    if (!id || hasAutoExtractedQuotesRef.current === id || quotesMutation.isPending) return;
    if (quotesData.length > 0) return; // already have quotes

    const totalInsights = personalInsights.length + companyInsights.length +
      industryInsights.length + roleInsights.length +
      colleagueInsights.length + counterpartInsights.length;
    if (totalInsights === 0) return;

    hasAutoExtractedQuotesRef.current = id;
    quotesMutation.mutate(id, { onSuccess: () => refetchQuotes() });
  }, [id, quotesData.length, personalInsights.length, companyInsights.length,
    industryInsights.length, roleInsights.length, colleagueInsights.length,
    counterpartInsights.length, quotesMutation.isPending]);

  const handleGenerateIntroEmail = useCallback((params: { length: string; tone: string; selectedInsightKeys: string[]; voiceProfile?: VoiceProfileData }) => {
    const lengthLabel = params.length.charAt(0).toUpperCase() + params.length.slice(1);
    const toneLabel = params.tone === "my_voice_profile" ? "My Voice Profile" : params.tone.charAt(0).toUpperCase() + params.tone.slice(1);
    createJobMutation.mutate({
      id,
      data: {
        type: "intro_email",
        title: `Single Message — ${lengthLabel}, ${toneLabel}`,
        params: { length: params.length, tone: params.tone, selectedInsightKeys: params.selectedInsightKeys, voiceProfile: params.voiceProfile },
      },
    }, {
      onSuccess: () => setJobRefetchTrigger(t => t + 1),
    });
  }, [createJobMutation, id]);

  const handleGenerateBattlecard = useCallback(() => {
    const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || "Contact";
    createJobMutation.mutate({
      id,
      data: {
        type: "battlecard",
        title: `Battlecard — ${contactName}`,
        params: {},
      },
    }, {
      onSuccess: () => setJobRefetchTrigger(t => t + 1),
    });
  }, [createJobMutation, id, contact?.firstName, contact?.lastName]);

  const isRevealed = revealStatus?.isRevealed ?? false;
  const outOfCredits =
    !creditStatus?.isUnlimited &&
    (creditStatus?.creditsUsed ?? 0) >= (creditStatus?.creditsTotal ?? 0);

  type InsightsMode = "normal" | "collapsed" | "expanded";
  const [composeOpen, setComposeOpen] = useState(false);
  const [seqPickerOpen, setSeqPickerOpen] = useState(false);
  const voiceContactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ");
  const { phase: callPhase, openPreCall, closePreCall, startCall, mute: muteCall, hangUp, dismissPostCall } = useVoiceCall(
    id, voiceContactName
  );
  const [insightsMode, setInsightsMode] = useState<InsightsMode>("normal");
  const [sortByRelevance, setSortByRelevance] = useState(false);
  const [outreachCollapsed, setOutreachCollapsed] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<{ item: InsightItem; category: InsightCategory } | null>(null);
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
    if (contact && !embedded) {
      document.title = `${contact.firstName} ${contact.lastName} on Whyhello`;
      recordContactVisit(
        contact.id,
        `${contact.firstName} ${contact.lastName}`,
        (contact as any).title ?? null,
        contact.company?.name ?? null,
      );
    }
    return () => { if (!embedded) document.title = "Whyhello"; };
  }, [contact, embedded]);

  const categoryData: Record<string, InsightItem[]> = {
    personal:     personalInsights as InsightItem[],
    industry:     industryInsights as InsightItem[],
    role:         roleInsights as InsightItem[],
    colleague:    colleagueInsights as InsightItem[],
    counterpart:  counterpartInsights as InsightItem[],
    company:      companyInsights as InsightItem[],
  };

  const relevanceMap = useMemo(() => {
    const m = new Map<string, InsightRelevanceScore>();
    for (const s of relevanceData) m.set(`${s.signalType}-${s.signalId}`, s);
    return m;
  }, [relevanceData]);

  const quoteMap = useMemo(() => {
    const m = new Map<string, InsightQuote>();
    for (const q of quotesData) m.set(`${q.signalType}-${q.signalId}`, q);
    return m;
  }, [quotesData]);

  // The live set of all insight IDs currently displayed in the panel.
  // Used to guard against stale ghost IDs that accumulate in checkedIds
  // when insight data changes between fetches (e.g. relevance-score updates
  // shift the round-robin selection for colleague/counterpart insights).
  const currentInsightIds = useMemo(() => {
    const s = new Set<string>();
    for (const [cat, items] of Object.entries(categoryData)) {
      for (const item of items) s.add(`${cat}-${item.id}`);
    }
    return s;
  }, [categoryData]);

  const sortedCategoryData = useMemo(() => {
    if (!sortByRelevance || relevanceMap.size === 0) return categoryData;
    const result: Record<string, InsightItem[]> = {};
    for (const [catId, items] of Object.entries(categoryData)) {
      result[catId] = [...items].sort((a, b) => {
        const sa = relevanceMap.get(`${catId}-${a.id}`)?.score ?? -1;
        const sb = relevanceMap.get(`${catId}-${b.id}`)?.score ?? -1;
        return sb - sa;
      });
    }
    return result;
  }, [categoryData, sortByRelevance, relevanceMap]);

  if (isLoading) {
    return (
      <div className={cn("p-8 animate-pulse space-y-6 max-w-7xl mx-auto", embedded && "h-full overflow-hidden")}>
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
    );
  }

  if (isError || !contact) {
    return (
      <div className={cn("p-8 text-center mt-20", embedded && "h-full flex flex-col items-center justify-center mt-0")}>
        <h2 className="text-2xl font-bold mb-4">Contact not found</h2>
        <Link href="/"><Button>Back to Search</Button></Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col overflow-hidden bg-[#F8FAFC] h-full">

        {/* ── Three-column grid ─────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 px-6 pt-4 pb-4 grid gap-5 overflow-hidden transition-[grid-template-columns] duration-200" style={{ gridTemplateColumns: `${insightsMode === "collapsed" ? "3rem" : insightsMode === "expanded" ? "50%" : "20%"} 1fr ${insightsMode === "expanded" ? "3rem" : outreachCollapsed ? "3rem" : "20%"}`, gridTemplateRows: "minmax(0, 1fr)" }}>

            {/* ══════════════════════════════════════════════════════════════
                LEFT COLUMN — Insights
            ═══════════════════════════════════════════════════════════════ */}
            {/* ── NORMAL left column ── */}
            {insightsMode === "normal" && (
              <aside className="flex flex-col gap-3 overflow-y-scroll min-h-0 pr-1 scroll-thin">
                <div className="sticky top-0 bg-[#F8FAFC] py-1 z-10 flex-shrink-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Insights</h2>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        {personalInsights.length + industryInsights.length + roleInsights.length + colleagueInsights.length + counterpartInsights.length + companyInsights.length} sources
                      </span>
                      <button
                        onClick={refreshRelevance}
                        disabled={relevanceMutation.isPending}
                        aria-label="Refresh relevance now"
                        title="Refresh relevance now"
                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={cn("h-3 w-3", relevanceMutation.isPending && "animate-spin")} />
                      </button>
                      <button
                        onClick={() => setInsightsMode("expanded")}
                        title="Expand insights panel"
                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setInsightsMode("collapsed")}
                        title="Collapse insights panel"
                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {relevanceMutation.isPending && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Scoring relevance…
                    </div>
                  )}
                  {relevanceMap.size > 0 && !relevanceMutation.isPending && (
                    <button
                      onClick={() => setSortByRelevance(v => !v)}
                      title={sortByRelevance ? "Restore default order" : "Sort signals by relevance score"}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all",
                        sortByRelevance
                          ? "border-primary/30 bg-primary/8 text-primary"
                          : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                      )}
                    >
                      <ArrowUpDown className="h-2.5 w-2.5" />
                      {sortByRelevance ? "Sorted: Relevance" : "Sort: Relevance"}
                    </button>
                  )}
                </div>

                {INSIGHT_CATEGORIES.map((cat) => {
                  const items = sortedCategoryData[cat.id] ?? [];
                  const isLocked = cat.id === "personal" && !isRevealed;
                  return (
                    <InsightCategoryPanel
                      key={cat.id}
                      category={cat}
                      items={items}
                      isPlaceholder={false}
                      isLocked={isLocked}
                      onReveal={handleReveal}
                      isRevealing={revealMutation.isPending || revealLoading}
                      outOfCredits={outOfCredits}
                      checkedIds={checkedIds}
                      onToggle={toggleInsight}
                      onToggleAll={toggleCategory}
                      relevanceMap={relevanceMap}
                      quoteMap={quoteMap}
                      onCardClick={(item) => {
                        setSelectedInsight({ item, category: cat });
                        setInsightsMode("expanded");
                        setOutreachCollapsed(true);
                      }}
                    />
                  );
                })}
              </aside>
            )}

            {/* ── EXPANDED left column (50% wide) ── */}
            {insightsMode === "expanded" && (
              <aside className="flex flex-col min-h-0 overflow-hidden">
                {selectedInsight ? (
                  /* ── Detail / lite-browser view ── */
                  <InsightDetailView
                    item={selectedInsight.item}
                    category={selectedInsight.category}
                    relevance={relevanceMap.get(`${selectedInsight.category.id}-${selectedInsight.item.id}`)}
                    quote={quoteMap.get(`${selectedInsight.category.id}-${selectedInsight.item.id}`)}
                    onBack={() => setSelectedInsight(null)}
                    checkedIds={checkedIds}
                    onToggle={toggleInsight}
                    onMinimize={() => { setSelectedInsight(null); setInsightsMode("normal"); }}
                    onCollapse={() => { setSelectedInsight(null); setInsightsMode("collapsed"); }}
                    contactId={id}
                    companyId={companyIdForInsights}
                  />
                ) : (
                  /* ── Card grid view ── */
                  <>
                    <div className="sticky top-0 bg-[#F8FAFC] py-1 z-10 flex-shrink-0 pr-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Insights</h2>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {personalInsights.length + industryInsights.length + roleInsights.length + colleagueInsights.length + counterpartInsights.length + companyInsights.length} sources
                          </span>
                          <button
                            onClick={refreshRelevance}
                            disabled={relevanceMutation.isPending}
                            aria-label="Refresh relevance now"
                            title="Refresh relevance now"
                            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={cn("h-3 w-3", relevanceMutation.isPending && "animate-spin")} />
                          </button>
                          <button
                            onClick={() => setInsightsMode("normal")}
                            title="Restore insights panel"
                            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <Minimize2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setInsightsMode("collapsed")}
                            title="Collapse insights panel"
                            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {relevanceMutation.isPending && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Scoring relevance…
                        </div>
                      )}
                      {relevanceMap.size > 0 && !relevanceMutation.isPending && (
                        <button
                          onClick={() => setSortByRelevance(v => !v)}
                          title={sortByRelevance ? "Restore default order" : "Sort signals by relevance score"}
                          className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all",
                            sortByRelevance
                              ? "border-primary/30 bg-primary/8 text-primary"
                              : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                          )}
                        >
                          <ArrowUpDown className="h-2.5 w-2.5" />
                          {sortByRelevance ? "Sorted: Relevance" : "Sort: Relevance"}
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-scroll scroll-thin pr-1 pt-1 flex flex-col gap-4">
                      {INSIGHT_CATEGORIES.map((cat) => {
                        const items = sortedCategoryData[cat.id] ?? [];
                        const isLocked = cat.id === "personal" && !isRevealed;
                        return (
                          <InsightCategoryPanel
                            key={cat.id}
                            category={cat}
                            items={items}
                            isPlaceholder={false}
                            isLocked={isLocked}
                            onReveal={handleReveal}
                            isRevealing={revealMutation.isPending || revealLoading}
                            outOfCredits={outOfCredits}
                            checkedIds={checkedIds}
                            onToggle={toggleInsight}
                            onToggleAll={toggleCategory}
                            expanded
                            relevanceMap={relevanceMap}
                            quoteMap={quoteMap}
                            onCardClick={(item) => setSelectedInsight({ item, category: cat })}
                            contactId={id}
                            companyId={companyIdForInsights}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </aside>
            )}

            {/* ── COLLAPSED left column ── */}
            {insightsMode === "collapsed" && (
              <aside className="flex flex-col items-center min-h-0 gap-1 pt-1">
                {/* Restore button */}
                <button
                  onClick={() => setInsightsMode("normal")}
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
                                <p className="text-[10px] text-muted-foreground">{cfg.label}{meaningful(item.source) ? ` · ${meaningful(item.source)}` : ""}</p>
                                {meaningful(item.publishedDate) && (
                                  <p className="text-[10px] text-muted-foreground/70">
                                    {new Date(meaningful(item.publishedDate)!).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
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
                        {metaScore != null && (
                          <MetaScoreBadge metaScore={metaScore} />
                        )}
                      </div>
                    </div>
                    {isRevealed && contact.phone && (
                      <div className="flex gap-2 flex-shrink-0 pb-1">
                        <CallButton contactPhone={contact.phone} onInitiate={openPreCall} />
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
                        {competitorIds.has(contact.company.id) && (
                          <CompetitorBadge />
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Buying Center seat badge (embedded only) ── */}
                  {embedded && seatContext && (() => {
                    const colors = SEAT_COLOR_MAP[seatContext.colorKey] ?? SEAT_COLOR_MAP.slate;
                    const SeatIcon = seatContext.icon;
                    const description = (SEAT_DESCRIPTIONS[seatContext.seatName] ?? ((fn: string) => `${fn} occupies the ${seatContext.seatName} role in this buying center.`))(contact.firstName);
                    const matchIds = new Set(seatContext.matches.map(c => c.id));
                    const otherContacts = seatContext.allCompanyContacts.filter(c => !matchIds.has(c.id));
                    return (
                      <div className={cn("mt-3 rounded-xl border p-3 flex items-start gap-3", colors.border, colors.bg)}>
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", colors.iconBg)}>
                          <SeatIcon className={cn("h-4 w-4", colors.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", colors.chipBg, colors.chipText, colors.border)}>
                              {seatContext.seatName}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                        </div>
                        <Popover open={reassignOpen} onOpenChange={setReassignOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-[11px] flex-shrink-0 mt-0.5">
                              <RefreshCw className="h-3 w-3" /> Re-assign
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-0 overflow-hidden">
                            <div className="px-3 py-2.5 border-b border-border/60 bg-secondary/30">
                              <p className="text-xs font-semibold text-foreground">Re-assign {seatContext.seatName}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Select a contact to fill this seat</p>
                            </div>
                            <div className="max-h-64 overflow-y-auto py-1">
                              {seatContext.matches.length > 0 && (
                                <>
                                  <div className="px-3 pt-2 pb-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Best Matches</p>
                                  </div>
                                  {seatContext.matches.map(c => {
                                    const isCurrent = c.id === seatContext.currentContactId;
                                    return (
                                      <button
                                        key={c.id}
                                        onClick={() => { seatContext.onReassign(c.id); setReassignOpen(false); }}
                                        className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary/50 transition-colors", isCurrent && "bg-secondary/40")}
                                      >
                                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                          {((c.firstName[0] ?? "") + (c.lastName[0] ?? "")).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold text-foreground truncate">{c.firstName} {c.lastName}</p>
                                          {c.jobTitle && <p className="text-[10px] text-muted-foreground truncate">{c.jobTitle}</p>}
                                        </div>
                                        {isCurrent && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                              {otherContacts.length > 0 && (
                                <>
                                  <div className={cn("px-3 pt-2 pb-1", seatContext.matches.length > 0 && "border-t border-border/40 mt-1")}>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Other Contacts</p>
                                  </div>
                                  {otherContacts.map(c => {
                                    const isCurrent = c.id === seatContext.currentContactId;
                                    return (
                                      <button
                                        key={c.id}
                                        onClick={() => { seatContext.onReassign(c.id); setReassignOpen(false); }}
                                        className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary/50 transition-colors", isCurrent && "bg-secondary/40")}
                                      >
                                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                                          {((c.firstName[0] ?? "") + (c.lastName[0] ?? "")).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold text-foreground truncate">{c.firstName} {c.lastName}</p>
                                          {c.jobTitle && <p className="text-[10px] text-muted-foreground truncate">{c.jobTitle}</p>}
                                        </div>
                                        {isCurrent && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  })()}

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

              {/* ── Strategy Assistant / Activity Hub ── */}
              <ContactCenterHub id={id} contact={contact} checkedIds={checkedIds} currentIds={currentInsightIds} highlightedInsight={selectedInsight} />
            </main>

            {/* ══════════════════════════════════════════════════════════════
                RIGHT COLUMN — Outreach
            ═══════════════════════════════════════════════════════════════ */}

            {/* ── EXPANDED right column ── */}
            {!outreachCollapsed && insightsMode !== "expanded" && (
              <aside className="relative overflow-y-scroll min-h-0 pr-1 scroll-thin">
                <div className={cn(
                  "flex flex-col gap-3",
                  (quotesData.length > 0 || quotesMutation.isPending) && "pb-56"
                )}>
                  <div className="flex items-center justify-between sticky top-0 bg-[#F8FAFC] py-1 z-10 flex-shrink-0">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Outreach</h2>
                    <div className="flex items-center gap-1.5">
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
                      );  /* end output button */
                    })}
                  </div>

                  {/* Jobs list */}
                  <OutreachJobsList contactId={id} refetchTrigger={jobRefetchTrigger} />
                </div>

                {/* Quotables carousel — anchored to the bottom of the outreach panel */}
                <QuotablesCarousel
                  quotes={quotesData}
                  isPending={quotesMutation.isPending}
                  onReExtract={() => {
                    hasAutoExtractedQuotesRef.current = id;
                    quotesMutation.mutate(id, { onSuccess: () => refetchQuotes() });
                  }}
                  onInsightClick={(signalId, signalType) => {
                    const item = categoryData[signalType]?.find(i => i.id === signalId);
                    const category = INSIGHT_CATEGORIES.find(c => c.id === signalType);
                    if (item && category) {
                      setSelectedInsight({ item, category });
                      setInsightsMode("expanded");
                    }
                  }}
                />

              </aside>
            )}

            {/* ── COLLAPSED right column ── */}
            {(outreachCollapsed || insightsMode === "expanded") && (
              <aside className="flex flex-col items-center min-h-0 gap-1 pt-1">
                {/* Expand button — always shown; when Insights is maxed, also restores it to normal */}
                <button
                  onClick={() => {
                    setOutreachCollapsed(false);
                    if (insightsMode === "expanded") setInsightsMode("normal");
                  }}
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
        onGenerate={handleGenerateIntroEmail}
        checkedIds={checkedIds}
        categoryData={categoryData}
        relevanceMap={relevanceMap}
        quoteMap={quoteMap}
      />

      {/* ── Battlecard modal ── */}
      <BattlecardModal
        open={activeOutput === "battlecard"}
        onClose={() => setActiveOutput(null)}
        contactId={id}
        contactName={[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
        onGenerate={handleGenerateBattlecard}
      />

      {/* ── Generic outreach modal (coming soon) ── */}
      {(() => {
        if (activeOutput === "intro_email") return null;
        if (activeOutput === "battlecard") return null;
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

      {/* ── Sequence picker modal ── */}
      <PlaybookPickerModal
        open={seqPickerOpen}
        onClose={() => setSeqPickerOpen(false)}
        contactId={id}
        contactName={`${contact.firstName} ${contact.lastName}`}
      />

      {/* ── Voice call modals ── */}
      <PreCallModal
        open={callPhase.type === "pre-call"}
        contactName={voiceContactName}
        contactPhone={contact.phone ?? ""}
        onClose={closePreCall}
        onStart={startCall}
      />
      <ActiveCallWidget
        phase={callPhase}
        contactName={voiceContactName}
        onMute={muteCall}
        onHangUp={hangUp}
      />
      {callPhase.type === "ended" && (
        <PostCallPanel
          call={callPhase.call}
          contactName={voiceContactName}
          onClose={dismissPostCall}
        />
      )}

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

      {/* ── Lost Friendo overlay ── */}
      {showLostFriendo && (
        <LostFriendoCard
          topContact={topContact ?? null}
          onDismiss={() => setShowLostFriendo(false)}
        />
      )}
    </>
  );
}

// ── Route-based ContactProfile page (wraps ContactProfileView with Shell) ───

export default function ContactProfile() {
  const [, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");
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
        <div className="flex-1 min-h-0 overflow-hidden">
          <ContactProfileView contactId={id} />
        </div>
      </div>
    </Shell>
  );
}

// ── QuotablesCarousel ──────────────────────────────────────────────────────
// Sits at the bottom of the Outreach panel.
// Base state: pull-quote style, quote text only.
// Expanded state: 2× height — quote + HQ bridge hook description.
// Minimized state: header only.

function QuotablesCarousel({
  quotes,
  isPending,
  onReExtract,
  onInsightClick,
}: {
  quotes: InsightQuote[];
  isPending: boolean;
  onReExtract: () => void;
  onInsightClick?: (signalId: number, signalType: string) => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [idx, setIdx] = useState(0);

  const safeIdx = quotes.length > 0 ? Math.min(idx, quotes.length - 1) : 0;
  const current = quotes[safeIdx] ?? null;
  const prev = () => setIdx(i => (i - 1 + quotes.length) % quotes.length);
  const next = () => setIdx(i => (i + 1) % quotes.length);

  if (!isPending && quotes.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-1 z-20 bg-[#F8FAFC] border-t border-violet-100 pt-3 pb-1 shadow-[0_-6px_12px_rgba(248,250,252,0.9)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Quotables</span>
          {quotes.length > 0 && (
            <span className="text-[9px] font-semibold bg-violet-100 text-violet-500 rounded-full px-1.5 py-px tabular-nums">
              {quotes.length}
            </span>
          )}
          {isPending && <Loader2 className="h-2.5 w-2.5 animate-spin text-violet-400 flex-shrink-0" />}
        </div>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onReExtract}
                disabled={isPending}
                className="h-5 w-5 rounded flex items-center justify-center text-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-30"
              >
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-[11px]">Re-extract quotes</p>
            </TooltipContent>
          </Tooltip>

          {/* Expand / compress toggle — only relevant when not minimized */}
          {!minimized && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="h-5 w-5 rounded flex items-center justify-center text-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                >
                  {expanded
                    ? <Minimize2 className="h-2.5 w-2.5" />
                    : <Maximize2 className="h-2.5 w-2.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-[11px]">{expanded ? "Compact view" : "Expand view"}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Minimize / restore toggle */}
          <button
            onClick={() => setMinimized(v => !v)}
            className="h-5 w-5 rounded flex items-center justify-center text-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
          >
            {minimized
              ? <ChevronUp className="h-2.5 w-2.5" />
              : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {!minimized && (
        <div className="space-y-2">

          {isPending && !current && (
            <p className="text-[11px] text-violet-400 italic">Scanning LinkedIn posts for quotes…</p>
          )}

          {current && (
            <div
              className={cn(
                "rounded-xl bg-gradient-to-br from-violet-50 to-white border border-violet-100 overflow-hidden transition-all duration-200",
                expanded ? "px-4 pt-4 pb-4" : "px-4 pt-3 pb-3",
                onInsightClick && current.signalId != null && "cursor-pointer hover:border-violet-300 hover:shadow-sm hover:from-violet-100 active:scale-[0.99]"
              )}
              onClick={() => {
                if (onInsightClick && current.signalId != null) {
                  onInsightClick(current.signalId, current.signalType);
                }
              }}
              title={onInsightClick && current.signalId != null ? "Open source insight" : undefined}
            >
              {/* Pull-quote */}
              <div className="relative">
                {/* Decorative opening mark */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -top-1 -left-1.5 font-serif text-violet-200 leading-none select-none pointer-events-none",
                    expanded ? "text-[52px]" : "text-[40px]"
                  )}
                >"</span>

                <p className={cn(
                  "pl-5 italic text-foreground/85 leading-relaxed font-medium",
                  expanded ? "text-[13px]" : "text-xs"
                )}>
                  {current.quote}
                </p>

                <p className={cn(
                  "pl-5 mt-1.5 text-violet-400 font-medium not-italic",
                  expanded ? "text-[11px]" : "text-[10px]"
                )}>
                  — {current.attribution}
                  {current.attributionRole && (
                    <span className="font-normal">, {current.attributionRole}</span>
                  )}
                </p>
              </div>

              {/* HQ bridge — expanded only */}
              {expanded && current.hqBridge && (
                <div className="mt-3.5 pt-3 border-t border-violet-100">
                  <div className="flex gap-2">
                    <Sparkles className="h-3 w-3 text-violet-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-violet-700 leading-snug">{current.hqBridge}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          {quotes.length > 1 && (
            <div className="flex items-center justify-between px-1">
              <button
                onClick={prev}
                className="h-6 w-6 rounded-full flex items-center justify-center text-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {safeIdx + 1} / {quotes.length}
              </span>
              <button
                onClick={next}
                className="h-6 w-6 rounded-full flex items-center justify-center text-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── LostFriendoCard ────────────────────────────────────────────────────────

function LostFriendoCard({
  topContact,
  onDismiss,
}: {
  topContact: TopRelevantContact | null | undefined;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[380px] rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="status"
      aria-live="polite"
    >
      {/* Amber accent stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />

      <div className="flex gap-4 p-4">
        {/* Cartoon */}
        <img
          src={lostFriendoImg}
          alt="Lost friendo"
          className="h-20 w-20 rounded-xl object-cover flex-shrink-0 border border-border/40"
        />

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black text-foreground leading-tight">
              Are you lost, friend-o?
            </h3>
            <button
              onClick={onDismiss}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 -mt-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-snug">
            None of this contact's signals scored above 50 against your HQ profile — this might not be your ideal prospect right now.
          </p>

          {topContact ? (
            <p className="text-[11px] text-muted-foreground leading-snug">
              Someone who might be a better fit:{" "}
              <Link
                href={`/contacts/${topContact.contactId}`}
                onClick={onDismiss}
                className="font-semibold text-primary hover:underline"
              >
                {topContact.firstName} {topContact.lastName}
              </Link>
              {topContact.title && (
                <span className="text-muted-foreground/70"> · {topContact.title}</span>
              )}
              <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                avg {topContact.avgScore}
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 italic leading-snug">
              Score more contacts to unlock a better recommendation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── YouTube embed helper ───────────────────────────────────────────────────

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1).split("?")[0];
    } else if (u.hostname === "youtube.com" || u.hostname === "www.youtube.com") {
      videoId = u.searchParams.get("v");
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}?rel=0`;
  } catch { /* ignore */ }
  return null;
}

// ── Apple Podcasts embed helper ────────────────────────────────────────────

function getApplePodcastEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "podcasts.apple.com" || u.hostname === "www.podcasts.apple.com") {
      u.hostname = "embed.podcasts.apple.com";
      return u.toString();
    }
  } catch { /* ignore */ }
  return null;
}

// ── InsightDetailView ──────────────────────────────────────────────────────

function InsightDetailView({
  item,
  category,
  relevance,
  quote,
  onBack,
  checkedIds,
  onToggle,
  onMinimize,
  onCollapse,
  contactId,
  companyId,
}: {
  item: InsightItem;
  category: InsightCategory;
  relevance?: InsightRelevanceScore;
  quote?: InsightQuote;
  onBack: () => void;
  checkedIds: Set<string>;
  onToggle: (key: string) => void;
  onMinimize: () => void;
  onCollapse: () => void;
  contactId?: number;
  companyId?: number;
}) {
  const [aiData, setAiData] = useState<{ summary: string; keyInsights: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [browserExpanded, setBrowserExpanded] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ url: string; label: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // ── Metadata enrichment ──────────────────────────────────────────────────
  const { data: meta } = useInsightMeta(item.url);
  const displaySource = meaningful(item.source) ?? meaningful(meta?.source ?? null);
  const displayDate   = meaningful(item.publishedDate) ?? meaningful(meta?.publishedDate ?? null);

  const enrichedRef = useRef(false);
  useEffect(() => {
    if (enrichedRef.current || !meta) return;
    const needsSource = !meaningful(item.source) && meaningful(meta.source);
    const needsDate   = !meaningful(item.publishedDate) && meaningful(meta.publishedDate);
    if (!needsSource && !needsDate) return;
    enrichedRef.current = true;
    const endpoint =
      category.id === "company" && companyId
        ? `/api/companies/${companyId}/insights/${item.id}`
        : contactId
          ? `/api/contacts/${contactId}/insights/${item.id}`
          : null;
    if (!endpoint) return;
    const body: Record<string, string | null> = {};
    if (needsSource) body.source = meta.source;
    if (needsDate)   body.publishedDate = meta.publishedDate;
    apiFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [meta, item, category, contactId, companyId]);

  const cfg = getMediaConfig(item.mediaType);
  const MIcon = cfg.icon;
  const key = `${category.id}-${item.id}`;
  const checked = checkedIds.has(key);

  let displayUrl = item.url;
  try {
    const u = new URL(item.url);
    displayUrl = u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch { /* keep original */ }

  const youtubeEmbedUrl = getYouTubeEmbedUrl(item.url);
  const applePodcastEmbedUrl = getApplePodcastEmbedUrl(item.url);
  const iframeSrc = youtubeEmbedUrl ?? applePodcastEmbedUrl ?? `/api/proxy?url=${encodeURIComponent(item.url)}`;

  useEffect(() => {
    const handleNavigationAttempt = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.type !== "insight-navigation-attempt" || typeof data.url !== "string") return;

      try {
        const destination = new URL(data.url);
        if (destination.protocol !== "http:" && destination.protocol !== "https:") return;
        setPendingNavigation({
          url: destination.href,
          label: typeof data.label === "string" ? data.label : "",
        });
      } catch {
        // Ignore malformed navigation messages from the preview.
      }
    };

    window.addEventListener("message", handleNavigationAttempt);
    return () => window.removeEventListener("message", handleNavigationAttempt);
  }, []);

  const openPendingNavigation = () => {
    if (!pendingNavigation) return;
    window.open(pendingNavigation.url, "_blank", "noopener,noreferrer");
    setPendingNavigation(null);
  };

  useEffect(() => {
    setAiLoading(true);
    setAiData(null);
    setIframeLoaded(false);
    setIframeError(false);
    apiFetch("/api/insights/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ url: item.url, title: item.title, source: item.source, description: item.description, mediaType: item.mediaType, contactId }),
    })
      .then(r => r.json())
      .then((data: { summary: string; keyInsights: string[] }) => { setAiData(data); setAiLoading(false); })
      .catch(() => { setAiData({ summary: "Could not generate summary.", keyInsights: [] }); setAiLoading(false); });
  }, [item.url, item.title]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">

      {/* ── Breadcrumb header ── */}
      <div className="sticky top-0 z-10 flex items-center gap-2 py-1 flex-shrink-0 pr-1 bg-[#F8FAFC]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Insights
        </button>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        <span className={cn("text-[10px] font-semibold truncate max-w-[160px]", category.color)}>{category.label}</span>
        <div className="flex-1" />
        <button
          onClick={onMinimize}
          title="Restore insights panel"
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Minimize2 className="h-3 w-3" />
        </button>
        <button
          onClick={onCollapse}
          title="Collapse insights panel"
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Info cards (fixed height — don't scroll, don't grow) ── */}
      <div className="flex flex-col gap-3 pt-1 pr-1 flex-shrink-0">

        {/* Meta card */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className={cn("h-1 w-full", category.accentBg)} />
          <div className="p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", category.accentBg, category.accentBorder, category.color)}>
                {category.label}
              </span>

              {/* ── Colleague source contact chip ── */}
              {category.id === "colleague" && item.sourceContact && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-sky-50 border-sky-200">
                  <div className="h-4 w-4 rounded-full bg-sky-200 border border-sky-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-[8px] font-bold text-sky-700 uppercase leading-none select-none">
                      {item.sourceContact.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-sky-800 leading-none">{item.sourceContact.name}</span>
                  {(item.sourceContact.jobTitle || item.sourceContact.companyName) && (
                    <span className="text-[9px] text-sky-600/80 leading-none">
                      {[item.sourceContact.jobTitle, item.sourceContact.companyName].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              )}

              {/* ── Counterpart source contact chip ── */}
              {category.id === "counterpart" && item.sourceContact && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-rose-50 border-rose-200">
                  <div className="h-4 w-4 rounded-full bg-rose-200 border border-rose-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-[8px] font-bold text-rose-700 uppercase leading-none select-none">
                      {item.sourceContact.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-rose-800 leading-none">{item.sourceContact.name}</span>
                  {(item.sourceContact.jobTitle || item.sourceContact.companyName) && (
                    <span className="text-[9px] text-rose-600/80 leading-none">
                      {[item.sourceContact.jobTitle, item.sourceContact.companyName].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {item.counterpartGroup != null && (
                    <span className="text-[8px] font-bold text-rose-500 uppercase tracking-wide leading-none border-l border-rose-200 pl-1.5 ml-0.5">
                      G{item.counterpartGroup}
                    </span>
                  )}
                </div>
              )}

              <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold", cfg.bg)}>
                <MIcon className={cn("h-2.5 w-2.5", cfg.color)} />
                <span className={cfg.color}>{cfg.label}</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => onToggle(key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                  checked
                    ? cn(category.accentBg, category.accentBorder, category.color)
                    : "bg-background border-border/50 text-muted-foreground hover:border-border"
                )}
              >
                {checked ? (
                  <>
                    <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    In context
                  </>
                ) : "Add to context"}
              </button>
            </div>
            <h3 className="text-sm font-bold text-foreground leading-snug">{item.title}</h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
              {displaySource && <span className="font-semibold">{displaySource}</span>}
              {displayDate && (
                <>
                  {displaySource && <span className="opacity-40">·</span>}
                  <span>{new Date(displayDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                </>
              )}
            </div>
            <div className="border-t border-border/40 pt-2.5">
              {aiLoading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-3 bg-muted rounded-full animate-pulse w-full" />
                  <div className="h-3 bg-muted rounded-full animate-pulse w-[90%]" />
                  <div className="h-3 bg-muted rounded-full animate-pulse w-[75%]" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">{aiData?.summary}</p>
              )}
            </div>
            <div className="border-t border-border/40 pt-2.5">
              <div className="flex items-center gap-2 mb-2.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Key Takeaways</span>
              </div>
              {aiLoading ? (
                <div className="flex flex-col gap-3">
                  {[80, 95, 70, 85].map((w, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted mt-1.5 flex-shrink-0" />
                      <div className="h-3 bg-muted rounded-full animate-pulse" style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {(aiData?.keyInsights ?? []).map((insight, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full mt-[5px] flex-shrink-0", category.accentBg)} style={{ minWidth: "6px" }} />
                      <span className="text-xs text-foreground leading-snug">{insight}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Relevance card — hidden while the browser expands into its space */}
        {!browserExpanded && (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-secondary/20">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              {(() => { const n = loadHqCompanyName(); return n ? `Relevance to ${n}` : "Relevance"; })()}
            </span>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {relevance ? (() => {
              const s = relevance.score;
              const scoreColor = s >= 75 ? "text-emerald-600" : s >= 50 ? "text-amber-500" : s >= 25 ? "text-orange-500" : "text-slate-400";
              const scoreBg   = s >= 75 ? "bg-emerald-50 border-emerald-200" : s >= 50 ? "bg-amber-50 border-amber-200" : s >= 25 ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-200";
              return (
                <div className="flex gap-4">
                  {/* Score column */}
                  <div className={cn("flex flex-col items-center justify-center rounded-xl border px-3 py-3 flex-shrink-0 w-[13%]", scoreBg)}>
                    <span className={cn("text-4xl font-black leading-none tracking-tight", scoreColor)}>{s}</span>
                    <span className={cn("text-[10px] font-bold mt-1 opacity-70", scoreColor)}>/&nbsp;100</span>
                  </div>
                  {/* Description + tags column */}
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{relevance.description}</p>
                    {relevance.matchedHqSignals && relevance.matchedHqSignals.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {relevance.matchedHqSignals.map((sig, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 border border-primary/15 text-primary font-medium">
                            {sig}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="flex gap-4">
                <div className="w-[25%] h-16 bg-muted rounded-xl animate-pulse flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="h-3 bg-muted rounded-full animate-pulse w-full" />
                  <div className="h-3 bg-muted rounded-full animate-pulse w-[85%]" />
                </div>
              </div>
            )}
            {/* ── Quotable power-up box ── */}
            {quote && (
              <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Quotable</span>
                </div>
                <p className="text-xs text-amber-950 leading-relaxed font-bold">
                  "{quote.quote}"
                </p>
                <p className="text-[11px] text-amber-600 font-medium mt-2 not-italic">
                  — {quote.attribution}{quote.attributionRole ? `, ${quote.attributionRole}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
        )}

      </div>

      {/* ── Lite browser — grows to fill all remaining vertical space ── */}
      <div className="flex-shrink-0 h-[min(42vh,560px)] min-h-[320px] flex flex-col mt-3 pr-1 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-secondary/30 flex-shrink-0">
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="h-2.5 w-2.5 rounded-full bg-red-300/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-300/80" />
          </div>
          <div className="flex-1 flex items-center gap-1.5 bg-background rounded-md px-2.5 py-1 border border-border/50 min-w-0 mx-1">
            <Lock className="h-2.5 w-2.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate flex-1">{displayUrl}</span>
          </div>
          <button
            title="Refresh preview"
            onClick={() => { setIframeLoaded(false); setIframeError(false); setIframeKey(k => k + 1); }}
            className="h-6 w-6 flex items-center justify-center rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors flex-shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            title={browserExpanded ? "Collapse browser" : "Expand browser"}
            onClick={() => setBrowserExpanded(e => !e)}
            className="h-6 w-6 flex items-center justify-center rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors flex-shrink-0"
          >
            {browserExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="h-6 w-6 flex items-center justify-center rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors flex-shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* iframe — fills the remaining space of the browser card */}
        <div className="relative flex-1 min-h-0 bg-white">
          {!iframeLoaded && !iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/70">Loading preview…</span>
            </div>
          )}
          {iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center px-6 z-10">
              <p className="text-sm font-semibold text-foreground">Trouble connecting with this page 🫠</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Try{" "}
                <button
                  onClick={() => { setIframeLoaded(false); setIframeError(false); setIframeKey(k => k + 1); }}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  refreshing
                </button>
                {" "}or{" "}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  open in a new tab
                </a>
              </p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={iframeSrc}
            title={item.title}
            className={cn("absolute inset-0 w-full h-full border-0 transition-opacity duration-300", iframeLoaded && !iframeError ? "opacity-100" : "opacity-0")}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setIframeLoaded(true)}
            onError={() => setIframeError(true)}
          />
        </div>
      </div>

      <Dialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => { if (!open) setPendingNavigation(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave this insight?</DialogTitle>
            <DialogDescription>
              This link will take you away from the featured insight. The insight will stay open here, and the link will open in a new tab.
            </DialogDescription>
          </DialogHeader>
          {pendingNavigation && (
            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
              <p className="text-xs font-medium text-foreground truncate">
                {pendingNavigation.label || "External link"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {pendingNavigation.url}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button variant="outline">Stay here</Button>
            </DialogClose>
            <Button onClick={openPendingNavigation}>
              Open in new tab
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── InsightCardExpanded ────────────────────────────────────────────────────

function InsightCardExpanded({
  item,
  category,
  checked,
  onToggle,
  relevance,
  quote,
  onCardClick,
  contactId,
  companyId,
}: {
  item: InsightItem;
  category: InsightCategory;
  checked: boolean;
  onToggle: () => void;
  relevance?: InsightRelevanceScore;
  quote?: InsightQuote;
  onCardClick?: () => void;
  contactId?: number;
  companyId?: number;
}) {
  const key = `${category.id}-${item.id}`;
  const cfg = getMediaConfig(item.mediaType);
  const MIcon = cfg.icon;
  const { data: meta } = useInsightMeta(item.url);

  const [imgError, setImgError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const showImage = !!meta?.ogImage && !imgError;
  const showFavicon = !!meta?.favicon && !faviconError;

  // ── Metadata enrichment: prefer DB values, fall back to live page meta ──
  const displaySource = meaningful(item.source) ?? meaningful(meta?.source ?? null);
  const displayDate   = meaningful(item.publishedDate) ?? meaningful(meta?.publishedDate ?? null);

  const enrichedCardRef = useRef(false);
  useEffect(() => {
    if (enrichedCardRef.current || !meta) return;
    const needsSource = !meaningful(item.source) && meaningful(meta.source);
    const needsDate   = !meaningful(item.publishedDate) && meaningful(meta.publishedDate);
    if (!needsSource && !needsDate) return;
    enrichedCardRef.current = true;
    const endpoint =
      category.id === "company" && companyId
        ? `/api/companies/${companyId}/insights/${item.id}`
        : contactId
          ? `/api/contacts/${contactId}/insights/${item.id}`
          : null;
    if (!endpoint) return;
    const body: Record<string, string | null> = {};
    if (needsSource) body.source = meta.source;
    if (needsDate)   body.publishedDate = meta.publishedDate;
    apiFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [meta, item, category, contactId, companyId]);

  return (
    <div
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onClick={onCardClick}
      onKeyDown={(e) => e.key === "Enter" && onCardClick?.()}
      className={cn(
        "group relative rounded-xl border transition-all overflow-hidden flex flex-col",
        onCardClick ? "cursor-pointer" : "",
        checked
          ? cn("shadow-sm ring-1", category.accentBorder, category.accentBg)
          : "bg-card border-border/60 hover:border-border hover:shadow-sm"
      )}
    >
      {/* ── OG image thumbnail ── */}
      {showImage ? (
        <div className="relative w-full aspect-[3/1] bg-secondary/30 overflow-hidden flex-shrink-0">
          <img
            src={meta.ogImage!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-[filter] duration-300 group-hover:brightness-110 group-hover:saturate-150"
            onError={() => setImgError(true)}
          />
          {/* Media type badge overlaid bottom-left */}
          <div className={cn("absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md border backdrop-blur-sm text-[9px] font-semibold", cfg.bg)}>
            <MIcon className={cn("h-2.5 w-2.5", cfg.color)} />
            <span className={cfg.color}>{cfg.label}</span>
          </div>
          {displayDate && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[9px] text-white/90">
              {new Date(displayDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </div>
          )}
        </div>
      ) : (
        /* Fallback: compact top bar when no image */
        <div className={cn("flex items-center gap-2 px-3 py-2 border-b flex-shrink-0", checked ? "border-border/30" : "border-border/40 bg-secondary/20")}>
          <div className={cn("h-5 w-5 rounded flex items-center justify-center flex-shrink-0 border", cfg.bg)}>
            <MIcon className={cn("h-3 w-3", cfg.color)} />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground flex-1 truncate">{cfg.label}</span>
          {displayDate && (
            <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">
              {new Date(displayDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-3 py-2.5 flex flex-col gap-1.5 flex-1">
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-3 group-hover:text-primary transition-colors">
          {item.title}
        </p>
        {/* Source row with favicon */}
        <div className="flex items-center gap-1.5">
          {showFavicon && (
            <img
              src={meta.favicon!}
              alt=""
              className="h-3.5 w-3.5 rounded-sm object-contain flex-shrink-0"
              onError={() => setFaviconError(true)}
            />
          )}
          {displaySource && <span className="text-xs text-muted-foreground truncate">{displaySource}</span>}
        </div>
        {item.description && (
          <p className="text-[11px] text-muted-foreground/80 leading-snug line-clamp-2 mt-0.5">
            {item.description}
          </p>
        )}
      </div>

      {/* ── Colleague attribution ── */}
      {category.id === "colleague" && item.sourceContact && (
        <div className="mx-3 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200">
          <div className="h-5 w-5 rounded-full bg-sky-200 border border-sky-300 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-sky-700 uppercase leading-none select-none">
              {item.sourceContact.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-sky-800 truncate leading-tight">{item.sourceContact.name}</p>
            <p className="text-[10px] text-sky-600/80 truncate leading-tight">
              {[item.sourceContact.jobTitle, item.sourceContact.companyName].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* ── Counterpart attribution ── */}
      {category.id === "counterpart" && item.sourceContact && (
        <div className="mx-3 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200">
          <div className="h-5 w-5 rounded-full bg-rose-200 border border-rose-300 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-rose-700 uppercase leading-none select-none">
              {item.sourceContact.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-rose-800 truncate leading-tight">{item.sourceContact.name}</p>
            <p className="text-[10px] text-rose-600/80 truncate leading-tight">
              {[item.sourceContact.jobTitle, item.sourceContact.companyName].filter(Boolean).join(" · ")}
            </p>
          </div>
          {item.counterpartGroup != null && (
            <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-600 uppercase tracking-wide">
              G{item.counterpartGroup}
            </span>
          )}
        </div>
      )}

      {/* ── Actions + Relevance ── */}
      <div className="flex flex-col gap-1.5 px-3 pb-3 mt-1.5">
        {relevance && (
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border/40">
                <RelevanceBadge score={relevance.score} description={relevance.description} />
                <p className="text-[10px] text-muted-foreground leading-snug flex-1 line-clamp-2">{relevance.description}</p>
              </div>
              {quote && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="h-2.5 w-2.5 text-amber-500 fill-amber-400 flex-shrink-0" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">Quotable</span>
                  </div>
                  <p className="text-[10px] text-amber-950 leading-snug italic line-clamp-3">"{quote.quote}"</p>
                </div>
              )}
            </div>
          </TooltipProvider>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            title={checked ? "Remove from context" : "Add to context"}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all",
              checked
                ? cn(category.accentBg, category.accentBorder, category.color)
                : "bg-background border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {checked ? (
              <>
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                In context
              </>
            ) : "Add to context"}
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open source"
            onClick={(e) => e.stopPropagation()}
            className="h-7 w-7 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors flex-shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
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
  expanded = false,
  relevanceMap,
  quoteMap,
  onCardClick,
  contactId,
  companyId,
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
  expanded?: boolean;
  relevanceMap?: Map<string, InsightRelevanceScore>;
  quoteMap?: Map<string, InsightQuote>;
  onCardClick?: (item: InsightItem) => void;
  contactId?: number;
  companyId?: number;
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
        className={cn("w-full flex items-center gap-2.5 cursor-pointer", expanded ? "px-4 py-3" : "px-3 py-2.5")}
      >
        <div className={cn(
          "rounded-md flex items-center justify-center flex-shrink-0 border",
          expanded ? "h-7 w-7" : "h-6 w-6",
          category.accentBg, category.accentBorder
        )}>
          <Icon className={cn(expanded ? "h-4 w-4" : "h-3.5 w-3.5", category.color)} />
        </div>
        <span className={cn("flex-1 text-left font-semibold text-foreground", expanded ? "text-sm" : "text-xs")}>{category.label}</span>
        {expanded && count > 0 && !isPlaceholder && !isLocked && (
          <span className={cn("text-[10px] font-medium text-muted-foreground mr-1")}>
            {checkedCount}/{count} in context
          </span>
        )}
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
            {!expanded && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", category.accentBg, category.color)}>
                {count}
              </span>
            )}
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
          ) : expanded ? (
            /* ── Rich 2-column card grid for expanded mode ── */
            <div className="grid grid-cols-2 gap-3 p-4">
              {items.map((item) => {
                const key = `${category.id}-${item.id}`;
                return (
                  <InsightCardExpanded
                    key={item.id}
                    item={item}
                    category={category}
                    checked={checkedIds.has(key)}
                    onToggle={() => onToggle(key)}
                    relevance={relevanceMap?.get(`${category.id}-${item.id}`)}
                    quote={quoteMap?.get(`${category.id}-${item.id}`)}
                    onCardClick={onCardClick ? () => onCardClick(item) : undefined}
                    contactId={contactId}
                    companyId={companyId}
                  />
                );
              })}
            </div>
          ) : (
            /* ── Compact list for normal mode ── */
            <div className="divide-y divide-border/40">
              {items.map((item) => {
                const cfg = getMediaConfig(item.mediaType);
                const MIcon = cfg.icon;
                const key = `${category.id}-${item.id}`;
                const checked = checkedIds.has(key);
                const rel = relevanceMap?.get(`${category.id}-${item.id}`);
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
                    <button
                      onClick={() => onCardClick?.(item)}
                      className="flex items-start gap-2 flex-1 min-w-0 text-left"
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
                    </button>
                    {rel && (
                      <TooltipProvider delayDuration={200}>
                        <RelevanceBadge score={rel.score} description={rel.description} size="xs" />
                      </TooltipProvider>
                    )}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open source"
                      className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-colors flex-shrink-0 mt-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
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

// ── ChatSourcesPanel ───────────────────────────────────────────────────────

type ChatSourceRef = { signalType: string; id: number; title: string; source: string; publishedDate?: string | null };

const SIGNAL_TYPE_META: Record<string, { label: string; className: string }> = {
  personal:    { label: "Personal",    className: "bg-violet-50 border-violet-200 text-violet-700" },
  company:     { label: "Company",     className: "bg-blue-50 border-blue-200 text-blue-700" },
  industry:    { label: "Industry",    className: "bg-amber-50 border-amber-200 text-amber-700" },
  role:        { label: "Role",        className: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  colleague:   { label: "Colleague",   className: "bg-sky-50 border-sky-200 text-sky-700" },
  counterpart: { label: "Counterpart", className: "bg-rose-50 border-rose-200 text-rose-700" },
};

function ChatSourcesPanel({ sources }: { sources: ChatSourceRef[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-8 max-w-[82%] w-full">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <BookOpen className="h-3 w-3" />
        {sources.length} source{sources.length === 1 ? "" : "s"} referenced
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1">
          {sources.map((s, i) => {
            const meta = SIGNAL_TYPE_META[s.signalType] ?? { label: s.signalType, className: "bg-secondary border-border text-muted-foreground" };
            return (
              <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/40">
                <span className={cn("flex-shrink-0 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border mt-0.5", meta.className)}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-1">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {s.source}{s.publishedDate ? ` · ${s.publishedDate}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ActivityFeed ───────────────────────────────────────────────────────────

interface SentMessage {
  id: number;
  subject: string;
  toEmail: string;
  toName: string | null;
  sentAt: string | null;
  sentFrom: string | null;
  openedAt: string | null;
  clickCount: number;
  status: string;
  createdAt: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ActivityFeed({ contactId }: { contactId: number }) {
  const { data: messages = [], isLoading: msgLoading } = useQuery<SentMessage[]>({
    queryKey: ["contact-sent-messages", contactId],
    queryFn: () => apiFetch(`/api/contacts/${contactId}/sent-messages`).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const { data: calls = [], isLoading: callsLoading } = useQuery<import("@/components/VoiceCall").CallRecord[]>({
    queryKey: ["contact-calls", contactId],
    queryFn: async () => {
      const r = await apiFetch(`/api/contacts/${contactId}/calls`);
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 30000,
  });

  const isLoading = msgLoading || callsLoading;

  // Merge and sort by date descending
  type FeedItem =
    | { kind: "email"; data: SentMessage; date: string }
    | { kind: "call"; data: import("@/components/VoiceCall").CallRecord; date: string };

  const feed: FeedItem[] = [
    ...messages.map((m) => ({ kind: "email" as const, data: m, date: m.sentAt ?? m.createdAt })),
    ...calls.map((c) => ({ kind: "call" as const, data: c, date: c.createdAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Emails and calls with this contact will appear here.</p>
        </div>
      </div>
    );
  }

  function callStatusLabel(status: string): string {
    switch (status) {
      case "completed": return "Completed";
      case "in-progress": case "in-progress-ringing": return "In progress";
      case "failed": return "Failed";
      case "busy": return "Busy";
      case "no-answer": return "No answer";
      case "canceled": return "Canceled";
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  function callStatusColor(status: string): string {
    if (status === "completed") return "text-emerald-600";
    if (["failed", "busy", "no-answer", "canceled"].includes(status)) return "text-red-500";
    return "text-amber-500";
  }

  function formatDur(seconds: number | null): string | null {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
      {feed.map((item) => {
        if (item.kind === "email") {
          const msg = item.data;
          const isOpened = !!msg.openedAt;
          const hasClicks = msg.clickCount > 0;
          return (
            <div key={`email-${msg.id}`} className="rounded-xl border border-border/60 bg-background px-4 py-3 hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-[13px] font-semibold text-foreground leading-snug truncate">
                    {msg.subject || "(no subject)"}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {timeAgo(msg.sentAt ?? msg.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {msg.sentFrom && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Send className="h-2.5 w-2.5" />
                    {msg.sentFrom}
                  </span>
                )}
                {msg.sentFrom && <span className="text-border text-[10px]">·</span>}
                <span className={cn("text-[10px] flex items-center gap-1 font-medium", isOpened ? "text-emerald-600" : "text-muted-foreground")}>
                  <Eye className="h-3 w-3" />
                  {isOpened ? <span title={new Date(msg.openedAt!).toLocaleString()}>Opened {timeAgo(msg.openedAt)}</span> : "Not opened"}
                </span>
                {hasClicks && (
                  <>
                    <span className="text-border text-[10px]">·</span>
                    <span className="text-[10px] text-primary flex items-center gap-1 font-medium">
                      <MousePointerClick className="h-3 w-3" />
                      {msg.clickCount} click{msg.clickCount !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        }

        // Call card
        const call = item.data;
        const dur = formatDur(call.durationSeconds);
        const snippet = call.aiSummary?.split("\n")[0]?.replace(/^Summary:\s*/i, "").trim();
        return (
          <div key={`call-${call.id}`} className="rounded-xl border border-border/60 bg-background px-4 py-3 hover:border-border transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Phone className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <p className="text-[13px] font-semibold text-foreground leading-snug truncate">
                  Call · {call.callMode === "phone" ? "Via phone" : "Via browser"}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {timeAgo(call.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn("text-[10px] font-medium", callStatusColor(call.status))}>
                {callStatusLabel(call.status)}
              </span>
              {dur && (
                <>
                  <span className="text-border text-[10px]">·</span>
                  <span className="text-[10px] text-muted-foreground">{dur}</span>
                </>
              )}
              {call.recordingUrl && (
                <>
                  <span className="text-border text-[10px]">·</span>
                  {/* Proxy URL supplies Twilio credentials server-side */}
                  <a
                    href={`/api/calls/${call.id}/recording`}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Volume2 className="h-3 w-3" /> Recording
                  </a>
                </>
              )}
            </div>
            {snippet && (
              <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {snippet}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ContactCenterHub (toggle: Strategy Assistant ↔ Activity) ───────────────

function ContactCenterHub({
  id, contact, checkedIds, currentIds, highlightedInsight,
}: {
  id: number;
  contact: { firstName: string };
  checkedIds: Set<string>;
  currentIds: Set<string>;
  highlightedInsight?: { item: InsightItem; category: InsightCategory } | null;
}) {
  const [activeTab, setActiveTab] = useState<"assistant" | "activity">("assistant");

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden">
      {/* Tab toggle header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary border border-border/50">
          <button
            onClick={() => setActiveTab("assistant")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all",
              activeTab === "assistant"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3 w-3" />
            Strategy Assistant
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all",
              activeTab === "activity"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="h-3 w-3" />
            Activity
          </button>
        </div>

        {activeTab === "activity" && (
          <span className="ml-auto text-[10px] font-semibold text-muted-foreground bg-secondary border border-border/50 px-1.5 py-0.5 rounded-full">
            Activity
          </span>
        )}
        {activeTab === "assistant" && (
          <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            AI
          </span>
        )}
      </div>

      {/* Panel content */}
      {activeTab === "assistant" ? (
        <ContactChat id={id} contact={contact} checkedIds={checkedIds} currentIds={currentIds} highlightedInsight={highlightedInsight} embedded />
      ) : (
        <ActivityFeed contactId={id} />
      )}
    </div>
  );
}

// ── ContactChat ────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string; sources?: ChatSourceRef[] };

const STARTERS = (firstName: string) => [
  `What are ${firstName}'s key professional priorities right now?`,
  `Suggest a conversation opener based on their recent activity`,
  `Draft a short LinkedIn outreach message to ${firstName}`,
  `What topics would resonate most with ${firstName}?`,
];

function ContactChat({
  id, contact, checkedIds, currentIds, highlightedInsight, embedded = false,
}: {
  id: number;
  contact: { firstName: string };
  checkedIds: Set<string>;
  currentIds: Set<string>;
  highlightedInsight?: { item: InsightItem; category: InsightCategory } | null;
  embedded?: boolean;
}) {
  const { data: savedMessages = [], isLoading: historyLoading } = useListChatMessages(id);
  const persistMessage = useCreateChatMessage();
  const clearMutation = useClearChatMessages();

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [useOnlyHighlighted, setUseOnlyHighlighted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset toggle whenever the highlighted insight changes
  useEffect(() => {
    setUseOnlyHighlighted(false);
  }, [highlightedInsight?.item.id]);

  // Effective source IDs sent to the API.
  // Intersect checkedIds with currentIds so ghost IDs (stale entries from
  // previous fetches that are no longer displayed) are never counted or sent.
  const effectiveIds = (() => {
    if (highlightedInsight && useOnlyHighlighted) {
      return [`${highlightedInsight.category.id}-${highlightedInsight.item.id}`];
    }
    return Array.from(checkedIds).filter(id => currentIds.has(id));
  })();

  // Hydrate from DB on first load
  useEffect(() => {
    if (!historyLoading && !hydrated) {
      setLocalMessages(savedMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      setHydrated(true);
    }
  }, [historyLoading, hydrated, savedMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...localMessages, userMsg];
    setLocalMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    // Persist user message
    persistMessage.mutate({ id, data: { role: "user", content: text } });

    let assistantContent = "";
    let pendingSources: ChatSourceRef[] | undefined;
    let citationTag = "";

    try {
      const resp = await apiFetch(`/api/contacts/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, selectedIds: effectiveIds }),
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
            if (data.sources !== undefined) {
              pendingSources = data.sources as ChatSourceRef[];
              citationTag = (data.citationTag as string) ?? "";
            }
            if (data.content) {
              assistantContent += data.content;
              setLocalMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + data.content };
                return next;
              });
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      // Strip the raw [CITED: …] line the AI appended, then attach sources.
      // Do this in one setState so the message never flickers with the tag visible.
      const cleanContent = citationTag
        ? assistantContent.replace(citationTag, "").trimEnd()
        : assistantContent;

      setLocalMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: cleanContent,
          ...(pendingSources ? { sources: pendingSources } : {}),
        };
        return next;
      });

      // Persist the clean content (no citation tag)
      if (cleanContent) {
        persistMessage.mutate({ id, data: { role: "assistant", content: cleanContent } });
      }
    } catch {
      const errMsg = "Sorry, something went wrong. Please try again.";
      setLocalMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: errMsg };
        return next;
      });
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleClear() {
    setLocalMessages([]);
    clearMutation.mutate({ id });
  }

  const messages = localMessages;
  const showEmpty = hydrated && messages.length === 0;

  const inner = (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {showEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              {highlightedInsight && useOnlyHighlighted ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Ask me about {contact.firstName}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-snug">
                    Using only: <span className="font-medium text-foreground">{highlightedInsight.item.title}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Ask me about {contact.firstName} based on {effectiveIds.length} selected {effectiveIds.length === 1 ? "source" : "sources"}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    I have access to their insights, company context, and professional background.
                  </p>
                </>
              )}
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
              <div key={i} className={cn("flex flex-col gap-1.5", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("flex gap-2.5 w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm selection:bg-white/30 selection:text-white"
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

                {/* Sources panel — shown beneath completed assistant messages */}
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <ChatSourcesPanel sources={msg.sources} />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Source toggle — visible when a highlighted insight is active */}
      {highlightedInsight && (
        <div className="border-t border-border/40 px-3 pt-2.5 pb-0 flex items-center gap-2.5 flex-shrink-0 bg-card">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary border border-border/50 flex-shrink-0">
            <button
              onClick={() => setUseOnlyHighlighted(false)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all",
                !useOnlyHighlighted
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All sources
            </button>
            <button
              onClick={() => setUseOnlyHighlighted(true)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1",
                useOnlyHighlighted
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="h-2.5 w-2.5 flex-shrink-0" />
              This source
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground truncate min-w-0 flex-1 italic">
            {highlightedInsight.item.title}
          </span>
        </div>
      )}

      {/* Input */}
      <div className={cn("p-3 flex gap-2 flex-shrink-0 bg-card", !highlightedInsight && "border-t border-border/40")}>
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
          placeholder={
            highlightedInsight && useOnlyHighlighted
              ? `Ask about this source…`
              : !showEmpty
                ? `Ask about ${contact.firstName} using ${effectiveIds.length} source${effectiveIds.length === 1 ? "" : "s"}…`
                : `Ask about ${contact.firstName}…`
          }
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
    </>
  );

  if (embedded) {
    return <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{inner}</div>;
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
            onClick={handleClear}
            disabled={clearMutation.isPending}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-1 disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>
      {inner}
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
