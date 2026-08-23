import { useUser } from "@clerk/react";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";
import {
  Phone, Smartphone, Puzzle, Zap, Clock, Cpu,
  Lock, CheckCircle2, Circle, Loader2, ChevronRight,
  Mic2, FileText, BarChart3, Bell, Search, Trophy,
  Timer, ArrowRight, Sparkles, Flame,
  Video, Users, CalendarCheck2, BookOpen,
} from "lucide-react";

// ── Master access ─────────────────────────────────────────────────────────────

const MASTER_EMAIL = "abatasi@gmail.com";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "in-progress" | "planned";

interface Particular { icon: React.ComponentType<{ className?: string }>; text: string }
interface RoadmapItem {
  id: string;
  title: string;
  quarter: string;
  status: Status;
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  particulars: Particular[];
  timeEstimate: string;
  computeEstimate: string;
  accent: {
    bg: string; border: string; iconBg: string; iconText: string;
    badge: string; badgeText: string; dot: string;
  };
}

// ── Roadmap data ──────────────────────────────────────────────────────────────

const items: RoadmapItem[] = [
  {
    id: "softphone",
    title: "Softphone · Transcription & Analysis",
    quarter: "Q3 2026",
    status: "in-progress",
    icon: Phone,
    tagline: "Turn every call into a structured, searchable insight.",
    particulars: [
      { icon: Mic2,        text: "Browser + phone-mode softphone already wired via Twilio — recording layer is next" },
      { icon: FileText,    text: "Post-call transcription via OpenAI Whisper / Deepgram (async, ~30 s turnaround)" },
      { icon: Sparkles,    text: "GPT-4o call summary auto-injected into the contact timeline as a structured note" },
      { icon: BarChart3,   text: "Sentiment analysis + talk-to-listen ratio scored per call" },
      { icon: Search,      text: "Keyword flagging for objections, competitors, pricing mentions, and next steps" },
      { icon: CheckCircle2,text: "Auto-populated CRM note with action items highlighted and follow-up date suggested" },
    ],
    timeEstimate: "6–8 weeks",
    computeEstimate: "$0.02–0.06 / min of audio · ~$0.01 / GPT summary",
    accent: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800/50",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconText: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-100 dark:bg-amber-900/40",
      badgeText: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
    },
  },
  {
    id: "mobile",
    title: "Mobile App",
    quarter: "Q3 2026",
    status: "planned",
    icon: Smartphone,
    tagline: "Prospect and engage from anywhere — native iOS & Android.",
    particulars: [
      { icon: Smartphone,  text: "Expo React Native — single codebase for iOS and Android, same API backend" },
      { icon: Bell,        text: "Push notifications for follow-up reminders, reply alerts, and deal signals" },
      { icon: Phone,       text: "Quick-dial from contact cards with in-app softphone integration" },
      { icon: Search,      text: "Offline-capable contact lookup, notes, and activity logging that sync on reconnect" },
      { icon: Mic2,        text: "On-device voice memos recorded and auto-transcribed when back online" },
      { icon: Zap,         text: "Swipe-based prospecting queue: accept, defer, or skip contacts at a glance" },
    ],
    timeEstimate: "10–14 weeks",
    computeEstimate: "~$15/mo incremental infra · no per-call overhead beyond existing Twilio costs",
    accent: {
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-800/50",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconText: "text-blue-600 dark:text-blue-400",
      badge: "bg-blue-100 dark:bg-blue-900/40",
      badgeText: "text-blue-700 dark:text-blue-300",
      dot: "bg-blue-500",
    },
  },
  {
    id: "chrome",
    title: "Chrome Extension",
    quarter: "Q4 2026",
    status: "planned",
    icon: Puzzle,
    tagline: "Whyhello context on every page — no tab switching.",
    particulars: [
      { icon: Search,      text: "Auto-detects LinkedIn profiles, company websites, Crunchbase, Apollo, and G2 pages" },
      { icon: Puzzle,      text: "Floating sidebar overlaid on the active tab — no interruption to browsing flow" },
      { icon: CheckCircle2,text: "Matches page subject to existing Whyhello contacts and companies in real time" },
      { icon: ArrowRight,  text: "One-click 'Add to Whyhello' for new prospects not yet in the database" },
      { icon: BarChart3,   text: "Live signal display: relevance score, open threads, recent activity, and buying signals" },
      { icon: Sparkles,    text: "Auto-populates outreach drafts using page context + your messaging DNA from HQ" },
    ],
    timeEstimate: "4–6 weeks",
    computeEstimate: "~$0.002 / enrichment lookup · negligible ongoing cost once contacts are indexed",
    accent: {
      bg: "bg-violet-50 dark:bg-violet-950/20",
      border: "border-violet-200 dark:border-violet-800/50",
      iconBg: "bg-violet-100 dark:bg-violet-900/40",
      iconText: "text-violet-600 dark:text-violet-400",
      badge: "bg-violet-100 dark:bg-violet-900/40",
      badgeText: "text-violet-700 dark:text-violet-300",
      dot: "bg-violet-500",
    },
  },
  {
    id: "speedrun",
    title: "Speedrun Mode",
    quarter: "Q4 2026",
    status: "planned",
    icon: Zap,
    tagline: "Block time. Gamify the grind. Hit quota.",
    particulars: [
      { icon: Timer,       text: "Session selector: 30-min, 1-hour, and 2-hour prospecting blocks — launch and go" },
      { icon: Search,      text: "Auto-queued contact list ranked by relevance score so reps always call the best prospect next" },
      { icon: Trophy,      text: "Points system: calls attempted, connects booked, meetings set — scored in real time" },
      { icon: Flame,       text: "Pace indicator shows whether you're on track to hit session targets" },
      { icon: BarChart3,   text: "End-of-session scorecard: activity breakdown, talk time, outcomes, and streak progress" },
      { icon: CheckCircle2,text: "Optional team leaderboard for future multi-seat orgs — competition as a forcing function" },
    ],
    timeEstimate: "3–5 weeks",
    computeEstimate: "Negligible — frontend-heavy feature, uses existing contact data and call infrastructure",
    accent: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-800/50",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconText: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-100 dark:bg-emerald-900/40",
      badgeText: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
  },
  {
    id: "notetaker",
    title: "Meeting Notetaker",
    quarter: "Q4 2026",
    status: "planned",
    icon: Video,
    tagline: "Auto-join every Google Meet, Teams, and Zoom. Leave with structured notes.",
    particulars: [
      { icon: CalendarCheck2, text: "Calendar integration auto-detects upcoming meetings and dispatches a bot attendee — no manual setup per call" },
      { icon: Mic2,           text: "Real-time transcription via OpenAI Whisper with speaker diarization — every voice attributed to the right person" },
      { icon: Users,          text: "Attendee list matched against Whyhello contacts and companies; new names create draft contact records automatically" },
      { icon: BookOpen,       text: "Structured meeting brief auto-generated: agenda summary, key decisions, objections raised, and competitor mentions" },
      { icon: CheckCircle2,   text: "Action items extracted and surfaced as follow-up tasks with suggested owners and due dates" },
      { icon: Sparkles,       text: "Post-meeting intelligence injected into the contact timeline and used to sharpen subsequent outreach drafts" },
    ],
    timeEstimate: "6–9 weeks",
    computeEstimate: "$0.02–0.06 / min of audio · ~$0.01 / GPT summary · ~$5/mo bot infrastructure",
    accent: {
      bg: "bg-teal-50 dark:bg-teal-950/20",
      border: "border-teal-200 dark:border-teal-800/50",
      iconBg: "bg-teal-100 dark:bg-teal-900/40",
      iconText: "text-teal-600 dark:text-teal-400",
      badge: "bg-teal-100 dark:bg-teal-900/40",
      badgeText: "text-teal-700 dark:text-teal-300",
      dot: "bg-teal-500",
    },
  },
];

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  if (status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      <Circle className="h-1.5 w-1.5 fill-current" />
      Planned
    </span>
  );
}

// ── Roadmap card ───────────────────────────────────────────────────────────────

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const Icon = item.icon;
  return (
    <div
      className={cn(
        "relative rounded-2xl border p-6 flex flex-col gap-5 transition-shadow hover:shadow-md",
        item.accent.bg,
        item.accent.border,
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        {/* Badges row — sits above title on mobile, floats right on sm+ */}
        <div className="flex flex-row items-center gap-1.5 sm:order-last sm:flex-col sm:items-end sm:shrink-0">
          <StatusBadge status={item.status} />
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md", item.accent.badge, item.accent.badgeText)}>
            {item.quarter}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", item.accent.iconBg)}>
            <Icon className={cn("h-5 w-5", item.accent.iconText)} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground leading-snug">{item.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{item.tagline}</p>
          </div>
        </div>
      </div>

      {/* Particulars */}
      <ul className="flex flex-col gap-2">
        {item.particulars.map((p, i) => {
          const PIcon = p.icon;
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <PIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", item.accent.iconText)} />
              <span>{p.text}</span>
            </li>
          );
        })}
      </ul>

      {/* Footer chips */}
      <div className="flex flex-col gap-2 pt-1 border-t border-current/10 sm:flex-row sm:flex-wrap">
        <div className="flex items-start gap-1.5 rounded-lg bg-background/60 dark:bg-black/20 border border-border px-3 py-1.5 text-xs text-foreground">
          <Clock className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <span><span className="font-medium text-muted-foreground">Build time: </span>{item.timeEstimate}</span>
        </div>
        <div className="flex items-start gap-1.5 rounded-lg bg-background/60 dark:bg-black/20 border border-border px-3 py-1.5 text-xs text-foreground">
          <Cpu className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <span><span className="font-medium text-muted-foreground">Compute: </span>{item.computeEstimate}</span>
        </div>
      </div>
    </div>
  );
}

// ── Quarter section ────────────────────────────────────────────────────────────

function QuarterSection({ quarter, children }: { quarter: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="rounded-full border border-border bg-card px-4 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {quarter}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

// ── Access denied ──────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <Shell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Master Access Only</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            This page is restricted to internal use. You don't have permission to view it.
          </p>
        </div>
      </div>
    </Shell>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Roadmap() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  const email = user?.primaryEmailAddress?.emailAddress;
  if (email !== MASTER_EMAIL) {
    return <AccessDenied />;
  }

  const q3 = items.filter((i) => i.quarter === "Q3 2026");
  const q4 = items.filter((i) => i.quarter === "Q4 2026");

  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-10">
        {/* ── Page header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
              <Lock className="h-3 w-3 text-primary" />
            </span>
            Master Access · Internal Roadmap
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Whyhello Development Roadmap
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upcoming builds, key feature particulars, estimated development timelines, and per-feature compute costs.
            This view is only visible to you.
          </p>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              In Progress
            </span>
            <span className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-muted-foreground/50" />
              Planned
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Build time = calendar weeks from kickoff to shipped
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3" />
              Compute = marginal cost per unit at steady-state volume
            </span>
          </div>
        </div>

        {/* ── Q3 2026 */}
        <QuarterSection quarter="Q3 2026">
          {q3.map((item) => <RoadmapCard key={item.id} item={item} />)}
        </QuarterSection>

        {/* ── Q4 2026 */}
        <QuarterSection quarter="Q4 2026">
          {q4.map((item) => <RoadmapCard key={item.id} item={item} />)}
        </QuarterSection>

        {/* ── Footer note */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          Timelines are estimates and subject to change based on scope and priority shifts.
        </p>
      </div>
      </div>
    </Shell>
  );
}
