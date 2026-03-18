import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Send, FileText, ExternalLink,
  Newspaper, Tv2, Mic2, Share2, Megaphone, ChevronDown, ChevronUp,
  Mail, Building,
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
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn("h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0", iconBgClass)}>
            <HeaderIcon className={cn("h-3 w-3", iconColorClass)} />
          </div>
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground bg-white/80 border border-border/50 rounded-full px-1.5 py-0.5 leading-none">
            {insights.length}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 max-h-56 overflow-y-auto">
          {sortedGroups.map(([type, items]) => {
            const cfg = getMediaConfig(type);
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={cn("h-3 w-3", cfg.color)} />
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
                        "flex items-start gap-2 p-2.5 rounded-lg border text-left group/ins hover:shadow-sm transition-all",
                        cfg.bg,
                      )}
                    >
                      <Icon className={cn("h-3 w-3 flex-shrink-0 mt-0.5", cfg.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground line-clamp-2 group-hover/ins:text-primary transition-colors leading-snug">
                          {ins.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">{ins.source}</span>
                          {ins.publishedDate && (
                            <span className="text-[10px] text-muted-foreground">· {ins.publishedDate}</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40 group-hover/ins:text-muted-foreground mt-0.5" />
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

  useEffect(() => {
    if (isOpen) {
      setSubject("");
      setBody("");
      setTimeout(() => bodyRef.current?.focus(), 300);
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
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[520px] bg-card shadow-2xl z-50 flex flex-col border-l border-border/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {getInitials(contactName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{contactName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.email}
                    {contact.jobTitle && ` · ${contact.jobTitle}`}
                  </p>
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

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* Subject */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Email subject…"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground transition-colors"
                />
              </div>

              {/* Personal Insights */}
              <InsightsPanel
                insights={insights}
                label={`Personal Insights — ${contactName}`}
                HeaderIcon={Mail}
                borderClass="border-indigo-100"
                gradientClass="bg-gradient-to-br from-indigo-50/60 to-primary/5"
                iconBgClass="bg-primary/10"
                iconColorClass="text-primary"
              />

              {/* Company Insights */}
              {contact.companyName && companyInsights.length > 0 && (
                <InsightsPanel
                  insights={companyInsights}
                  label={`Company Insights — ${contact.companyName}`}
                  HeaderIcon={Building}
                  borderClass="border-amber-100"
                  gradientClass="bg-gradient-to-br from-amber-50/60 to-orange-50/30"
                  iconBgClass="bg-amber-100"
                  iconColorClass="text-amber-600"
                />
              )}

              {/* Message body */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Message
                </label>
                <textarea
                  ref={bodyRef}
                  placeholder={`Write your message to ${contact.firstName}…`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground transition-colors resize-none"
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border/60 flex-shrink-0 bg-card">
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
