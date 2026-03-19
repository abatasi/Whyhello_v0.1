import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Send, FileText, ExternalLink,
  Newspaper, Tv2, Mic2, Share2, Megaphone, ChevronDown, ChevronUp,
  Mail, Building, Sparkles, Lightbulb, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn, getInitials } from "@/lib/utils";
import { useCreateMessage, useTrackInsightDrop } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const MEDIA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; headerBg: string }> = {
  article:       { label: "Article",       icon: Newspaper, color: "text-blue-600",   bg: "bg-blue-50/70 border-blue-100",   headerBg: "hover:bg-blue-100/60" },
  blog_post:     { label: "Blog Post",     icon: FileText,  color: "text-violet-600", bg: "bg-violet-50/70 border-violet-100", headerBg: "hover:bg-violet-100/60" },
  video:         { label: "Video",         icon: Tv2,       color: "text-red-600",    bg: "bg-red-50/70 border-red-100",     headerBg: "hover:bg-red-100/60" },
  podcast:       { label: "Podcast",       icon: Mic2,      color: "text-green-600",  bg: "bg-green-50/70 border-green-100", headerBg: "hover:bg-green-100/60" },
  linkedin_post: { label: "LinkedIn Post", icon: Share2,    color: "text-sky-600",    bg: "bg-sky-50/70 border-sky-100",     headerBg: "hover:bg-sky-100/60" },
  press_release: { label: "Press Release", icon: Megaphone, color: "text-amber-600",  bg: "bg-amber-50/70 border-amber-100", headerBg: "hover:bg-amber-100/60" },
};

function getMediaConfig(type: string) {
  return MEDIA_CONFIG[type] ?? {
    label: type, icon: ExternalLink,
    color: "text-muted-foreground", bg: "bg-secondary border-border", headerBg: "hover:bg-secondary/60",
  };
}

const SUB_INSIGHTS_POOL: Record<string, string[]> = {
  article: [
    "Highlights emerging trends reshaping the industry over the next 12–18 months",
    "Proposes a new framework for measuring ROI on innovation initiatives",
    "Challenges conventional wisdom around talent retention in hybrid environments",
    "Identifies three critical barriers preventing wider enterprise adoption",
    "Cites research linking distributed leadership to stronger organisational resilience",
    "Argues for a customer-first approach over product-led growth at scale",
    "Outlines how regulatory changes will impact go-to-market strategies in 2025",
    "Explores the tension between speed-to-market and long-term technical debt",
    "Makes the case that smaller, focused teams consistently outperform large ones",
  ],
  blog_post: [
    "Shares a personal pivot from operator to founder and what changed",
    "Outlines five actionable steps for building resilient supply chains post-pandemic",
    "Compares bootstrapping versus VC funding with candid real-world trade-offs",
    "Offers a counterintuitive take on why remote teams outperform in-person ones",
    "Breaks down how top performers structure their first 90 minutes of the day",
    "Reflects on the most expensive lesson learned from a failed product launch",
    "Advocates for radical transparency as a competitive advantage in engineering culture",
    "Argues that the best onboarding is built before a single hire is made",
    "Reveals why most strategic plans fail in the first quarter of execution",
  ],
  video: [
    "Live demo shows a new AI-powered workflow cutting manual processing by 70%",
    "Interviews three C-suite leaders on their post-pandemic strategy pivots",
    "Reveals surprising patterns in customer churn hidden inside support ticket data",
    "Breaks down the technical architecture behind a full platform migration",
    "Shares a behind-the-scenes look at an end-to-end go-to-market playbook",
    "Demonstrates how to run a structured pre-mortem before a major launch",
    "Explores what separates companies that scale from those that plateau at Series B",
    "Unpacks the data behind a 3x improvement in enterprise sales cycle length",
    "Shows how a design sprint compressed six months of product work into five days",
  ],
  podcast: [
    "Deep dives into the strategic rationale behind a recent market consolidation",
    "Discusses lessons from a failed Series B pitch that ultimately led to a profitable pivot",
    "Explores why most enterprise software implementations stall before full adoption",
    "Shares an unpublished finding on the correlation between NPS scores and LTV",
    "Debates whether AI will augment or replace knowledge workers by 2027",
    "Breaks down how they achieved 3× pipeline growth in a single quarter",
    "Reflects on the cultural evolution required when moving from startup to scaleup",
    "Examines the compounding effect of small operational improvements over 18 months",
    "Challenges the assumption that growth always requires headcount expansion",
  ],
  press_release: [
    "Announces a strategic partnership expected to unlock access to $50M in new markets",
    "Reports 40% year-over-year revenue growth driven by enterprise segment expansion",
    "Introduces a new product tier purpose-built for mid-market customers",
    "Details a leadership transition and the rationale behind the succession plan",
    "Outlines a five-year roadmap to achieve carbon neutrality across all operations",
    "Reveals a $120M Series C to accelerate international expansion into EMEA and APAC",
    "Discloses plans to open three regional offices and double engineering headcount by Q3",
    "Launches an updated partner programme offering deeper integration and revenue sharing",
    "Announces the acquisition of a complementary AI startup to strengthen the core platform",
  ],
  linkedin_post: [
    "Challenges the belief that speed always wins over quality in product cycles",
    "Shares a hard-earned lesson about hiring for attitude over demonstrated skills",
    "Breaks down why most sales pipelines are fundamentally and dangerously optimistic",
    "Reflects on what a decade of building companies taught about personal resilience",
    "Invites open debate on whether the traditional CMO role is becoming obsolete",
    "Argues that the best leaders create more leaders, not more direct followers",
    "Offers a practical framework for deciding when to say no to a new opportunity",
    "Points out the hidden cost of maintaining a culture of chronic over-commitment",
    "Makes the case that company values only matter when they cost something to uphold",
  ],
};

export interface ComposeInsight {
  id: number;
  title: string;
  url: string;
  mediaType: string;
  source: string;
  description?: string | null;
  publishedDate?: string | null;
}

function getSubInsights(insight: ComposeInsight): string[] {
  const pool = SUB_INSIGHTS_POOL[insight.mediaType] ?? SUB_INSIGHTS_POOL.article;
  const count = 2 + (insight.id % 4);
  const start = (insight.id * 3) % pool.length;
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[(start + i) % pool.length]);
  }
  return result;
}

export interface ComposeContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string | null;
  companyName?: string | null;
}

interface InsightsPanelProps {
  insights: ComposeInsight[];
  label: string;
  HeaderIcon: React.ElementType;
  borderClass: string;
  gradientClass: string;
  iconBgClass: string;
  iconColorClass: string;
}

function InsightCard({ ins }: { ins: ComposeInsight }) {
  const cfg = getMediaConfig(ins.mediaType);
  const Icon = cfg.icon;
  const subInsights = getSubInsights(ins);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  return (
    <div className={cn("rounded-lg border overflow-hidden", cfg.bg)}>
      {/* Clickable title row */}
      <a
        href={ins.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("flex items-start gap-2 px-2.5 pt-2.5 pb-2 group/ins transition-colors", cfg.headerBg)}
      >
        <Icon className={cn("h-3 w-3 flex-shrink-0 mt-0.5", cfg.color)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground group-hover/ins:text-primary transition-colors leading-snug line-clamp-2">
            {ins.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{ins.source}</span>
            {ins.publishedDate && (
              <span className="text-[11px] text-muted-foreground">· {ins.publishedDate}</span>
            )}
          </div>
        </div>
        <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40 group-hover/ins:text-primary transition-colors mt-0.5" />
      </a>

      {/* Draggable sub-insights list */}
      <ul className="px-2 pb-2 space-y-1 border-t border-black/5 pt-2">
        {subInsights.map((text, idx) => (
          <li
            key={idx}
            draggable
            onDragStart={(e) => {
              setDraggingIdx(idx);
              e.dataTransfer.setData("text/plain", text);
              e.dataTransfer.setData("application/x-insight-meta", JSON.stringify({
                mediaType: ins.mediaType,
                insightTitle: ins.title,
                subInsightText: text,
              }));
              e.dataTransfer.effectAllowed = "copy";
            }}
            onDragEnd={() => setDraggingIdx(null)}
            className={cn(
              "flex items-start gap-1.5 rounded-md px-1.5 py-1.5 -mx-0.5",
              "cursor-grab active:cursor-grabbing select-none",
              "group/sub transition-all duration-100",
              draggingIdx === idx
                ? "opacity-40 scale-[0.97] bg-black/5"
                : "hover:bg-white/60 hover:shadow-sm",
            )}
          >
            <GripVertical className="h-3 w-3 flex-shrink-0 mt-[1px] text-muted-foreground/20 group-hover/sub:text-muted-foreground/50 transition-colors" />
            <Lightbulb className="h-3 w-3 flex-shrink-0 mt-[1px] text-amber-500 group-hover/sub:text-amber-600 transition-colors" />
            <span className="text-[11px] text-foreground/80 leading-snug group-hover/sub:text-foreground transition-colors">
              {text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InsightsPanel({
  insights, label, HeaderIcon, borderClass, gradientClass, iconBgClass, iconColorClass,
}: InsightsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (insights.length === 0) return null;

  const grouped = insights.reduce<Record<string, ComposeInsight[]>>((acc, ins) => {
    if (!acc[ins.mediaType]) acc[ins.mediaType] = [];
    acc[ins.mediaType].push(ins);
    return acc;
  }, {});

  const mediaOrder = ["article", "press_release", "video", "podcast", "blog_post", "linkedin_post"];
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    const ai = mediaOrder.indexOf(a);
    const bi = mediaOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className={cn("border rounded-xl overflow-hidden", borderClass, gradientClass)}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={cn("h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0", iconBgClass)}>
            <HeaderIcon className={cn("h-3 w-3", iconColorClass)} />
          </div>
          <span className="text-xs font-semibold text-foreground truncate">{label}</span>
          <span className="text-[10px] text-muted-foreground bg-white/80 border border-border/50 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
            {insights.length}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-1" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-1" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {sortedGroups.map(([type, items]) => {
            const cfg = getMediaConfig(type);
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={cn("h-2.5 w-2.5", cfg.color)} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {cfg.label}s ({items.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((ins) => <InsightCard key={ins.id} ins={ins} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ComposeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contact: ComposeContact;
  insights: ComposeInsight[];
  companyInsights?: ComposeInsight[];
}

export function ComposeDrawer({ isOpen, onClose, contact, insights, companyInsights = [] }: ComposeDrawerProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const createMessage = useCreateMessage();
  const trackDrop = useTrackInsightDrop();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [insightDropCount, setInsightDropCount] = useState(0);

  const contactName = `${contact.firstName} ${contact.lastName}`;
  const hasInsights = insights.length > 0 || companyInsights.length > 0;
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSubject("");
      setBody("");
      setInsightDropCount(0);
      setTimeout(() => bodyRef.current?.focus(), 320);
    }
  }, [isOpen, contact.id]);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData("text/plain");
    if (!text || !bodyRef.current) return;
    const ta = bodyRef.current;
    ta.focus();
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const needsPrefix = start > 0 && ta.value[start - 1] !== "\n";
    const prefix = needsPrefix ? "\n" : "";
    const alreadyHasSuffix = ta.value.slice(end).startsWith("\n");
    const suffix = alreadyHasSuffix ? "" : "\n";
    const newValue = ta.value.slice(0, start) + prefix + text + suffix + ta.value.slice(end);
    setBody(newValue);
    requestAnimationFrame(() => {
      const newPos = start + prefix.length + text.length + suffix.length;
      ta.setSelectionRange(newPos, newPos);
    });
    setInsightDropCount((c) => c + 1);
    try {
      const raw = e.dataTransfer.getData("application/x-insight-meta");
      const meta = raw ? JSON.parse(raw) as { mediaType?: string; insightTitle?: string; subInsightText?: string } : {};
      trackDrop.mutate({
        mediaType: meta.mediaType,
        insightTitle: meta.insightTitle,
        subInsightText: meta.subInsightText,
        contactId: contact.id,
      });
    } catch {
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  async function handleAction(status: "draft" | "sent") {
    try {
      await createMessage.mutateAsync({
        contactId: contact.id,
        toEmail: contact.email,
        toName: contactName,
        subject,
        body,
        status,
      });
      toast({
        title: status === "sent" ? "Message sent!" : "Draft saved",
        description: status === "sent" ? `Sent to ${contactName}` : "Saved to your drafts in Message Center",
      });
      onClose();
    } catch {
      toast({ title: `Failed to ${status === "sent" ? "send" : "save draft"}`, variant: "destructive" });
    }
  }

  const isBusy = createMessage.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-40"
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 h-[75vh] bg-card z-50 flex flex-col border-t border-border/70 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
          >
            {/* ── Header ─────────────────────────────────── */}
            <div className="relative flex items-center justify-between pl-4 pr-4 py-2.5 border-b border-border/60 flex-shrink-0 bg-card">
              <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-8 h-1 rounded-full bg-border/60" />

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                  {getInitials(contactName)}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate">{contactName}</span>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
                  {contact.jobTitle && (
                    <>
                      <span className="text-muted-foreground/40 text-xs hidden sm:inline">·</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">{contact.jobTitle}</span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-3"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Two-column body ─────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

              {/* Left column: Insights */}
              {hasInsights && (
                <div className="w-[40%] border-r border-border/60 flex flex-col overflow-hidden">
                  <div className="px-3 pt-2.5 pb-1.5 border-b border-border/40 flex-shrink-0 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Insights</span>
                    {insightDropCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                        <Lightbulb className="h-2.5 w-2.5" />
                        {insightDropCount} in this email
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground/60 flex items-center gap-1">
                      <GripVertical className="h-2.5 w-2.5 text-muted-foreground/40" />
                      Drag takeaways into email
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                    <InsightsPanel
                      insights={insights}
                      label={`Personal — ${contact.firstName} ${contact.lastName}`}
                      HeaderIcon={Mail}
                      borderClass="border-indigo-100"
                      gradientClass="bg-gradient-to-br from-indigo-50/60 to-primary/5"
                      iconBgClass="bg-primary/10"
                      iconColorClass="text-primary"
                    />
                    {contact.companyName && companyInsights.length > 0 && (
                      <InsightsPanel
                        insights={companyInsights}
                        label={`Company — ${contact.companyName}`}
                        HeaderIcon={Building}
                        borderClass="border-amber-100"
                        gradientClass="bg-gradient-to-br from-amber-50/60 to-orange-50/30"
                        iconBgClass="bg-amber-100"
                        iconColorClass="text-amber-600"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Right column: Compose */}
              <div className={cn("flex flex-col overflow-hidden", hasInsights ? "flex-1" : "w-full")}>
                <div className="px-4 pt-3 pb-2.5 border-b border-border/40 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Subject…"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground font-medium"
                  />
                </div>

                <div
                  className={cn(
                    "flex-1 overflow-hidden px-4 pt-3 rounded-sm transition-all duration-150",
                    isDragOver && "bg-primary/5 ring-2 ring-inset ring-primary/25",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setIsDragOver(false);
                    }
                  }}
                  onDrop={handleDrop}
                >
                  <textarea
                    ref={bodyRef}
                    placeholder={isDragOver ? "Drop insight here…" : `Write your message to ${contact.firstName}…`}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full h-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 flex-shrink-0 bg-card">
                  <button
                    onClick={onClose}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Discard
                  </button>
                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction("draft")}
                      disabled={isBusy || !contact.email}
                      className="gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Save Draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAction("sent")}
                      disabled={isBusy || !contact.email || !subject.trim()}
                      className="gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
