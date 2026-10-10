import { apiFetch } from "@/lib/apiFetch";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "next-themes";
import {
  Search, Bell, LogOut, Download, Users, Building2, Zap, X, Loader2,
  Settings, ShieldCheck, Flame, ChevronDown, Clock,
  Factory, Briefcase, Upload, Gauge, List, Milestone, Menu,
  MessageSquare, Layers3, House, Sun, Moon, Monitor
} from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { darkLogoUrl, lightLogoUrl } from "@/components/BrandLogo";
import { SidebarBrandRow } from "./SidebarBrandLogo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlaybookIcon } from "@/components/PlaybookIcon";
import { cn, getInitials } from "@/lib/utils";
import { OverallScorePill } from "@/components/OverallScorePill";
import {
  useListExports,
  downloadExportFile,
  useCreditsStatus,
  useGetContactMetaScore,
  useTopBuyers,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAppMode } from "@/contexts/AppModeContext";
import {
  getRecentContactVisits,
  getRecentCompanyVisits,
  type RecentContactVisit,
  type RecentCompanyVisit,
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

function nextTheme(theme: string | undefined): "light" | "dark" | "system" {
  if (theme === "system" || !theme) return "light";
  if (theme === "light") return "dark";
  return "system";
}

function themeLabel(theme: string | undefined): string {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
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
    ? "text-[#7C3E2A] dark:text-[#E0BBA8]"
    : isUnlimited
    ? "text-[#6F5BAF] dark:text-primary"
    : pct >= 0.9
    ? "text-destructive"
    : pct >= 0.7
    ? "text-amber-600 dark:text-amber-500"
    : "text-[#6F5BAF] dark:text-primary";

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
        "flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold select-none",
        colorClass,
      )}
    >
      <Zap className="h-3 w-3 flex-shrink-0" />
      <span>{usageText}</span>
      <span className="hidden sm:inline text-muted-foreground/80 font-normal">{tierLabel === "Free" ? "credits" : `· ${tierLabel}`}</span>
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

const RECENT_SEARCHES_KEY = "whyhello-recent-global-searches";

function RecentContactMenuItem({
  contact,
  onSelect,
}: {
  contact: RecentContactVisit;
  onSelect: () => void;
}) {
  const { data: aggregateScore, isLoading } = useGetContactMetaScore(contact.id);
  const context = [contact.title, contact.companyName].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
        {getInitials(contact.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{contact.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {context || "Contact"}
        </span>
      </span>
      <OverallScorePill score={aggregateScore?.metaScore} loading={isLoading} />
    </button>
  );
}

export function GlobalSearch({ wartime, focusMode = false, onCloseFocusMode }: {
  wartime: boolean; focusMode?: boolean; onCloseFocusMode?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentContacts, setRecentContacts] = useState<RecentContactVisit[]>([]);
  const [recentCompanies, setRecentCompanies] = useState<RecentCompanyVisit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressFocusOpen = useRef(false);
  const [, navigate] = useLocation();
  const { data: topBuyers = [] } = useTopBuyers();

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        setRecentSearches(stored.filter((item): item is string => typeof item === "string").slice(0, 5));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (focusMode) setOpen(true);
  }, [focusMode]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setRecentContacts(getRecentContactVisits());
      setRecentCompanies(getRecentCompanyVisits());
    }
  }, [open, focusMode]);

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!focusMode && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !focusMode) closeSearch();
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, focusMode, onCloseFocusMode]);

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
  const showDropdown = open;

  function rememberSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  }

  function closeSearch() {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    if (focusMode) onCloseFocusMode?.();
  }

  function navigateTo(path: string) {
    rememberSearch(query);
    navigate(path);
    closeSearch();
  }

  function openSearch(value: string) {
    rememberSearch(value);
    navigate(`/directory/people?search=${encodeURIComponent(value)}`);
    closeSearch();
  }

  const searchContent = (
    <div
      ref={containerRef}
      className={focusMode ? "relative w-full" : "relative w-full origin-center transition-transform duration-200 hover:scale-[1.015] focus-within:scale-[1.015]"}
    >
      <div className={cn(
        "flex h-7 w-full items-center gap-2 rounded-[7px] border px-2.5 transition-colors",
        focusMode && "h-12 rounded-lg px-3",
        wartime
          ? "border-[#DDB99E] bg-[#EDD4C6] text-[#5C2E22] dark:border-[#5a2c1d] dark:bg-[#3d1c12] dark:text-[#edd4c6]"
          : "border-border bg-secondary/50 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20",
      )}>
        <Search className={cn("h-3.5 w-3.5 flex-shrink-0", wartime ? "text-[#A0624A] dark:text-[#E0BBA8]" : "text-muted-foreground")} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search contacts & companies"
          value={query}
          data-testid="global-search-input"
          aria-label="Search contacts and companies"
          onFocus={() => { if (!suppressFocusOpen.current) setOpen(true); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) openSearch(query);
          }}
          className={cn(
            "min-w-0 flex-1 cursor-pointer bg-transparent text-[11px] font-medium outline-none",
            focusMode && "cursor-text text-base",
            wartime ? "placeholder:text-[#A0624A]/70 text-[#5C2E22] dark:placeholder:text-[#e8c9b8]/70 dark:text-[#edd4c6]" : "text-foreground placeholder:text-muted-foreground",
          )}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className={cn(
              "transition-colors flex-shrink-0",
              wartime ? "text-[#A0624A] hover:text-[#5C2E22] dark:text-[#E0BBA8] dark:hover:text-[#edd4c6]" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className={cn(
          "ml-auto flex-shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none",
          wartime
            ? "border-[#C99478]/60 bg-[#F4E2D8]/70 text-[#7C3E2A] dark:border-[#8a4933] dark:bg-[#5a2c1d] dark:text-[#E0BBA8]"
            : "border-border bg-background/70 text-muted-foreground",
        )}>
          {focusMode ? "Esc" : "Ctrl K"}
        </kbd>
      </div>

      {showDropdown && (
        <div className={focusMode
          ? "mt-3 max-h-[55dvh] w-full overflow-y-auto rounded-xl border border-border bg-background"
          : "absolute left-1/2 top-full z-50 mt-2 w-full min-w-[22rem] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-lg"}>
          {debouncedQuery.length < 2 ? (
            <div className="max-h-[24rem] overflow-y-auto py-2">
              <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent searches
              </div>
              {recentSearches.length > 0 ? (
                recentSearches.map((recent) => (
                  <button
                    key={recent}
                    type="button"
                    onClick={() => openSearch(recent)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/50"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{recent}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">No recent searches yet.</p>
              )}

              <div className="mx-3 my-2 border-t border-border/70" />
              <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent visits
              </div>
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Contacts
              </div>
              {recentContacts.length > 0
                ? recentContacts.map((contact) => (
                    <RecentContactMenuItem
                      key={contact.id}
                      contact={contact}
                      onSelect={() => navigateTo(`/contacts/${contact.id}`)}
                    />
                  ))
                : <p className="px-3 py-2 text-xs text-muted-foreground">No recent contact visits.</p>}

              <div className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Companies
              </div>
              {recentCompanies.length > 0
                ? recentCompanies.map((company) => {
                    const companyScore = topBuyers.find((buyer) => buyer.id === company.id)?.score;
                    return (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => navigateTo(`/companies/${company.id}`)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber-100 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10">
                          <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{company.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {company.industry || "Company"} · {formatRelative(new Date(company.visitedAt).toISOString())}
                          </span>
                        </span>
                        <OverallScorePill score={companyScore} />
                      </button>
                    );
                  })
                : <p className="px-3 py-2 text-xs text-muted-foreground">No recent company visits.</p>}
            </div>
          ) : isLoading ? (
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
                          <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100 flex items-center justify-center font-bold text-xs flex-shrink-0">
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
  if (!focusMode) return searchContent;
  return <Dialog open onOpenChange={next => { if (!next) closeSearch(); }}>
    <DialogContent id="global-search-focus-dialog" data-testid="global-search-focus-dialog"
      overlayClassName="z-[200] bg-black/50 backdrop-blur-sm"
      className="z-[210] max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl p-5"
      onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        requestAnimationFrame(() => {
          suppressFocusOpen.current = true;
          inputRef.current?.focus();
          suppressFocusOpen.current = false;
        });
      }}>
      <DialogHeader className="pr-6 text-left">
        <DialogTitle>Search</DialogTitle>
        <DialogDescription>Find contacts and companies, or return to a recent visit.</DialogDescription>
      </DialogHeader>
      {searchContent}
    </DialogContent>
  </Dialog>;
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
              ? "bg-[#E0BBA8] text-[#5C2E22] dark:bg-[#5a2c1d] dark:text-[#edd4c6]"
              : "text-[#7C3E2A] hover:bg-[#EDD4C6] hover:text-[#5C2E22] dark:text-[#e8c9b8] dark:hover:bg-[#3d1c12] dark:hover:text-[#edd4c6]"
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
          "flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[10px] font-semibold transition-all select-none cursor-pointer",
          wartime
            ? isActive
              ? "bg-[#7C3E2A] text-[#F4E2D8] border-[#7C3E2A] dark:bg-[#e8c9b8] dark:text-[#3d1c12] dark:border-[#e8c9b8]"
              : "bg-[#E8C4B0] text-[#7C3E2A] border-[#DDB99E] hover:bg-[#E0BBA8] hover:text-[#5C2E22] dark:bg-[#3d1c12] dark:text-[#e8c9b8] dark:border-[#5a2c1d] dark:hover:bg-[#5a2c1d] dark:hover:text-[#edd4c6]"
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
  const { theme, resolvedTheme, setTheme } = useTheme();
  const darkTheme = resolvedTheme === "dark";
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
          <img src={darkTheme ? darkLogoUrl : lightLogoUrl} alt="Whyhello" />
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
                        <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100 flex items-center justify-center font-bold text-xs flex-shrink-0">
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

            <div className="px-4 py-2.5 flex items-center justify-between hover:bg-secondary/40 transition-colors">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {theme === "system" ? <Monitor className="h-4 w-4 flex-shrink-0" /> : darkTheme ? <Moon className="h-4 w-4 flex-shrink-0" /> : <Sun className="h-4 w-4 flex-shrink-0" />}
                <span>Theme</span>
              </div>
              <button
                data-testid="button-theme-menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setTheme(nextTheme(theme));
                }}
                className="flex items-center justify-center p-1 rounded-md bg-secondary/80 text-foreground border border-border/50 hover:bg-secondary transition-colors"
                aria-label={`Theme: ${themeLabel(theme)}. Change theme`}
              >
                <span className="text-[10px] font-semibold px-1 uppercase">{themeLabel(theme)}</span>
              </button>
            </div>
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

const directoryItems = [
  { label: "People", href: "/directory/people", icon: Users },
  { label: "Companies", href: "/directory/companies", icon: Building2 },
];

function MasterSidebar({ wartime, onOpenSearch }: { wartime: boolean; onOpenSearch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [location] = useLocation();
  useEffect(() => {
    setExpanded(false);
    setDirectoryOpen(false);
  }, [location]);
  const { user } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { theme, resolvedTheme, setTheme } = useTheme();
  const darkTheme = resolvedTheme === "dark";
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.primaryEmailAddress?.emailAddress ?? "Account";
  const isMaster = user?.primaryEmailAddress?.emailAddress === MASTER_EMAIL;
  const moreItems = isMaster ? [...baseMoreItems, ...masterMoreItems] : baseMoreItems;
  const isRouteActive = (href: string) =>
    href === "/" ? location === "/" || location === "" : location.startsWith(href);

  const navItems = [
    { label: "Home", href: "/", icon: House },
    { label: "Directory", href: "/directory", icon: Users },
    { label: "Message Center", href: "/messages", icon: MessageSquare },
    { label: "Playbooks", href: "/playbooks", icon: PlaybookIcon },
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
      onMouseLeave={() => { setExpanded(false); setDirectoryOpen(false); }}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={handleBlur}
      onClickCapture={(event) => {
        if ((event.target as Element).closest("a[href]")) {
          setExpanded(false);
          setDirectoryOpen(false);
        }
      }}
    >
      <div className="master-sidebar-inner">
        <SidebarBrandRow expanded={expanded} darkTheme={darkTheme} wartime={wartime}
          onSearch={() => { setExpanded(false); setDirectoryOpen(false); onOpenSearch(); }} />

        <nav className="master-route-nav" aria-label="Primary">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = isRouteActive(href);
            if (href === "/directory") {
              return (
                <div
                  key={href}
                  className="master-directory-group"
                  onMouseEnter={() => setDirectoryOpen(true)}
                  onMouseLeave={() => setDirectoryOpen(false)}
                  onFocusCapture={() => setDirectoryOpen(true)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDirectoryOpen(false);
                  }}
                >
                  <Link
                    href="/directory/people"
                    className={cn("master-route", active && "is-active")}
                    aria-label="Directory"
                    aria-expanded={expanded && directoryOpen}
                    aria-controls="directory-submenu"
                    title={!expanded ? label : undefined}
                  >
                    <Icon size={18} strokeWidth={active ? 2.3 : 1.85} />
                    <span>{label}</span>
                    {expanded && <i className="master-directory-caret"><ChevronDown size={15} aria-hidden="true" /></i>}
                  </Link>
                  {expanded && directoryOpen && (
                    <div id="directory-submenu" className="master-directory-submenu">
                      {directoryItems.map(({ label: childLabel, href: childHref, icon: ChildIcon }) => (
                        <Link
                          key={childHref}
                          href={childHref}
                          className={cn("master-route master-directory-child", location === childHref && "is-active")}
                          aria-current={location === childHref ? "page" : undefined}
                        >
                          <ChildIcon size={16} strokeWidth={1.85} />
                          <span>{childLabel}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
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
          <button
            onClick={() => setTheme(nextTheme(theme))}
            data-testid="button-theme-desktop"
            className="master-route"
            title={!expanded ? `Theme: ${themeLabel(theme)}` : undefined}
            aria-label={`Theme: ${themeLabel(theme)}. Change theme`}
          >
            {theme === "system" ? <Monitor size={18} /> : darkTheme ? <Moon size={18} /> : <Sun size={18} />}
            <span>{themeLabel(theme)} Theme</span>
          </button>
          <Link href="/settings" className="master-route" aria-label="Settings" title={!expanded ? "Settings" : undefined}>
            <Settings size={18} />
            <span>Settings</span>
          </Link>
          <div className="master-user-row">
            <Link href="/profile" className="master-route master-user-route" aria-label={`${displayName} profile`} title={!expanded ? displayName : undefined}>
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="master-user-avatar" />
              ) : (
                <i className="master-user-avatar master-user-initials">{getInitials(displayName)}</i>
              )}
              <span>{displayName}</span>
            </Link>
            {expanded && (
              <button
                type="button"
                className="master-logout-button"
                data-testid="button-sidebar-signout"
                aria-label="Sign out"
                onClick={() => void signOut({ redirectUrl: basePath || "/" })}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Main Navbar ──────────────────────────────────────────────────────────────

export function Navbar() {
  const [searchFocusMode, setSearchFocusMode] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { mode } = useAppMode();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const darkTheme = resolvedTheme === "dark";
  const wartime = mode === "wartime";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(location.startsWith("/directory"));
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navItems = [
    { label: "Home",            href: "/",               icon: House    },
    { label: "Directory",       href: "/directory",      icon: Users    },
    { label: "Message Center",  href: "/messages",       icon: Bell     },
    { label: "Playbooks",       href: "/playbooks",      icon: PlaybookIcon },
    { label: "Multi-threading", href: "/multithreading", icon: Zap      },
  ];

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.primaryEmailAddress?.emailAddress ?? "Account";

  const isMaster = user?.primaryEmailAddress?.emailAddress === MASTER_EMAIL;
  const moreItems = isMaster ? [...baseMoreItems, ...masterMoreItems] : baseMoreItems;
  const allMobileItems = [...navItems, ...moreItems];

  function closeMobile() {
    setMobileOpen(false);
    setMobileDirectoryOpen(false);
  }

  return (
    <>
      <MasterSidebar wartime={wartime} onOpenSearch={() => setSearchFocusMode(true)} />
      <header
        className={cn(
        "sticky top-0 z-40 w-full md:ml-[42px] md:w-[calc(100%-42px)] border-b transition-colors duration-300",
        wartime
          ? "border-[#e8c9b8] bg-[#F4E2D8] dark:border-[#5a2c1d] dark:bg-[#3d1c12]"
          : "border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        )}
      >
      {/* ── Desktop bar (md+) — navigation left, utilities right ── */}
      <div className="hidden h-11 w-full grid-cols-[minmax(0,1fr)_minmax(360px,560px)_minmax(0,1fr)] items-center gap-[18px] px-[18px] pl-[18px] md:grid">
        <div />
        <GlobalSearch wartime={wartime} focusMode={searchFocusMode} onCloseFocusMode={() => setSearchFocusMode(false)} />
        <div className="flex min-w-0 items-center justify-end gap-3">
          <CreditTracker wartime={wartime} />
          <HQPill wartime={wartime} />
        </div>
      </div>

      {/* ── Mobile bar (< md) ── */}
      <div className="md:hidden flex items-center px-4 h-14 gap-2">
        {/* W logo mark */}
        <Link
          href="/"
          aria-label="Go to Home"
          onClick={() => setMobileOpen(false)}
          className="-ml-1 flex size-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="overflow-hidden" style={{ width: 36, height: 24 }}>
            <img src={darkTheme ? darkLogoUrl : lightLogoUrl} alt="Whyhello" className="h-6 w-auto max-w-none" />
          </div>
        </Link>

        <div className="flex-1" />

        {/* HQ pill */}
        <HQPill wartime={wartime} />

        {/* Hamburger / close */}
        <button
          onClick={() => setMobileOpen(v => !v)}
          className={cn(
            "p-2 -mr-1 rounded-lg transition-colors flex-shrink-0",
            wartime ? "text-[#7C3E2A] hover:bg-[#EDD4C6] dark:text-[#edd4c6] dark:hover:bg-[#5a2c1d]" : "text-foreground hover:bg-secondary/40",
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
            wartime ? "border-[#e8c9b8] bg-[#F4E2D8] dark:border-[#5a2c1d] dark:bg-[#3d1c12]" : "border-border bg-background",
          )}
        >
          {/* Nav + more items */}
          <nav className="px-3 pt-3 pb-1 flex flex-col gap-0.5">
            {allMobileItems.map(({ label, href, icon: Icon }) => {
              const isActive = href === "/"
                ? location === "/" || location === ""
                : location.startsWith(href);
              const itemClassName = cn(
                "flex w-full items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors text-left",
                wartime
                  ? isActive ? "bg-[#E0BBA8] text-[#5C2E22] dark:bg-[#5a2c1d] dark:text-[#edd4c6]" : "text-[#7C3E2A] hover:bg-[#EDD4C6]/60 dark:text-[#e8c9b8] dark:hover:bg-[#5a2c1d]"
                  : isActive ? "bg-secondary/60 text-foreground" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
              );
              if (href === "/directory") {
                return (
                  <div key={href}>
                    <button
                      type="button"
                      onClick={() => setMobileDirectoryOpen((open) => !open)}
                      className={itemClassName}
                      aria-expanded={mobileDirectoryOpen}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
                      <span className="flex-1">Directory</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", mobileDirectoryOpen && "rotate-180")} />
                    </button>
                    {mobileDirectoryOpen && (
                      <div className="ml-6 flex flex-col gap-0.5 border-l border-border pl-3 py-1">
                        {directoryItems.map(({ label: childLabel, href: childHref, icon: ChildIcon }) => (
                          <Link
                            key={childHref}
                            href={childHref}
                            onClick={closeMobile}
                            aria-current={location === childHref ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                              location === childHref ? "bg-secondary/60 text-foreground" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
                            )}
                          >
                            <ChildIcon className="h-4 w-4" />
                            {childLabel}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobile}
                  className={itemClassName}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className={cn("h-px mx-4 my-2", wartime ? "bg-[#e8c9b8] dark:bg-[#5a2c1d]" : "bg-border/60")} />

          {/* Profile row */}
          <Link
            href="/profile"
            onClick={closeMobile}
            className={cn(
              "flex items-center gap-3 mx-3 px-3 py-3 my-1 rounded-xl transition-colors",
              wartime ? "hover:bg-[#EDD4C6]/60 dark:hover:bg-[#5a2c1d]/60" : "hover:bg-secondary/30",
            )}
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className={cn("h-9 w-9 rounded-full object-cover border flex-shrink-0", wartime ? "border-[#DDB99E] dark:border-[#5a2c1d]" : "border-border")} />
            ) : (
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm border flex-shrink-0", wartime ? "bg-[#EDD4C6] text-[#7C3E2A] border-[#DDB99E] dark:bg-[#5a2c1d] dark:text-[#edd4c6] dark:border-[#7c3e2a]" : "bg-primary/10 text-primary border-primary/20")}>
                {getInitials(displayName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold truncate", wartime ? "text-[#5C2E22] dark:text-[#f4e2d8]" : "text-foreground")}>{displayName}</p>
              <p className="text-xs text-muted-foreground">Profile &amp; settings</p>
            </div>
            <CreditTracker wartime={wartime} />
          </Link>

          <div className={cn("h-px mx-4 my-2", wartime ? "bg-[#e8c9b8] dark:bg-[#5a2c1d]" : "bg-border/60")} />

          <div className="px-3">
            <button
              type="button"
              onClick={() => setTheme(nextTheme(theme))}
              data-testid="button-theme-mobile"
              aria-label={`Theme: ${themeLabel(theme)}. Change theme`}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-left transition-colors",
                wartime ? "text-[#7C3E2A] hover:bg-[#EDD4C6]/60 dark:text-[#e8c9b8] dark:hover:bg-[#5a2c1d]/60" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
              )}
            >
              {theme === "system" ? <Monitor className="h-4 w-4 flex-shrink-0" /> : darkTheme ? <Moon className="h-4 w-4 flex-shrink-0" /> : <Sun className="h-4 w-4 flex-shrink-0" />}
              <span className="flex-1">Theme</span>
              <span className="text-xs font-semibold uppercase tracking-wide">{themeLabel(theme)}</span>
            </button>
          </div>

          <div className={cn("h-px mx-4 my-2", wartime ? "bg-[#e8c9b8] dark:bg-[#5a2c1d]" : "bg-border/60")} />

          {/* Sign out */}
          <div className="px-3 pb-4">
            <button
              onClick={() => { closeMobile(); signOut({ redirectUrl: basePath || "/" }); }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-left transition-colors",
                wartime ? "text-[#7C3E2A] hover:bg-[#EDD4C6]/60 dark:text-[#e8c9b8] dark:hover:bg-[#5a2c1d]/60" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
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
