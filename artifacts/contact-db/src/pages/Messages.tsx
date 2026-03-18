import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Mail, Send, FileText, Trash2, Plus, ChevronDown, ChevronUp,
  User, Newspaper, Tv2, Mic2, Share2, Megaphone, ExternalLink,
  Search, X, Clock, CheckCheck, Inbox,
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
  type Message,
  type RevealedContact,
} from "@workspace/api-client-react";
import { useGetContactInsights } from "@workspace/api-client-react";
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

  const grouped = insights.reduce<Record<string, typeof insights>>((acc, insight) => {
    const key = insight.mediaType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(insight);
    return acc;
  }, {});

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50/40 to-primary/5">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Personal Insights — {contactName}
          </span>
          <span className="text-xs text-muted-foreground bg-white border border-border/60 rounded-full px-2 py-0.5">
            {insights.length} {insights.length === 1 ? "result" : "results"}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 max-h-64 overflow-y-auto">
          {Object.entries(grouped).map(([type, items]) => {
            const cfg = getMediaConfig(type);
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {cfg.label}s ({items.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((insight) => (
                    <a
                      key={insight.id}
                      href={insight.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-lg border text-left group/insight hover:shadow-sm transition-all",
                        cfg.bg,
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5", cfg.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground line-clamp-2 group-hover/insight:text-primary transition-colors">
                          {insight.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{insight.source}</span>
                          {insight.publishedDate && (
                            <span className="text-xs text-muted-foreground">· {insight.publishedDate}</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground/50 group-hover/insight:text-muted-foreground mt-0.5" />
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const createMessage = useCreateMessage();
  const updateMessage = useUpdateMessage();

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

  async function handleSend() {
    if (!selectedContact) { toast({ title: "No recipient", description: "Please select a contact first.", variant: "destructive" }); return; }
    if (!subject.trim()) { toast({ title: "No subject", description: "Please add a subject line.", variant: "destructive" }); return; }
    try {
      if (draftMessage) {
        await updateMessage.mutateAsync({ id: draftMessage.id, subject, body, toEmail: selectedContact.email, toName: `${selectedContact.firstName} ${selectedContact.lastName}`, contactId: selectedContact.id, status: "sent" });
      } else {
        await createMessage.mutateAsync({ contactId: selectedContact.id, toEmail: selectedContact.email, toName: `${selectedContact.firstName} ${selectedContact.lastName}`, subject, body, status: "sent" });
      }
      toast({ title: "Message sent!", description: `Sent to ${selectedContact.firstName} ${selectedContact.lastName}` });
      onSaved();
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  }

  const isBusy = createMessage.isPending || updateMessage.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <h2 className="text-base font-semibold">New Message</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Recipient field */}
        <div ref={dropdownRef} className="relative">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">To</label>
          <div className={cn(
            "flex items-center gap-2 border rounded-lg px-3 py-2 bg-background transition-colors",
            showDropdown ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-border/80"
          )}>
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
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
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
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

        {/* Subject */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Subject</label>
          <input
            type="text"
            placeholder="Email subject…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground transition-colors"
          />
        </div>

        {/* Personal Insights panel */}
        {selectedContact && selectedContact.id > 0 && (
          <ContactInsightsPanel
            contactId={selectedContact.id}
            contactName={`${selectedContact.firstName} ${selectedContact.lastName}`}
          />
        )}

        {/* Body */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Message</label>
          <textarea
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground transition-colors resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-border/60 flex items-center justify-between gap-3">
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2.5">
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
            <Send className="h-3.5 w-3.5" />
            Send
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
        <aside className="w-52 flex-shrink-0 border-r border-border/60 bg-card flex flex-col">
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
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
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
