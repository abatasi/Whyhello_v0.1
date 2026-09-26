import { apiFetch } from "@/lib/apiFetch";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Mail, Send, FileText, Trash2, Plus, ChevronDown, ChevronUp,
  User, Newspaper, Tv2, Mic2, Share2, Megaphone, ExternalLink,
  Search, X, Clock, CheckCheck, Inbox, Building,
  Sparkles, Lightbulb, GripVertical, Loader2,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { cn, getInitials } from "@/lib/utils";
import {
  useListMessages,
  useCreateMessage,
  useUpdateMessage,
  useDeleteMessage,
  useRevealedContacts,
  useGetContactInsights,
  useGetCompanyInsights,
  useTrackInsightDrop,
  type Message,
  type RevealedContact,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const MEDIA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; headerBg: string }> = {
  article:       { label: "Article",       icon: Newspaper, color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50/70 dark:bg-background border-blue-100 dark:border-blue-500/30",     headerBg: "hover:bg-blue-100/60 dark:hover:bg-blue-500/20" },
  blog_post:     { label: "Blog Post",     icon: FileText,  color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50/70 dark:bg-background border-violet-100 dark:border-violet-500/30", headerBg: "hover:bg-violet-100/60 dark:hover:bg-violet-500/20" },
  video:         { label: "Video",         icon: Tv2,       color: "text-red-600 dark:text-red-400",    bg: "bg-red-50/70 dark:bg-background border-red-100 dark:border-red-500/30",       headerBg: "hover:bg-red-100/60 dark:hover:bg-red-500/20" },
  podcast:       { label: "Podcast",       icon: Mic2,      color: "text-green-600 dark:text-green-400",  bg: "bg-green-50/70 dark:bg-background border-green-100 dark:border-green-500/30",   headerBg: "hover:bg-green-100/60 dark:hover:bg-green-500/20" },
  linkedin_post: { label: "LinkedIn Post", icon: Share2,    color: "text-sky-600 dark:text-sky-400",    bg: "bg-sky-50/70 dark:bg-background border-sky-100 dark:border-sky-500/30",       headerBg: "hover:bg-sky-100/60 dark:hover:bg-sky-500/20" },
  press_release: { label: "Press Release", icon: Megaphone, color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50/70 dark:bg-background border-amber-100 dark:border-amber-500/30",   headerBg: "hover:bg-amber-100/60 dark:hover:bg-amber-500/20" },
};

function getMediaConfig(type: string) {
  return MEDIA_CONFIG[type] ?? { label: type, icon: ExternalLink, color: "text-muted-foreground", bg: "bg-secondary border-border", headerBg: "hover:bg-secondary/60 dark:hover:bg-secondary/40" };
}

const SUB_INSIGHTS_POOL: Record<string, string[]> = {
  article: [
    "Covers emerging trends in their industry segment",
    "Highlights pain points around operational efficiency",
    "References third-party research to support key claims",
    "Focuses on cost reduction strategies for mid-market firms",
    "Discusses leadership changes and their impact on strategy",
    "Addresses regulatory compliance challenges",
    "Explores technology adoption barriers",
    "Advocates for data-driven decision making",
    "Compares multiple vendor approaches",
  ],
  blog_post: [
    "Shares first-hand experience with a recurring problem",
    "Positions the author as a subject-matter expert",
    "Uses storytelling to illustrate a business challenge",
    "Includes actionable takeaways for practitioners",
    "References community feedback and comments",
    "Promotes a specific methodology or framework",
    "Ties personal narrative to broader market shifts",
    "Highlights lessons learned from a failed initiative",
    "Encourages community debate and alternative viewpoints",
  ],
  video: [
    "Demonstrates a live product workflow or demo",
    "Features a panel of industry experts discussing trends",
    "Uses visual storytelling to explain complex concepts",
    "Includes real customer testimonials and case studies",
    "Breaks down a technical topic for a non-technical audience",
    "Highlights a keynote or conference presentation",
    "Shows behind-the-scenes of a company initiative",
    "Explores a day-in-the-life of a key persona",
    "Interviews a thought leader on future market direction",
  ],
  podcast: [
    "Long-form conversation exploring strategic priorities",
    "Guest discusses lessons from a high-profile failure",
    "Focuses on talent acquisition and retention challenges",
    "Deep dive into a specific vertical or niche market",
    "Explores the intersection of technology and culture",
    "Covers go-to-market strategy and growth tactics",
    "Host challenges conventional wisdom in the field",
    "Shares predictions for the next 12–18 months",
    "Discusses partnerships and ecosystem development",
  ],
  linkedin_post: [
    "Shares a personal career milestone or achievement",
    "Asks the audience a thought-provoking question",
    "Reposts an industry report with personal commentary",
    "Celebrates a team win or company milestone",
    "Offers a contrarian perspective on a popular topic",
    "Highlights a key insight from a recent event",
    "Engages followers with a poll or open-ended question",
    "Amplifies a colleague's or partner's content",
    "Announces a new role, product, or initiative",
  ],
  press_release: [
    "Announces a strategic partnership or integration",
    "Details a new product launch or feature release",
    "Reports a significant funding or acquisition event",
    "Highlights executive appointments or leadership changes",
    "Outlines expansion into a new market or geography",
    "Communicates an award or industry recognition",
    "Presents Q-on-Q or year-over-year performance milestones",
    "Responds to a market event or competitive development",
    "Signals a shift in corporate strategy or positioning",
  ],
};

interface InsightItem {
  id: number;
  title: string;
  url: string;
  mediaType: string;
  source: string;
  publishedDate?: string | null;
}

function getSubInsights(insight: InsightItem): string[] {
  const pool = SUB_INSIGHTS_POOL[insight.mediaType] ?? SUB_INSIGHTS_POOL.article;
  const count = 2 + (insight.id % 4);
  const start = (insight.id * 3) % pool.length;
  const result: string[] = [];
  for (let i = 0; i < count; i++) result.push(pool[(start + i) % pool.length]);
  return result;
}

function InsightCard({ ins }: { ins: InsightItem }) {
  const cfg = getMediaConfig(ins.mediaType);
  const Icon = cfg.icon;
  const subInsights = getSubInsights(ins);
  const [expanded, setExpanded] = useState(true);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  return (
    <div className={cn("rounded-lg border overflow-hidden", cfg.bg)}>
      <a
        href={ins.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("flex items-start gap-2 px-2.5 pt-2.5 pb-2 group/ins transition-colors", cfg.headerBg)}
        onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
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
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={ins.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 rounded hover:bg-white/40 transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40 group-hover/ins:text-primary transition-colors" />
          </a>
          {expanded
            ? <ChevronUp className="h-2.5 w-2.5 text-muted-foreground/40" />
            : <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />}
        </div>
      </a>

      {expanded && (
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
                  ? "opacity-40 scale-[0.97] bg-black/5 dark:bg-white/5"
                  : "hover:bg-black/5 dark:hover:bg-white/5 hover:shadow-sm",
              )}
            >
              <GripVertical className="h-3 w-3 flex-shrink-0 mt-[1px] text-muted-foreground/20 group-hover/sub:text-muted-foreground/50 transition-colors" />
              <Lightbulb className="h-3 w-3 flex-shrink-0 mt-[1px] text-amber-500 group-hover/sub:text-amber-600 dark:text-amber-400 dark:group-hover/sub:text-amber-500 transition-colors" />
              <span className="text-[11px] text-foreground/80 leading-snug group-hover/sub:text-foreground transition-colors">
                {text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ContactInsightsPanel({ contactId, contactName }: { contactId: number; contactName: string }) {
  const { data: insights = [] } = useGetContactInsights(contactId, { query: { enabled: !!contactId } });
  const [expanded, setExpanded] = useState(true);

  if (insights.length === 0) return null;

  return (
    <div className="border border-border/60 dark:border-indigo-500/30 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50/40 to-primary/5 dark:bg-none dark:bg-background">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Personal Insights — {contactName}
          </span>
          <span className="text-xs text-muted-foreground bg-background border border-border/60 rounded-full px-2 py-0.5">
            {insights.length} {insights.length === 1 ? "result" : "results"}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto">
          {insights.map((ins) => <InsightCard key={ins.id} ins={ins} />)}
        </div>
      )}
    </div>
  );
}

function CompanyInsightsPanel({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { data: insights = [] } = useGetCompanyInsights(companyId, { query: { enabled: companyId > 0 } });
  const [expanded, setExpanded] = useState(true);

  if (insights.length === 0) return null;

  return (
    <div className="border border-amber-100 dark:border-amber-500/30 rounded-xl overflow-hidden bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:bg-none dark:bg-background">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
            <Building className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Company Insights — {companyName}
          </span>
          <span className="text-xs text-muted-foreground bg-background border border-border/60 rounded-full px-2 py-0.5">
            {insights.length} {insights.length === 1 ? "result" : "results"}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto">
          {insights.map((ins) => <InsightCard key={ins.id} ins={ins} />)}
        </div>
      )}
    </div>
  );
}

interface ComposeFormProps {
  draftMessage?: Message;
  onSaved: () => void;
  onCancel: () => void;
}

function ComposeForm({ draftMessage, onSaved, onCancel }: ComposeFormProps) {
  const { toast } = useToast();
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<RevealedContact | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [subject, setSubject] = useState(draftMessage?.subject ?? "");
  const [body, setBody] = useState(draftMessage?.body ?? "");
  const [isDragOver, setIsDragOver] = useState(false);
  const [insightDropCount, setInsightDropCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const createMessage = useCreateMessage();
  const updateMessage = useUpdateMessage();
  const trackDrop = useTrackInsightDrop();

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
        contactId: selectedContact?.id,
      });
    } catch { }
  }

  const { data: revealedContacts = [], isLoading: contactsLoading } = useRevealedContacts(
    contactSearch.length >= 1 ? contactSearch : undefined
  );

  useEffect(() => {
    if (draftMessage?.toEmail) {
      setSelectedContact({
        id: draftMessage.contactId ?? 0,
        firstName: draftMessage.contactFirstName ?? "",
        lastName: draftMessage.contactLastName ?? "",
        email: draftMessage.toEmail,
        jobTitle: null,
        companyName: null,
      });
      setContactSearch(`${draftMessage.contactFirstName ?? ""} ${draftMessage.contactLastName ?? ""}`.trim());
    }
  }, [draftMessage]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayedContacts = contactSearch.length >= 1 ? revealedContacts : revealedContacts.slice(0, 8);

  function handleSelectContact(c: RevealedContact) {
    setSelectedContact(c);
    setContactSearch(`${c.firstName} ${c.lastName}`);
    setShowDropdown(false);
  }

  async function handleSaveDraft() {
    if (!selectedContact) { toast({ title: "No recipient", description: "Please select a contact first.", variant: "destructive" }); return; }
    try {
      if (draftMessage) {
        await updateMessage.mutateAsync({ id: draftMessage.id, subject, body, toEmail: selectedContact.email, toName: `${selectedContact.firstName} ${selectedContact.lastName}`, contactId: selectedContact.id, status: "draft" });
      } else {
        await createMessage.mutateAsync({ contactId: selectedContact.id, toEmail: selectedContact.email, toName: `${selectedContact.firstName} ${selectedContact.lastName}`, subject, body, status: "draft" });
      }
      toast({ title: "Draft saved" });
      onSaved();
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    }
  }

  const { data: emailAccounts = [] } = useQuery<{ id: number; provider: string; email: string }[]>({
    queryKey: ["email-accounts"],
    queryFn: () => apiFetch("/api/email-accounts").then((r) => r.json()),
  });
  const [isSending, setIsSending] = useState(false);
  const [, navigate] = useLocation();

  async function handleSend() {
    if (!selectedContact) { toast({ title: "No recipient", description: "Please select a contact first.", variant: "destructive" }); return; }
    if (!subject.trim()) { toast({ title: "No subject", description: "Please add a subject line.", variant: "destructive" }); return; }
    if (emailAccounts.length === 0) {
      toast({ title: "No email account connected", description: "Connect Gmail or Outlook in Settings first.", variant: "destructive" });
      navigate("/settings");
      return;
    }
    setIsSending(true);
    try {
      let messageId: number;
      if (draftMessage) {
        const updated = await updateMessage.mutateAsync({ id: draftMessage.id, subject, body, toEmail: selectedContact.email, toName: `${selectedContact.firstName} ${selectedContact.lastName}`, contactId: selectedContact.id });
        messageId = updated.id;
      } else {
        const created = await createMessage.mutateAsync({ contactId: selectedContact.id, toEmail: selectedContact.email, toName: `${selectedContact.firstName} ${selectedContact.lastName}`, subject, body });
        messageId = created.id;
      }
      const sendRes = await apiFetch(`/api/messages/${messageId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!sendRes.ok) {
        const err = await sendRes.json() as { error?: string };
        if (err.error?.includes("No connected email account")) {
          toast({ title: "No email account connected", description: "Connect Gmail or Outlook in Settings.", variant: "destructive" });
          navigate("/settings");
          return;
        }
        throw new Error(err.error ?? "Failed to send email");
      }
      const result = await sendRes.json() as { sentFrom?: string };
      toast({ title: "Email sent!", description: result.sentFrom ? `Sent from ${result.sentFrom}` : `Sent to ${selectedContact.firstName} ${selectedContact.lastName}` });
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Failed to send", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  const isBusy = createMessage.isPending || updateMessage.isPending || isSending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border/60 flex-shrink-0">
        <h2 className="text-base font-semibold">New Message</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* To field — full width, above columns */}
      <div ref={dropdownRef} className="relative px-6 py-3 border-b border-border/40 flex-shrink-0">
        <div className={cn(
          "flex items-center gap-2 border rounded-lg px-3 py-2 bg-background transition-colors",
          showDropdown ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-border/80"
        )}>
          <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">To:</span>
          <input
            type="text"
            placeholder="Search revealed contacts…"
            value={contactSearch}
            onChange={(e) => {
              setContactSearch(e.target.value);
              setSelectedContact(null);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
          />
          {selectedContact && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
              {selectedContact.email}
            </span>
          )}
        </div>

        {showDropdown && (
          <div className="absolute z-50 top-full left-6 right-6 mt-1 bg-card dark:bg-background border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {contactsLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
            ) : displayedContacts.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">No revealed contacts found</p>
                <p className="text-xs text-muted-foreground mt-1">Reveal a contact's email from the Directory first</p>
              </div>
            ) : (
              displayedContacts.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectContact(c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {getInitials(`${c.firstName} ${c.lastName}`)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.email}
                      {c.jobTitle && ` · ${c.jobTitle}`}
                      {c.companyName && ` · ${c.companyName}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Two-column body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left column — Insights */}
        <div className="w-[42%] border-r border-border/60 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 pt-2.5 pb-2 border-b border-border/40 flex-shrink-0 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary/70" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Insights</span>
            {insightDropCount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                <Lightbulb className="h-2.5 w-2.5" />
                {insightDropCount} in this message
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <GripVertical className="h-2.5 w-2.5 text-muted-foreground/40" />
              Drag into message
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {selectedContact && selectedContact.id > 0 ? (
              <>
                <ContactInsightsPanel
                  contactId={selectedContact.id}
                  contactName={`${selectedContact.firstName} ${selectedContact.lastName}`}
                />
                {selectedContact.companyId && selectedContact.companyName && (
                  <CompanyInsightsPanel
                    companyId={selectedContact.companyId}
                    companyName={selectedContact.companyName}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                <Sparkles className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-xs text-muted-foreground">Select a recipient to see their insights</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Subject + Message */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Subject */}
          <div className="px-5 pt-3.5 pb-3 border-b border-border/40 flex-shrink-0">
            <input
              type="text"
              placeholder="Subject…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground font-medium"
            />
          </div>

          {/* Body textarea as drop zone */}
          <div
            className={cn(
              "relative flex-1 flex flex-col px-5 pt-3 pb-4 transition-all duration-150",
              isDragOver && "bg-primary/5",
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
            {isDragOver && (
              <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-inset ring-primary/25 z-10" />
            )}
            <textarea
              ref={bodyRef}
              placeholder={isDragOver ? "Drop insight here…" : "Write your message…"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            Cancel
          </button>
          {emailAccounts.length > 0 && (
            <span className="text-xs text-muted-foreground/70 truncate hidden sm:block">
              · via {emailAccounts[0].email}
            </span>
          )}
          {emailAccounts.length === 0 && (
            <span className="text-xs text-amber-600/80 hidden sm:block flex-shrink-0">
              · No email connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isBusy || !selectedContact}
            className="gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isBusy || !selectedContact}
            className="gap-1.5"
          >
            {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {isSending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageView({ message, onDelete, onEditDraft }: { message: Message; onDelete: () => void; onEditDraft: () => void }) {
  const deleteMessage = useDeleteMessage();
  const { toast } = useToast();

  async function handleDelete() {
    try {
      await deleteMessage.mutateAsync(message.id);
      toast({ title: "Message deleted" });
      onDelete();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  const recipientName = message.toName ?? message.toEmail;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border/60 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">{message.subject || "(no subject)"}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              message.status === "sent"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-amber-50 text-amber-700 border border-amber-100"
            )}>
              {message.status === "sent"
                ? <><CheckCheck className="h-3 w-3" />Sent</>
                : <><FileText className="h-3 w-3" />Draft</>}
            </span>
            <span className="text-xs text-muted-foreground">
              To: <strong className="text-foreground">{recipientName}</strong>
              {message.toEmail !== recipientName && ` <${message.toEmail}>`}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(message.updatedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {message.status === "draft" && (
            <Button variant="outline" size="sm" onClick={onEditDraft} className="gap-1.5">
              Edit Draft
            </Button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteMessage.isPending}
            className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {message.contactId && (message.contactFirstName || message.contactLastName) && (
        <div className="px-6 pt-4">
          <ContactInsightsPanel
            contactId={message.contactId}
            contactName={`${message.contactFirstName ?? ""} ${message.contactLastName ?? ""}`.trim()}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="prose prose-sm max-w-none">
          {message.body
            ? <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{message.body}</p>
            : <p className="text-sm text-muted-foreground italic">(no message body)</p>}
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const [folder, setFolder] = useState<"all" | "drafts" | "sent">("all");
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Message | null>(null);

  const statusFilter = folder === "all" ? undefined : folder === "drafts" ? "draft" : "sent";
  const { data: messages = [], isLoading } = useListMessages(statusFilter);

  const selectedMessage = messages.find((m) => m.id === selectedMessageId) ?? null;

  useEffect(() => {
    document.title = "Message Center · Whyhello";
    return () => { document.title = "Whyhello"; };
  }, []);

  function openCompose() {
    setEditingDraft(null);
    setSelectedMessageId(null);
    setIsComposing(true);
  }

  function openEditDraft(msg: Message) {
    setEditingDraft(msg);
    setSelectedMessageId(null);
    setIsComposing(true);
  }

  function closeCompose() {
    setIsComposing(false);
    setEditingDraft(null);
  }

  function onComposeSaved() {
    setIsComposing(false);
    setEditingDraft(null);
  }

  const folderCounts = {
    all: messages.length,
    drafts: messages.filter((m) => m.status === "draft").length,
    sent: messages.filter((m) => m.status === "sent").length,
  };

  const allMessages = messages;

  return (
    <Shell>
      <div className="h-[calc(100vh-64px)] flex overflow-hidden">
        {/* ── Left Sidebar ──────────────────────────────────────── */}
        <aside className="w-52 flex-shrink-0 border-r border-border/60 bg-card dark:bg-background flex flex-col">
          <div className="p-4">
            <button
              onClick={openCompose}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Compose
            </button>
          </div>

          <nav className="px-3 space-y-0.5">
            {(["all", "drafts", "sent"] as const).map((f) => {
              const icons = { all: Inbox, drafts: FileText, sent: CheckCheck };
              const labels = { all: "All Messages", drafts: "Drafts", sent: "Sent" };
              const Icon = icons[f];
              return (
                <button
                  key={f}
                  onClick={() => { setFolder(f); setSelectedMessageId(null); setIsComposing(false); }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    folder === f
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{labels[f]}</span>
                  </div>
                  {folderCounts[f] > 0 && (
                    <span className={cn(
                      "text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                      folder === f ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {folderCounts[f]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Message List ──────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r border-border/60 flex flex-col bg-background">
          <div className="px-4 py-3.5 border-b border-border/60">
            <h1 className="text-sm font-semibold text-foreground">
              {folder === "all" ? "All Messages" : folder === "drafts" ? "Drafts" : "Sent"}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No messages yet</p>
                <p className="text-xs text-muted-foreground">
                  {folder === "drafts" ? "Saved drafts will appear here" : folder === "sent" ? "Sent messages will appear here" : "Compose a message to get started"}
                </p>
              </div>
            ) : (
              <ul>
                {allMessages.map((msg) => {
                  const name = msg.toName ?? msg.toEmail;
                  const isSelected = msg.id === selectedMessageId;
                  return (
                    <li key={msg.id}>
                      <button
                        onClick={() => { setSelectedMessageId(msg.id); setIsComposing(false); setEditingDraft(null); }}
                        className={cn(
                          "w-full text-left px-4 py-3.5 border-b border-border/40 transition-colors",
                          isSelected ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-secondary/30"
                        )}
                      >
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {getInitials(name)}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate flex-1">{name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(msg.updatedAt)}</span>
                        </div>
                        <p className="text-xs font-medium text-foreground truncate pl-9">
                          {msg.subject || "(no subject)"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 pl-9">
                          <p className="text-xs text-muted-foreground truncate flex-1">
                            {msg.body || "No content"}
                          </p>
                          <span className={cn(
                            "flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full border",
                            msg.status === "sent"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            {msg.status === "sent" ? "Sent" : "Draft"}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Main Panel ──────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col bg-background">
          {isComposing ? (
            <ComposeForm
              key={editingDraft?.id ?? "new"}
              draftMessage={editingDraft ?? undefined}
              onSaved={onComposeSaved}
              onCancel={closeCompose}
            />
          ) : selectedMessage ? (
            <MessageView
              key={selectedMessage.id}
              message={selectedMessage}
              onDelete={() => setSelectedMessageId(null)}
              onEditDraft={() => openEditDraft(selectedMessage)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-100 flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Message Center</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-6">
                Compose personalised outreach emails to your contacts — with their personal insights right at your fingertips.
              </p>
              <button
                onClick={openCompose}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Compose your first message
              </button>
            </div>
          )}
        </main>
      </div>
    </Shell>
  );
}
