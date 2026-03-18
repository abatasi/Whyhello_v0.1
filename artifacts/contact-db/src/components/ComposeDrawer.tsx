import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Send, FileText, ExternalLink,
  Newspaper, Tv2, Mic2, Share2, Megaphone, ChevronDown, ChevronUp,
  Mail, Building, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn, getInitials } from "@/lib/utils";
import { useCreateMessage } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const MEDIA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  article:       { label: "Article",       icon: Newspaper, color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
  blog_post:     { label: "Blog Post",     icon: FileText,  color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
  video:         { label: "Video",         icon: Tv2,       color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  podcast:       { label: "Podcast",       icon: Mic2,      color: "text-green-600",  bg: "bg-green-50 border-green-100" },
  linkedin_post: { label: "LinkedIn Post", icon: Share2,    color: "text-sky-600",    bg: "bg-sky-50 border-sky-100" },
  press_release: { label: "Press Release", icon: Megaphone, color: "text-amber-600",  bg: "bg-amber-50 border-amber-100" },
};

function getMediaConfig(type: string) {
  return MEDIA_CONFIG[type] ?? { label: type, icon: ExternalLink, color: "text-muted-foreground", bg: "bg-secondary border-border" };
}

export interface ComposeInsight {
  id: number;
  title: string;
  url: string;
  mediaType: string;
  source: string;
  description?: string | null;
  publishedDate?: string | null;
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
        <div className="px-3 pb-3 space-y-2">
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
                <div className="space-y-1.5">
                  {items.map((ins) => (
                    <a
                      key={ins.id}
                      href={ins.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-lg border text-left group/ins hover:shadow-sm transition-all",
                        cfg.bg,
                      )}
                    >
                      <Icon className={cn("h-2.5 w-2.5 flex-shrink-0 mt-0.5", cfg.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-foreground line-clamp-2 group-hover/ins:text-primary transition-colors leading-snug">
                          {ins.title}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">{ins.source}</span>
                          {ins.publishedDate && (
                            <span className="text-[10px] text-muted-foreground">· {ins.publishedDate}</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-2 w-2 flex-shrink-0 text-muted-foreground/40 group-hover/ins:text-muted-foreground mt-0.5" />
                    </a>
                  ))}
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const contactName = `${contact.firstName} ${contact.lastName}`;
  const hasInsights = insights.length > 0 || companyInsights.length > 0;

  useEffect(() => {
    if (isOpen) {
      setSubject("");
      setBody("");
      setTimeout(() => bodyRef.current?.focus(), 320);
    }
  }, [isOpen, contact.id]);

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
          {/* Backdrop — only top half darkened */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-40"
            onClick={onClose}
          />

          {/* Drawer — bottom half of viewport */}
          <motion.div
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 h-[50vh] bg-card z-50 flex flex-col border-t border-border/70 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
          >
            {/* ── Header ─────────────────────────────────── */}
            <div className="flex items-center justify-between pl-4 pr-4 py-2.5 border-b border-border/60 flex-shrink-0 bg-card">
              {/* Drag handle hint */}
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
              {hasInsights ? (
                <div className="w-[38%] border-r border-border/60 flex flex-col overflow-hidden">
                  <div className="px-3 pt-2.5 pb-1.5 border-b border-border/40 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary/70" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Insights</span>
                    </div>
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
              ) : null}

              {/* Right column (or full-width): Compose */}
              <div className={cn("flex flex-col overflow-hidden", hasInsights ? "flex-1" : "w-full")}>
                {/* Subject */}
                <div className="px-4 pt-3 pb-2.5 border-b border-border/40 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Subject…"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground font-medium"
                  />
                </div>

                {/* Body textarea — fills remaining height */}
                <div className="flex-1 overflow-hidden px-4 pt-3">
                  <textarea
                    ref={bodyRef}
                    placeholder={`Write your message to ${contact.firstName}…`}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full h-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground resize-none leading-relaxed"
                  />
                </div>

                {/* Action bar */}
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
