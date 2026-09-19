import { apiFetch } from "@/lib/apiFetch";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, Bell, LogOut, Download, Users, Building2, Zap, X, Loader2,
  Settings, ShieldCheck, Flame, ChevronDown, Clock,
  Factory, Briefcase, Upload, Gauge, List, Milestone, Menu,
  MessageSquare, ClipboardList, Layers3, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUser, useClerk } from "@clerk/react";
import whyhelloLogo from "@assets/Untitled_design_1773415520137.png";
import { cn, getInitials } from "@/lib/utils";
import { useListExports, downloadExportFile, useCreditsStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAppMode } from "@/contexts/AppModeContext";
import {
  getRecentContactVisits,
  getRecentCompanyVisits,
} from "@/lib/recentVisits";
import "./sidebar-navigation.css";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CreditTracker({ wartime }: { wartime: boolean }) {
  const { data: status } = useCreditsStatus();
  if (!status) return null;

  const { tier, creditsUsed, creditsTotal, isUnlimited } = status;
  const remaining = isUnlimited ? null : (creditsTotal ?? 0) - creditsUsed;
  const pct = isUnlimited ? 0 : creditsUsed / (creditsTotal ?? 1);

  const tierLabel =
    tier === "enterprise" ? "Enterprise" : tier === "professional" ? "Pro" : "Free";

  const colorClass = wartime
    ? "text-[#7C3E2A] bg-[#EDD4C6] border-[#DDB99E]"
    : isUnlimited
    ? "text-primary bg-primary/10 border-primary/20"
    : pct >= 0.9
    ? "text-destructive bg-destructive/10 border-destructive/20"
    : pct >= 0.7
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-emerald-700 bg-emerald-50 border-emerald-200";

  const usageText = isUnlimited
    ? "∞"
    : `${creditsUsed.toLocaleString()} / ${(creditsTotal ?? 0).toLocaleString()}`;

  const title = isUnlimited
    ? "Unlimited credits (Enterprise)"
    : `${remaining?.toLocaleString()} credits remaining this month`;

  return (
    <div
      title={title}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold select-none",
        colorClass,
      )}
    >
      <Zap className="h-3 w-3 flex-shrink-0" />
      <span>{usageText}</span>
      <span className="hidden sm:inline opacity-60 font-normal">· {tierLabel}</span>
    </div>
  );
}

interface ContactResult {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  companyName: string | null;
}

interface CompanyResult {
  id: number;
  name: string;
  industry: string | null;
  location: string | null;
}

function GlobalSearch({ wartime }: { wartime: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeSearch();
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const enabled = debouncedQuery.length >= 2;

  const { data: contactsData, isLoading: contactsLoading } = useQuery<{ data: ContactResult[] }>({
    queryKey: ["global-search", "contacts", debouncedQuery],
    queryFn: () =>
      apiFetch(`/api/contacts?search=${encodeURIComponent(debouncedQuery)}&limit=5`).then((r) =>
        r.json(),
      ),
    enabled,
    staleTime: 10_000,
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery<{ data: CompanyResult[] }>({
    queryKey: ["global-search", "companies", debouncedQuery],
    queryFn: () =>
      apiFetch(`/api/companies?search=${encodeURIComponent(debouncedQuery)}&limit=5`).then((r) =>
        r.json(),
      ),
    enabled,
    staleTime: 10_000,
  });

  const contacts = contactsData?.data ?? [];
  const companies = companiesData?.data ?? [];
  const isLoading = enabled && (contactsLoading || companiesLoading);
  const hasResults = contacts.length > 0 || companies.length > 0;
  const showDropdown = open && debouncedQuery.length >= 2;

  function closeSearch() {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }

  function navigateTo(path: string) {
    navigate(path);
    closeSearch();
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "rounded-full",
          wartime && "text-[#7C3E2A] hover:bg-[#EDD4C6] hover:text-[#5C2E22]",
        )}
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={cn(
        "flex items-center gap-2 border rounded-full px-3 py-1.5 w-72 transition-all",
        wartime
          ? "bg-[#EDD4C6] border-[#DDB99E] text-[#5C2E22]"
          : "bg-secondary/50 border-border",
      )}>
        <Search className={cn("h-4 w-4 flex-shrink-0", wartime ? "text-[#A0624A]" : "text-muted-foreground")} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search contacts & companies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(
            "flex-1 bg-transparent text-sm outline-none min-w-0",
            wartime ? "placeholder:text-[#A0624A]/70 text-[#5C2E22]" : "placeholder:text-muted-foreground",
          )}
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            className={cn(
              "transition-colors flex-shrink-0",
              wartime ? "text-[#A0624A] hover:text-[#5C2E22]" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={closeSearch}
            className={cn(
              "transition-colors flex-shrink-0",
              wartime ? "text-[#A0624A] hover:text-[#5C2E22]" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Close search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &ldquo;{debouncedQuery}&rdquo;
            </div>
          ) : (
            <>
              {contacts.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2 bg-muted/30 border-b border-border/60">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Contacts
                    </span>
                  </div>
                  <ul>
                    {contacts.slice(0, 4).map((c) => (
                      <li key={c.id}>
                        <button
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/40 transition-colors text-left"
                          onClick={() => navigateTo(`/contacts/${c.id}`)}
                        >
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                            {getInitials(`${c.firstName} ${c.lastName}`)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {c.firstName} {c.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[c.jobTitle, c.companyName].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {companies.length > 0 && (
                <div className={contacts.length > 0 ? "border-t border-border/60" : ""}>
                  <div className="px-4 py-2 flex items-center gap-2 bg-muted/30 border-b border-border/60">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Companies
                    </span>
                  </div>
                  <ul>
                    {companies.slice(0, 4).map((c) => (
                      <li key={c.id}>
                        <button
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/40 transition-colors text-left"
                          onClick={() => navigateTo(`/companies/${c.id}`)}
                        >
                          <div className="h-7 w-7 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[c.industry, c.location].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const { data: exports } = useListExports();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<number | null>(null);
  const recent = exports?.slice(0, 5) ?? [];

  const handleDownload = async (id: number, filename: string) => {
    setDownloading(id);
    try {
      await downloadExportFile(id, filename);
      onClose();
    } catch {
      toast({ title: "Download failed", description: "Unable to download the file.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold">Recent Exports</span>
        {exports && exports.length > 0 && (
          <Link href="/profile" onClick={onClose}>
            <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No exports yet. Open a list and export to CSV.
        </div>
      ) : (
        <ul>
          {recent.map((ex) => (
            <li key={ex.id} className="px-4 py-3 border-b border-border/50 last:border-0 flex items-start gap-3">
              <div className={cn(
                "mt-0.5 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center",
                ex.listType === "contacts" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600",
              )}>
                {ex.listType === "contacts"
                  ? <Users className="h-3.5 w-3.5" />
                  : <Building2 className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ex.listName}</p>
                <p className="text-xs text-muted-foreground">{ex.memberCount} records · {formatRelative(ex.requestedAt)}</p>
              </div>
              <button
                onClick={() => handleDownload(ex.id, ex.filename)}
                disabled={downloading === ex.id}
                className="flex-shrink-0 p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Download CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── More dropdown (Lists, Industries, Roles, Import, Roadmap*) ───────────────

const MASTER_EMAIL = "abatasi@gmail.com";

const baseMoreItems = [
  { label: "Lists", href: "/lists", icon: List },
  { label: "Industries", href: "/industries", icon: Factory },
  { label: "Roles", href: "/roles", icon: Briefcase },
  { label: "Import", href: "/import", icon: Upload },
];

const masterMoreItems = [
  { label: "Roadmap", href: "/roadmap", icon: Milestone },
];

function MoreDropdown({ wartime }: { wartime: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const { user } = useUser();

  const isMaster = user?.primaryEmailAddress?.emailAddress === MASTER_EMAIL;
  const moreItems = isMaster ? [...baseMoreItems, ...masterMoreItems] : baseMoreItems;

  const isMoreActive = moreItems.some((item) => location.startsWith(item.href));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          wartime
            ? isMoreActive
              ? "bg-[#E0BBA8] text-[#5C2E22]"
              : "text-[#7C3E2A] hover:bg-[#EDD4C6] hover:text-[#5C2E22]"
            : isMoreActive
            ? "bg-secondary/50 text-foreground"
            : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
        )}
        aria-expanded={open}
      >
        More
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden py-1">
          {moreItems.map(({ label, href, icon: Icon }) => {
            const isActive = location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-secondary/60 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── HQ pill — simple link, no dropdown ───────────────────────────────────────
// Navigates to /hq. Shows current mode alongside the HQ label.
// Mode is only toggled inside the HQ module itself.

function HQPill({ wartime }: { wartime: boolean }) {
  const [location] = useLocation();
  const isActive = location.startsWith("/hq");
  const ModeIcon = wartime ? Flame : ShieldCheck;
  const modeLabel = wartime ? "Wartime" : "Peacetime";

  return (
    <Link href="/hq">
      <span
        title="HQ — messaging, scoring & calibration"
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all select-none border cursor-pointer",
          wartime
            ? isActive
              ? "bg-[#7C3E2A] text-[#F4E2D8] border-[#7C3E2A]"
              : "bg-[#E8C4B0] text-[#7C3E2A] border-[#DDB99E] hover:bg-[#E0BBA8] hover:text-[#5C2E22]"
            : isActive
            ? "bg-foreground text-background border-foreground"
            : "bg-secondary text-foreground border-border hover:bg-secondary/80",
        )}
      >
        <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
        <span>HQ</span>
        <span className={cn(
          "h-3.5 w-px",
          wartime
            ? isActive ? "bg-[#F4E2D8]/40" : "bg-[#DDB99E]"
            : isActive ? "bg-background/30" : "bg-border",
        )} />
        <ModeIcon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{modeLabel}</span>
      </span>
    </Link>
  );
}

// ── Logo menu (replaces logo link; houses recents, notifs, settings, logout) ─

type RecentItem =
  | { type: "contact"; id: number; name: string; title: string | null; companyName: string | null; visitedAt: number }
  | { type: "company"; id: number; name: string; industry: string | null; visitedAt: number };

function LogoMenu({ wartime, sidebar = false, expanded = false }: { wartime: boolean; sidebar?: boolean; expanded?: boolean }) {
  const [open, setOpen] = useState(false);
  const [notifExpanded, setNotifExpanded] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: exports } = useListExports();
  const { toast } = useToast();
  const hasExports = (exports?.length ?? 0) > 0;
  const recentExports = exports?.slice(0, 3) ?? [];

  // Refresh recents from localStorage each time the menu opens
  useEffect(() => {
    if (!open) return;
    const contacts = getRecentContactVisits().map((v) => ({
      type: "contact" as const,
      id: v.id,
      name: v.name,
      title: v.title,
      companyName: v.companyName,
      visitedAt: v.visitedAt,
    }));
    const companies = getRecentCompanyVisits().map((v) => ({
      type: "company" as const,
      id: v.id,
      name: v.name,
      industry: v.industry,
      visitedAt: v.visitedAt,
    }));
    const merged = [...contacts, ...companies]
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, 3);
    setRecents(merged);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setNotifExpanded(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleDownload = async (id: number, filename: string) => {
    setDownloading(id);
    try {
      await downloadExportFile(id, filename);
    } catch {
      toast({ title: "Download failed", description: "Unable to download the file.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex items-center flex-shrink-0",
        sidebar ? "sidebar-logo-menu" : "self-stretch -ml-6 xl:-ml-8",
      )}
    >
      {/* Logo trigger */}
      <button
        onClick={() => { setOpen((o) => !o); setNotifExpanded(false); }}
        className={cn(
          sidebar
            ? "sidebar-logo-trigger"
            : "h-full pl-6 xl:pl-8 pr-4 flex items-center cursor-pointer",
          wartime ? "bg-transparent" : "bg-background",
        )}
        aria-label="Open app menu"
      >
        {/* Crop the combined logo PNG to just the W mark (clip right side to hide wordmark) */}
        <div className={cn("sidebar-logo-crop", expanded && "sidebar-logo-crop-expanded")}>
          <img src={whyhelloLogo} alt="Whyhello" />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+1px)] w-72 rounded-b-xl rounded-r-xl border border-border bg-card shadow-xl z-50 overflow-hidden">

          {/* ── Recents ── */}
          {recents.length > 0 && (
            <>
              <div className="px-4 py-2 flex items-center gap-2 bg-muted/30 border-b border-border/60">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Recents
                </span>
              </div>
              <ul>
                {recents.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link
                      href={item.type === "contact" ? `/contacts/${item.id}` : `/companies/${item.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors"
                    >
                      {item.type === "contact" ? (
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                          {getInitials(item.name)}
                        </div>
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-amber-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.type === "contact"
                            ? [item.title, item.companyName].filter(Boolean).join(" · ") || "Contact"
                            : item.industry ?? "Company"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border/60" />
            </>
          )}

          {/* ── Utilities ── */}
          <div className="py-1">
            {/* Notifications (expandable) */}
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
              onClick={() => setNotifExpanded((e) => !e)}
            >
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span>Notifications</span>
              {hasExports && !notifExpanded && (
                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              )}
              <ChevronDown
                className={cn(
                  "ml-auto h-3.5 w-3.5 flex-shrink-0 transition-transform",
                  notifExpanded && "rotate-180",
                )}
              />
            </button>

            {notifExpanded && (
              <div className="border-t border-border/40 bg-muted/20">
                {recentExports.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">
                    No exports yet. Open a list and export to CSV.
                  </p>
                ) : (
                  <ul>
                    {recentExports.map((ex) => (
                      <li
                        key={ex.id}
                        className="px-4 py-2.5 flex items-center gap-3 border-b border-border/30 last:border-0"
                      >
                        <div
                          className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                            ex.listType === "contacts"
                              ? "bg-indigo-50 text-indigo-600"
                              : "bg-amber-50 text-amber-600",
                          )}
                        >
                          {ex.listType === "contacts" ? (
                            <Users className="h-3.5 w-3.5" />
                          ) : (
                            <Building2 className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{ex.listName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {ex.memberCount} records · {formatRelative(ex.requestedAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownload(ex.id, ex.filename)}
                          disabled={downloading === ex.id}
                          className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex-shrink-0"
                          title="Download CSV"
                        >
                          {downloading === ex.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span>Settings</span>
            </Link>
          </div>

          <div className="border-t border-border/60" />

          <div className="py-1">
            <button
              onClick={() => { setOpen(false); signOut({ redirectUrl: basePath || "/" }); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors text-left"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MasterSidebar({ wartime }: { wartime: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [location] = useLocation();
  const { user } = useUser();
  const isMaster = user?.primaryEmailAddress?.emailAddress === MASTER_EMAIL;
  const moreItems = isMaster ? [...baseMoreItems, ...masterMoreItems] : baseMoreItems;
  const isRouteActive = (href: string) =>
    href === "/" ? location === "/" || location === "" : location.startsWith(href);

  const navItems = [
    { label: "Directory", href: "/", icon: Users },
    { label: "Message Center", href: "/messages", icon: MessageSquare },
    { label: "Playbooks", href: "/playbooks", icon: ClipboardList },
    { label: "Multi-threading", href: "/multithreading", icon: Layers3 },
  ];

  const handleBlur = () => {
    window.setTimeout(() => {
      if (!document.querySelector(".master-sidebar:focus-within")) setExpanded(false);
    }, 0);
  };

  return (
    <aside
      className={cn("master-sidebar hidden md:flex", expanded && "is-expanded", wartime && "is-wartime")}
      aria-label="Whyhello primary navigation"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={handleBlur}
    >
      <div className="master-sidebar-inner">
        <div className="master-brand-row">
          <LogoMenu wartime={wartime} sidebar expanded={expanded} />
        </div>

        <nav className="master-route-nav" aria-label="Primary">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = isRouteActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn("master-route", active && "is-active")}
                aria-label={label}
                title={!expanded ? label : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 1.85} />
                <span>{label}</span>
                {active && expanded && <i className="master-active-dot" />}
              </Link>
            );
          })}

          {moreItems.length > 0 && (
            <>
              <div className="master-more-header" aria-hidden={!expanded}>More</div>
              {moreItems.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn("master-route master-subroute", isRouteActive(href) && "is-active")}
                  aria-label={label}
                  title={!expanded ? label : undefined}
                >
                  <Icon size={18} strokeWidth={1.85} />
                  <span>{label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="master-sidebar-bottom">
          <Link href="/settings" className="master-route" aria-label="Settings" title={!expanded ? "Settings" : undefined}>
            <Settings size={18} />
            <span>Settings</span>
          </Link>
          <Link href="/profile" className="master-route" aria-label="Profile" title={!expanded ? "Profile" : undefined}>
            <UserRound size={18} />
            <span>Profile</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

// ── Main Navbar ──────────────────────────────────────────────────────────────

export function Navbar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { mode } = useAppMode();
  const wartime = mode === "wartime";
  const [mobileOpen, setMobileOpen] = useState(false);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navItems = [
    { label: "Directory",       href: "/",               icon: Users    },
    { label: "Message Center",  href: "/messages",       icon: Bell     },
    { label: "Playbooks",       href: "/playbooks",      icon: List     },
    { label: "Multi-threading", href: "/multithreading", icon: Zap      },
  ];

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.primaryEmailAddress?.emailAddress ?? "Account";

  const isMaster = user?.primaryEmailAddress?.emailAddress === MASTER_EMAIL;
  const moreItems = isMaster ? [...baseMoreItems, ...masterMoreItems] : baseMoreItems;
  const allMobileItems = [...navItems, ...moreItems];

  function closeMobile() { setMobileOpen(false); }

  return (
    <>
      <MasterSidebar wartime={wartime} />
      <header
        className={cn(
        "sticky top-0 z-40 w-full md:ml-11 md:w-[calc(100%-44px)] border-b transition-colors duration-300",
        wartime
          ? "border-[#e8c9b8] bg-[#F4E2D8]"
          : "border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        )}
      >
      {/* ── Desktop bar (md+) — navigation left, utilities right ── */}
      <div className="hidden md:flex w-full px-4 lg:px-6 xl:px-8 h-16 items-center gap-3">
        <div className="ml-auto flex items-center gap-1.5 lg:gap-2 justify-end flex-shrink-0">
          <HQPill wartime={wartime} />
          <CreditTracker wartime={wartime} />
          <GlobalSearch wartime={wartime} />
          <div className={cn("h-8 w-px mx-1", wartime ? "bg-[#E0BBA8]" : "bg-border")} />
          <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className={cn("h-7 w-7 rounded-full object-cover border", wartime ? "border-[#DDB99E]" : "border-border")} />
            ) : (
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center font-semibold text-xs border", wartime ? "bg-[#EDD4C6] text-[#7C3E2A] border-[#DDB99E]" : "bg-primary/10 text-primary border-primary/20")}>
                {getInitials(displayName)}
              </div>
            )}
            <span className={cn("hidden xl:block text-sm font-medium", wartime ? "text-[#7C3E2A]" : "")}>{displayName}</span>
          </Link>
        </div>
      </div>

      {/* ── Mobile bar (< md) ── */}
      <div className="md:hidden flex items-center px-4 h-14 gap-2">
        {/* W logo mark */}
        <div className="overflow-hidden flex-shrink-0" style={{ width: 36, height: 24 }}>
          <img src={whyhelloLogo} alt="Whyhello" className="h-6 w-auto max-w-none" />
        </div>

        <div className="flex-1" />

        {/* HQ pill */}
        <HQPill wartime={wartime} />

        {/* Hamburger / close */}
        <button
          onClick={() => setMobileOpen(v => !v)}
          className={cn(
            "p-2 -mr-1 rounded-lg transition-colors flex-shrink-0",
            wartime ? "text-[#7C3E2A] hover:bg-[#EDD4C6]" : "text-foreground hover:bg-secondary/40",
          )}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div
          className={cn(
            "md:hidden border-t overflow-y-auto",
            "max-h-[calc(100svh-3.5rem)]",
            wartime ? "border-[#e8c9b8] bg-[#F4E2D8]" : "border-border bg-background",
          )}
        >
          {/* Nav + more items */}
          <nav className="px-3 pt-3 pb-1 flex flex-col gap-0.5">
            {allMobileItems.map(({ label, href, icon: Icon }) => {
              const isActive = href === "/"
                ? location === "/" || location === ""
                : location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                    wartime
                      ? isActive ? "bg-[#E0BBA8] text-[#5C2E22]" : "text-[#7C3E2A] hover:bg-[#EDD4C6]/60"
                      : isActive ? "bg-secondary/60 text-foreground" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className={cn("h-px mx-4 my-2", wartime ? "bg-[#e8c9b8]" : "bg-border/60")} />

          {/* Profile row */}
          <Link
            href="/profile"
            onClick={closeMobile}
            className={cn(
              "flex items-center gap-3 mx-3 px-3 py-3 my-1 rounded-xl transition-colors",
              wartime ? "hover:bg-[#EDD4C6]/60" : "hover:bg-secondary/30",
            )}
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className={cn("h-9 w-9 rounded-full object-cover border flex-shrink-0", wartime ? "border-[#DDB99E]" : "border-border")} />
            ) : (
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm border flex-shrink-0", wartime ? "bg-[#EDD4C6] text-[#7C3E2A] border-[#DDB99E]" : "bg-primary/10 text-primary border-primary/20")}>
                {getInitials(displayName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold truncate", wartime ? "text-[#5C2E22]" : "text-foreground")}>{displayName}</p>
              <p className="text-xs text-muted-foreground">Profile &amp; settings</p>
            </div>
            <CreditTracker wartime={wartime} />
          </Link>

          <div className={cn("h-px mx-4 my-2", wartime ? "bg-[#e8c9b8]" : "bg-border/60")} />

          {/* Sign out */}
          <div className="px-3 pb-4">
            <button
              onClick={() => { closeMobile(); signOut({ redirectUrl: basePath || "/" }); }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-left transition-colors",
                wartime ? "text-[#7C3E2A] hover:bg-[#EDD4C6]/60" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
              )}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}
      </header>
    </>
  );
}
