import { apiFetch } from "@/lib/apiFetch";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, Bell, LogOut, Download, Users, Building2, Zap, X, Loader2,
  Settings, ShieldCheck, Flame, ChevronDown, Clock,
  Factory, Briefcase, Upload, Gauge, List,
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

// ── More dropdown (Lists, Industries, Roles, Import) ─────────────────────────

const moreItems = [
  { label: "Lists", href: "/lists", icon: List },
  { label: "Industries", href: "/industries", icon: Factory },
  { label: "Roles", href: "/roles", icon: Briefcase },
  { label: "Import", href: "/import", icon: Upload },
];

function MoreDropdown({ wartime }: { wartime: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

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

function LogoMenu({ wartime }: { wartime: boolean }) {
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
      className="relative self-stretch flex items-center -ml-6 xl:-ml-8 flex-shrink-0"
    >
      {/* Logo trigger */}
      <button
        onClick={() => { setOpen((o) => !o); setNotifExpanded(false); }}
        className={cn(
          "h-full pl-6 xl:pl-8 pr-4 flex items-center transition-colors",
          wartime
            ? "bg-transparent"
            : open
            ? "bg-secondary/50"
            : "bg-background hover:bg-secondary/20",
        )}
        aria-label="Open app menu"
      >
        {/* Crop the combined logo PNG to just the W mark (clip right side to hide wordmark) */}
        <div className="overflow-hidden flex-shrink-0" style={{ width: 36, height: 24 }}>
          <img src={whyhelloLogo} alt="Whyhello" className="h-6 w-auto max-w-none" />
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

// ── Main Navbar ──────────────────────────────────────────────────────────────

export function Navbar() {
  const { user } = useUser();
  const [location] = useLocation();
  const { mode } = useAppMode();
  const wartime = mode === "wartime";

  // Lists, Industries, Roles, Import live in "More"; HQ is centered
  const navItems = [
    { label: "Directory", href: "/" },
    { label: "Message Center", href: "/messages" },
    { label: "Playbooks", href: "/playbooks" },
    { label: "Multi-threading", href: "/multithreading" },
  ];

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.primaryEmailAddress?.emailAddress ?? "Account";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        wartime
          ? "border-[#e8c9b8] bg-[#F4E2D8]"
          : "border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      )}
    >
      {/* 3-column grid: left = logo + nav, center = HQ pill, right = utilities */}
      <div className="w-full px-6 xl:px-8 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-4">

        {/* ── Left: logo menu + nav ── */}
        <div className="flex items-center gap-4 min-w-0">
          <LogoMenu wartime={wartime} />

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = item.href === "/"
                ? location === "/" || location === ""
                : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-lg transition-colors whitespace-nowrap",
                    wartime
                      ? isActive
                        ? "bg-[#E0BBA8] text-[#5C2E22]"
                        : "text-[#7C3E2A] hover:bg-[#EDD4C6] hover:text-[#5C2E22]"
                      : isActive
                      ? "bg-secondary/50 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <MoreDropdown wartime={wartime} />
          </nav>
        </div>

        {/* ── Center: HQ pill ── */}
        <HQPill wartime={wartime} />

        {/* ── Right: utilities ── */}
        <div className="flex items-center gap-2 justify-end">
          <CreditTracker wartime={wartime} />

          <GlobalSearch wartime={wartime} />

          <div className={cn("h-8 w-px mx-1", wartime ? "bg-[#E0BBA8]" : "bg-border")} />

          <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt="Profile"
                className={cn(
                  "h-7 w-7 rounded-full object-cover border",
                  wartime ? "border-[#DDB99E]" : "border-border",
                )}
              />
            ) : (
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center font-semibold text-xs border",
                wartime
                  ? "bg-[#EDD4C6] text-[#7C3E2A] border-[#DDB99E]"
                  : "bg-primary/10 text-primary border-primary/20",
              )}>
                {getInitials(displayName)}
              </div>
            )}
            <span className={cn(
              "text-sm font-medium hidden md:block",
              wartime ? "text-[#7C3E2A]" : "",
            )}>
              {displayName}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
