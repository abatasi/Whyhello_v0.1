import { apiFetch } from "@/lib/apiFetch";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, Bell, LogOut, Download, Users, Building2, Zap, X, Loader2,
  Mail, Settings, ShieldCheck, Flame, ChevronDown, MoreHorizontal,
  Factory, Briefcase, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUser, useClerk } from "@clerk/react";
import whyhelloLogo from "@assets/Untitled_design_1773415520137.png";
import { cn, getInitials } from "@/lib/utils";
import { useListExports, downloadExportFile, useCreditsStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAppMode } from "@/contexts/AppModeContext";

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
    ? "text-red-100 bg-red-800/60 border-red-700/60"
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
          wartime && "text-red-100 hover:bg-red-800/60 hover:text-white",
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
          ? "bg-red-800/50 border-red-700/60 text-white"
          : "bg-secondary/50 border-border",
      )}>
        <Search className={cn("h-4 w-4 flex-shrink-0", wartime ? "text-red-300" : "text-muted-foreground")} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search contacts & companies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(
            "flex-1 bg-transparent text-sm outline-none min-w-0",
            wartime ? "placeholder:text-red-300/70 text-white" : "placeholder:text-muted-foreground",
          )}
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            className={cn(
              "transition-colors flex-shrink-0",
              wartime ? "text-red-300 hover:text-white" : "text-muted-foreground hover:text-foreground",
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
              wartime ? "text-red-300 hover:text-white" : "text-muted-foreground hover:text-foreground",
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

// ── More dropdown (Industries, Roles, Import) ────────────────────────────────

const moreItems = [
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
              ? "bg-red-800 text-white"
              : "text-red-100 hover:bg-red-800/60 hover:text-white"
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

// ── Mode toggle ──────────────────────────────────────────────────────────────

function ModeToggle({ wartime }: { wartime: boolean }) {
  const { toggleMode } = useAppMode();

  if (wartime) {
    return (
      <button
        onClick={toggleMode}
        title="Switch to Peacetime mode"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all select-none",
          "bg-red-700/80 text-red-100 border border-red-600/60",
          "hover:bg-red-700 hover:text-white",
        )}
      >
        <Flame className="h-3.5 w-3.5" />
        Wartime
      </button>
    );
  }

  return (
    <button
      onClick={toggleMode}
      title="Switch to Wartime mode"
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all select-none",
        "bg-transparent text-muted-foreground border border-border/60",
        "hover:border-border hover:text-foreground",
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Peacetime
    </button>
  );
}

// ── Main Navbar ──────────────────────────────────────────────────────────────

export function Navbar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [location] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { data: exports } = useListExports();
  const hasExports = (exports?.length ?? 0) > 0;
  const { mode } = useAppMode();
  const wartime = mode === "wartime";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  // Industries, Roles, Import moved into the "More" dropdown
  const navItems = [
    { label: "Directory", href: "/" },
    { label: "Lists", href: "/lists" },
    { label: "Message Center", href: "/messages" },
    { label: "Sequences", href: "/sequences" },
    { label: "HQ", href: "/hq" },
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
          ? "border-red-800 bg-red-900"
          : "border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      )}
    >
      <div className="w-full px-6 xl:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            {/* Circular boundary always carries the peacetime background so the
                logo renders identically in both modes. In peacetime the circle
                is invisible (same color as the bar); in wartime it floats as a
                neutral bubble against the red fill. */}
            <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center flex-shrink-0">
              <img src={whyhelloLogo} alt="Whyhello" className="h-6 w-auto" />
            </div>
          </Link>

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
                    "px-4 py-2 rounded-lg transition-colors",
                    wartime
                      ? isActive
                        ? "bg-red-800 text-white"
                        : "text-red-100 hover:bg-red-800/60 hover:text-white"
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

        <div className="flex items-center gap-2">
          <ModeToggle wartime={wartime} />

          <div className={cn("h-4 w-px mx-1", wartime ? "bg-red-700/60" : "bg-border")} />

          <CreditTracker wartime={wartime} />

          <GlobalSearch wartime={wartime} />

          <div ref={notifRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full relative",
                wartime && "text-red-100 hover:bg-red-800/60 hover:text-white",
              )}
              onClick={() => setNotifOpen((o) => !o)}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {hasExports && (
                <span className={cn(
                  "absolute top-1.5 right-1.5 h-2 w-2 rounded-full",
                  wartime ? "bg-red-300" : "bg-primary",
                )} />
              )}
            </Button>
            {notifOpen && <NotificationsDropdown onClose={() => setNotifOpen(false)} />}
          </div>

          <div className={cn("h-8 w-px mx-2", wartime ? "bg-red-800" : "bg-border")} />

          <div className="flex items-center gap-2">
            <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className={cn(
                    "h-7 w-7 rounded-full object-cover border",
                    wartime ? "border-red-700" : "border-border",
                  )}
                />
              ) : (
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center font-semibold text-xs border",
                  wartime
                    ? "bg-red-800/60 text-red-100 border-red-700"
                    : "bg-primary/10 text-primary border-primary/20",
                )}>
                  {getInitials(displayName)}
                </div>
              )}
              <span className={cn(
                "text-sm font-medium hidden md:block",
                wartime ? "text-red-100" : "",
              )}>
                {displayName}
              </span>
            </Link>
            <Link href="/settings">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  wartime
                    ? "text-red-300 hover:bg-red-800/60 hover:text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full ml-1",
                wartime
                  ? "text-red-300 hover:bg-red-800/60 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
