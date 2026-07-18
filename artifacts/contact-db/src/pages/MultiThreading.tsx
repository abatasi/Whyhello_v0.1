import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";
import {
  Megaphone, Wallet, Vote, Crown, Briefcase, Cpu, ShieldCheck,
  ShoppingCart, Scale, Calculator, User, Wrench, MessageCircle, Ban, GraduationCap,
  Building2, X, ExternalLink, Mail, Phone, MapPin, Linkedin,
  ChevronRight, Loader2, GitBranch, Users, ChevronDown, AlertCircle,
  Dna, Check, ListTree,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  seniority: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  country: string | null;
  linkedinUrl: string | null;
  companyId: number | null;
  companyName: string | null;
  companyIndustry: string | null;
  companySize: string | null;
}

interface Company {
  id: number;
  name: string;
  industry: string | null;
  size: string | null;
  location: string | null;
  website: string | null;
  description: string | null;
  contacts: Contact[];
}

interface BuyingCenterSeat {
  seat: string;
  seniorities: string[];
  departments: string[];
}

interface BuyingCenterConfig {
  id: string;
  name: string;
  seats: BuyingCenterSeat[];
}

interface CompanyResult {
  id: number;
  name: string;
  industry: string | null;
  size: string | null;
  location: string | null;
}

// ── Seat definitions (mirrors DNA.tsx) ───────────────────────────────────────

const BUYING_CENTER_SEATS: {
  seat: string; role: string; icon: React.ElementType; color: string;
}[] = [
  { seat: "Business Champion",               role: "Promotes the solution internally",         icon: Megaphone,     color: "violet"  },
  { seat: "Economic Buyer",                  role: "Controls or authorizes the budget",        icon: Wallet,        color: "emerald" },
  { seat: "Decision Maker",                  role: "Makes the final selection",                icon: Vote,          color: "violet"  },
  { seat: "Executive Sponsor",               role: "Connects to executive priorities",         icon: Crown,         color: "violet"  },
  { seat: "Business Owner",                  role: "Owns the business problem",               icon: Briefcase,     color: "amber"   },
  { seat: "Technical Buyer",                 role: "Evaluates architecture & integrations",    icon: Cpu,           color: "blue"    },
  { seat: "Security or Compliance Reviewer", role: "Assesses security & regulatory risk",     icon: ShieldCheck,   color: "slate"   },
  { seat: "Procurement",                     role: "Manages commercial & purchasing",          icon: ShoppingCart,  color: "emerald" },
  { seat: "Legal",                           role: "Reviews contractual obligations",          icon: Scale,         color: "slate"   },
  { seat: "Finance",                         role: "Validates costs, ROI & budget",            icon: Calculator,    color: "emerald" },
  { seat: "End User",                        role: "Uses the product day-to-day",              icon: User,          color: "sky"     },
  { seat: "Implementer",                     role: "Owns deployment & configuration",          icon: Wrench,        color: "blue"    },
  { seat: "Influencer",                      role: "Shapes requirements & opinions",           icon: MessageCircle, color: "sky"     },
  { seat: "Blocker",                         role: "Can delay or oppose the purchase",         icon: Ban,           color: "rose"    },
  { seat: "Coach",                           role: "Helps the seller understand the account",  icon: GraduationCap, color: "amber"   },
];

const COLOR_MAP: Record<string, {
  bg: string; border: string; borderL: string; iconBg: string; iconColor: string;
  chipBg: string; chipText: string; activeBg: string;
}> = {
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  borderL: "border-l-violet-400",  iconBg: "bg-violet-100",  iconColor: "text-violet-600",  chipBg: "bg-violet-100",  chipText: "text-violet-700",  activeBg: "bg-violet-50/80"  },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", borderL: "border-l-emerald-400", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", chipBg: "bg-emerald-100", chipText: "text-emerald-700", activeBg: "bg-emerald-50/80" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    borderL: "border-l-blue-400",    iconBg: "bg-blue-100",    iconColor: "text-blue-600",    chipBg: "bg-blue-100",    chipText: "text-blue-700",    activeBg: "bg-blue-50/80"    },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   borderL: "border-l-amber-400",   iconBg: "bg-amber-100",   iconColor: "text-amber-600",   chipBg: "bg-amber-100",   chipText: "text-amber-700",   activeBg: "bg-amber-50/80"   },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   borderL: "border-l-slate-400",   iconBg: "bg-slate-100",   iconColor: "text-slate-500",   chipBg: "bg-slate-100",   chipText: "text-slate-600",   activeBg: "bg-slate-50/80"   },
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     borderL: "border-l-sky-400",     iconBg: "bg-sky-100",     iconColor: "text-sky-600",     chipBg: "bg-sky-100",     chipText: "text-sky-700",     activeBg: "bg-sky-50/80"     },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    borderL: "border-l-rose-400",    iconBg: "bg-rose-100",    iconColor: "text-rose-600",    chipBg: "bg-rose-100",    chipText: "text-rose-600",    activeBg: "bg-rose-50/80"    },
};

// ── Seniority ranking ─────────────────────────────────────────────────────────

const SENIORITY_RANK: Record<string, number> = {
  "C-Suite": 5, "VP": 4, "Director": 3, "Manager": 2, "Individual Contributor": 1,
};

// ── Matching logic ────────────────────────────────────────────────────────────

function sortBySeniority(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) =>
    (SENIORITY_RANK[b.seniority ?? ""] ?? 0) - (SENIORITY_RANK[a.seniority ?? ""] ?? 0)
  );
}

function matchContactsToSeat(seat: BuyingCenterSeat, contacts: Contact[]): Contact[] {
  const hasSeniority = seat.seniorities.length > 0;
  const hasDept = seat.departments.length > 0;
  if (!hasSeniority && !hasDept) return [];

  const strict = contacts.filter(c => {
    const senOk = !hasSeniority || seat.seniorities.includes(c.seniority ?? "");
    const deptOk = !hasDept || seat.departments.includes(c.department ?? "");
    return senOk && deptOk;
  });
  if (strict.length > 0) return sortBySeniority(strict);

  const relaxed = contacts.filter(c =>
    seat.seniorities.includes(c.seniority ?? "") ||
    seat.departments.includes(c.department ?? "")
  );
  return sortBySeniority(relaxed);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(first: string, last: string): string {
  return `${(first[0] ?? "").toUpperCase()}${(last[0] ?? "").toUpperCase()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SenioritySwatch({ value }: { value: string }) {
  const colors: Record<string, string> = {
    "C-Suite": "bg-violet-100 text-violet-700 border-violet-200",
    "VP": "bg-blue-100 text-blue-700 border-blue-200",
    "Director": "bg-sky-100 text-sky-700 border-sky-200",
    "Manager": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Individual Contributor": "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", colors[value] ?? "bg-secondary text-muted-foreground border-border")}>
      {value}
    </span>
  );
}

function ContactAvatar({ contact, size = "md" }: { contact: Contact; size?: "sm" | "md" | "lg" }) {
  const initials = getInitials(contact.firstName, contact.lastName);
  const colors = [
    "from-violet-200 to-violet-100 text-violet-700",
    "from-blue-200 to-blue-100 text-blue-700",
    "from-emerald-200 to-emerald-100 text-emerald-700",
    "from-amber-200 to-amber-100 text-amber-700",
    "from-sky-200 to-sky-100 text-sky-700",
    "from-rose-200 to-rose-100 text-rose-700",
  ];
  const color = colors[(contact.id ?? 0) % colors.length];
  const sizeClass = size === "lg" ? "h-16 w-16 text-xl" : size === "md" ? "h-12 w-12 text-sm" : "h-8 w-8 text-xs";
  return (
    <div className={cn("rounded-full bg-gradient-to-br flex items-center justify-center font-bold flex-shrink-0", sizeClass, color)}>
      {initials}
    </div>
  );
}

// Buying center selector dropdown
function BuyingCenterSelector({
  buyingCenters,
  selectedId,
  onSelect,
}: {
  buyingCenters: BuyingCenterConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = buyingCenters.find(bc => bc.id === selectedId) ?? buyingCenters[0];

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (buyingCenters.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200">
        <ListTree className="h-3 w-3 text-indigo-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-indigo-700 truncate">{selected?.name ?? "Default"}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors text-left"
      >
        <ListTree className="h-3 w-3 text-indigo-500 flex-shrink-0" />
        <span className="flex-1 text-xs font-semibold text-indigo-700 truncate">{selected?.name ?? "Default"}</span>
        <ChevronDown className={cn("h-3 w-3 text-indigo-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-secondary/20">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Buying center</p>
          </div>
          {buyingCenters.map(bc => {
            const configuredCount = bc.seats.filter(s => s.seniorities.length > 0 || s.departments.length > 0).length;
            return (
              <button
                key={bc.id}
                onClick={() => { onSelect(bc.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{bc.name}</p>
                  <p className="text-[10px] text-muted-foreground">{configuredCount} seat{configuredCount !== 1 ? "s" : ""} configured</p>
                </div>
                {bc.id === selectedId && <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Switch contact popover
function SwitchContactButton({
  matches,
  selectedId,
  onSelect,
}: {
  matches: Contact[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (matches.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all"
      >
        <Users className="h-3 w-3" />
        {matches.length - 1} other match{matches.length - 1 !== 1 ? "es" : ""}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/60 bg-secondary/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Switch contact for this seat</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {matches.map(c => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 text-left transition-colors"
              >
                <ContactAvatar contact={c} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.jobTitle ?? "—"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {c.seniority && <span className="text-[9px] font-semibold bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5">{c.seniority}</span>}
                  {c.id === selectedId && <Check className="h-3 w-3 text-emerald-600" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MultiThreading() {
  const [buyingCenters, setBuyingCenters] = useState<BuyingCenterConfig[]>([]);
  const [selectedBcId, setSelectedBcId] = useState<string>("");
  const [dnaLoaded, setDnaLoaded] = useState(false);

  const [companySearch, setCompanySearch] = useState("");
  const [searchResults, setSearchResults] = useState<CompanyResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [activeSeat, setActiveSeat] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  // ── Derived active BC ──
  const activeBc = buyingCenters.find(bc => bc.id === selectedBcId) ?? buyingCenters[0] ?? null;

  // Only seats that have at least one criterion configured
  const configuredSeatDefs = BUYING_CENTER_SEATS.filter(def => {
    const seat = activeBc?.seats.find(s => s.seat === def.seat);
    return seat && (seat.seniorities.length > 0 || seat.departments.length > 0);
  });

  // ── Load DNA buying centers ──
  useEffect(() => {
    fetch("/api/dna/profile")
      .then(r => r.ok ? r.json() : null)
      .then((json: {
        data?: {
          buyingCenters?: BuyingCenterConfig[];
          buyingCenter?: BuyingCenterSeat[];
        };
      } | null) => {
        let bcs: BuyingCenterConfig[] = [];
        if (json?.data?.buyingCenters && json.data.buyingCenters.length > 0) {
          bcs = json.data.buyingCenters;
        } else if (json?.data?.buyingCenter) {
          bcs = [{ id: "default", name: "Default", seats: json.data.buyingCenter }];
        }
        if (bcs.length > 0) {
          setBuyingCenters(bcs);
          setSelectedBcId(bcs[0].id);
        }
        setDnaLoaded(true);
      })
      .catch(() => setDnaLoaded(true));
  }, []);

  // ── Company search (debounced) ──
  useEffect(() => {
    const q = companySearch.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/companies?search=${encodeURIComponent(q)}&limit=8`)
        .then(r => r.json())
        .then((json: { data: CompanyResult[] }) => setSearchResults(json.data ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [companySearch]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Select a company ──
  function selectCompany(c: CompanyResult) {
    setCompanySearch(c.name);
    setSearchResults([]);
    setActiveSeat(null);
    setOverrides({});
    setSelectedCompany(null);
    setCompanyLoading(true);
    fetch(`/api/companies/${c.id}`)
      .then(r => r.json())
      .then((data: Company) => setSelectedCompany(data))
      .catch(() => {})
      .finally(() => setCompanyLoading(false));
  }

  function clearCompany() {
    setCompanySearch("");
    setSearchResults([]);
    setSelectedCompany(null);
    setActiveSeat(null);
    setOverrides({});
  }

  // ── Matching helpers ──
  function getMatches(seatName: string): Contact[] {
    if (!selectedCompany || !activeBc) return [];
    const seat = activeBc.seats.find(s => s.seat === seatName);
    if (!seat) return [];
    return matchContactsToSeat(seat, selectedCompany.contacts);
  }

  function getActiveContact(seatName: string): Contact | null {
    const matches = getMatches(seatName);
    if (matches.length === 0) return null;
    const overrideId = overrides[seatName];
    if (overrideId) {
      const override = matches.find(c => c.id === overrideId);
      if (override) return override;
    }
    return matches[0];
  }

  // ── Derived active seat values ──
  const activeDef = activeSeat ? BUYING_CENTER_SEATS.find(s => s.seat === activeSeat) ?? null : null;
  const activeConfig = activeSeat && activeBc ? activeBc.seats.find(s => s.seat === activeSeat) ?? null : null;
  const activeContact = activeSeat ? getActiveContact(activeSeat) : null;
  const activeMatches = activeSeat ? getMatches(activeSeat) : [];
  const activeColors = activeDef ? (COLOR_MAP[activeDef.color] ?? COLOR_MAP.slate) : null;

  const allUnconfigured = dnaLoaded && buyingCenters.length === 0;
  const activeBcUnconfigured = dnaLoaded && activeBc !== null && configuredSeatDefs.length === 0;

  // ── Render ──
  return (
    <Shell>
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left panel ── */}
        <div className="w-80 flex-shrink-0 border-r border-border/60 bg-card flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/60 flex-shrink-0 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <GitBranch className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground leading-tight">Multi-threading</h1>
                <p className="text-[10px] text-muted-foreground">Buying center by company</p>
              </div>
            </div>

            {/* Buying center selector */}
            {dnaLoaded && buyingCenters.length > 0 && (
              <BuyingCenterSelector
                buyingCenters={buyingCenters}
                selectedId={selectedBcId}
                onSelect={id => { setSelectedBcId(id); setActiveSeat(null); setOverrides({}); }}
              />
            )}

            {/* Company search */}
            <div ref={searchRef} className="relative">
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                searchResults.length > 0 ? "border-primary/40 bg-primary/5" : "border-border/60 bg-secondary/30"
              )}>
                <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search for a company…"
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
                />
                {companyLoading && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin flex-shrink-0" />}
                {searchLoading && !companyLoading && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin flex-shrink-0" />}
                {companySearch && !companyLoading && (
                  <button onClick={clearCompany} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                  {searchResults.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => selectCompany(c)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 text-left transition-colors",
                        i > 0 && "border-t border-border/40"
                      )}
                    >
                      <div className="h-7 w-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{[c.industry, c.size, c.location].filter(Boolean).join(" · ")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Company badge once selected */}
            {selectedCompany && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <Building2 className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800 truncate">{selectedCompany.name}</p>
                  <p className="text-[10px] text-amber-600">{selectedCompany.contacts.length} contact{selectedCompany.contacts.length !== 1 ? "s" : ""} in database</p>
                </div>
              </div>
            )}
          </div>

          {/* Seat list — only configured seats */}
          <div className="flex-1 overflow-y-auto">

            {/* No DNA configured */}
            {dnaLoaded && allUnconfigured && (
              <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
                <Dna className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No buying centers configured yet.</p>
                <Link href="/dna">
                  <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">Set up in DNA →</span>
                </Link>
              </div>
            )}

            {/* BC exists but no seats configured */}
            {!allUnconfigured && activeBcUnconfigured && (
              <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
                <ListTree className="h-8 w-8 text-muted-foreground/30" />
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">No seats configured</p>
                  <p className="text-xs text-muted-foreground">"{activeBc?.name}" has no seats with seniority or department criteria.</p>
                </div>
                <Link href="/dna">
                  <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">Configure in DNA →</span>
                </Link>
              </div>
            )}

            {/* Seat list */}
            {configuredSeatDefs.map(def => {
              const colors = COLOR_MAP[def.color] ?? COLOR_MAP.slate;
              const matches = selectedCompany ? getMatches(def.seat) : [];
              const contact = selectedCompany ? getActiveContact(def.seat) : null;
              const isActive = activeSeat === def.seat;

              return (
                <button
                  key={def.seat}
                  onClick={() => setActiveSeat(def.seat)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-b border-border/30 last:border-0 border-l-2",
                    isActive
                      ? cn(colors.activeBg, colors.borderL)
                      : "border-l-transparent hover:bg-secondary/30"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 border mt-0.5",
                    isActive ? cn(colors.iconBg, colors.border) : "bg-secondary/50 border-border/50"
                  )}>
                    <def.icon className={cn("h-3.5 w-3.5", isActive ? colors.iconColor : "text-muted-foreground/70")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className={cn(
                        "text-xs font-semibold truncate",
                        isActive ? colors.iconColor : "text-foreground"
                      )}>
                        {def.seat}
                      </p>
                      {selectedCompany && matches.length > 1 && (
                        <span className="text-[9px] font-semibold bg-secondary rounded-full px-1.5 py-0.5 text-muted-foreground flex-shrink-0">
                          +{matches.length - 1}
                        </span>
                      )}
                    </div>

                    {contact ? (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {contact.firstName} {contact.lastName}
                        {contact.jobTitle ? ` · ${contact.jobTitle}` : ""}
                      </p>
                    ) : selectedCompany ? (
                      <p className="text-[11px] text-orange-500/80 font-medium">No match found</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/50">{def.role}</p>
                    )}
                  </div>

                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-[#F8FAFC]">

          {/* No company selected */}
          {!selectedCompany && !companyLoading && (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Select a company to get started</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Search for a company above to see how your{activeBc ? ` "${activeBc.name}" ` : " "}buying center maps to their team.
                </p>
              </div>
              {allUnconfigured && (
                <Link href="/dna">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer">
                    <Dna className="h-3.5 w-3.5" />
                    Configure your buying center in DNA
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Company loading */}
          {companyLoading && (
            <div className="h-full flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Loading company contacts…</p>
            </div>
          )}

          {/* Company loaded, no seat selected */}
          {selectedCompany && !activeSeat && (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <GitBranch className="h-8 w-8 text-primary/60" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  {selectedCompany.name} — {selectedCompany.contacts.length} contact{selectedCompany.contacts.length !== 1 ? "s" : ""} loaded
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {configuredSeatDefs.length === 0
                    ? `The "${activeBc?.name}" buying center has no configured seats yet.`
                    : `Select a seat from the left to see who fills that role at ${selectedCompany.name}.`
                  }
                </p>
              </div>

              {configuredSeatDefs.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center max-w-sm mt-2">
                  {configuredSeatDefs.map(def => {
                    const matches = getMatches(def.seat);
                    const colors = COLOR_MAP[def.color] ?? COLOR_MAP.slate;
                    return (
                      <button
                        key={def.seat}
                        onClick={() => setActiveSeat(def.seat)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all",
                          matches.length > 0
                            ? cn(colors.chipBg, colors.border, colors.chipText)
                            : "bg-orange-50 border-orange-200 text-orange-600"
                        )}
                      >
                        <def.icon className="h-3 w-3" />
                        {def.seat}
                        {matches.length > 0 && <span className="opacity-60">·{matches.length}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Seat selected, no match found */}
          {selectedCompany && activeSeat && activeMatches.length === 0 && activeDef && activeColors && (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center border", activeColors.iconBg, activeColors.border)}>
                <activeDef.icon className={cn("h-7 w-7", activeColors.iconColor)} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">No match at {selectedCompany.name}</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  No contacts match the criteria for the {activeSeat} seat.
                </p>
              </div>
              {activeConfig && (
                <div className="flex flex-col gap-1.5 items-start bg-card rounded-xl border border-border/60 p-4 text-left w-full max-w-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Criteria for {activeSeat}</p>
                  {activeConfig.seniorities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeConfig.seniorities.map(s => <SenioritySwatch key={s} value={s} />)}
                    </div>
                  )}
                  {activeConfig.departments.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeConfig.departments.map(d => (
                        <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-secondary text-muted-foreground border-border/60">{d}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                {selectedCompany.contacts.length} contact{selectedCompany.contacts.length !== 1 ? "s" : ""} at {selectedCompany.name} — none match
              </div>
            </div>
          )}

          {/* Contact found */}
          {selectedCompany && activeSeat && activeContact && activeDef && activeColors && (
            <div className="max-w-2xl mx-auto p-8 flex flex-col gap-6">

              {/* Contact header card */}
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className={cn("px-6 py-5 flex items-start gap-5 border-b border-border/40", activeColors.bg)}>
                  <ContactAvatar contact={activeContact} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-foreground leading-tight">
                          {activeContact.firstName} {activeContact.lastName}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">{activeContact.jobTitle ?? "—"}</p>
                      </div>
                      <Link href={`/contacts/${activeContact.id}`}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer flex-shrink-0 mt-0.5">
                          View profile
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {activeContact.seniority && <SenioritySwatch value={activeContact.seniority} />}
                      {activeContact.department && (
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", activeColors.chipBg, activeColors.border, activeColors.chipText)}>
                          {activeContact.department}
                        </span>
                      )}
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", activeColors.iconBg, activeColors.border, activeColors.iconColor)}>
                        <activeDef.icon className="h-2.5 w-2.5" />
                        {activeSeat}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact details */}
                <div className="px-6 py-4 grid grid-cols-2 gap-3">
                  {activeContact.email && (
                    <a href={`mailto:${activeContact.email}`} className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors group min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="truncate">{activeContact.email}</span>
                    </a>
                  )}
                  {activeContact.phone && (
                    <a href={`tel:${activeContact.phone}`} className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors group min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="truncate">{activeContact.phone}</span>
                    </a>
                  )}
                  {activeContact.location && (
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="truncate">{activeContact.location}</span>
                    </div>
                  )}
                  {activeContact.linkedinUrl && (
                    <a href={activeContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors group min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <Linkedin className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="truncate">LinkedIn</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary flex-shrink-0 transition-colors" />
                    </a>
                  )}
                  {!activeContact.email && !activeContact.phone && !activeContact.location && !activeContact.linkedinUrl && (
                    <p className="col-span-2 text-xs text-muted-foreground/50">No contact details available</p>
                  )}
                </div>
              </div>

              {/* Company mini-card */}
              {activeContact.companyName && (
                <Link href={`/companies/${activeContact.companyId}`}>
                  <div className="bg-card rounded-2xl border border-border/60 shadow-sm px-5 py-4 flex items-center gap-4 hover:border-border transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{activeContact.companyName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[activeContact.companyIndustry, activeContact.companySize].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                  </div>
                </Link>
              )}

              {/* Seat match card */}
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className={cn("px-5 py-3 border-b border-border/40 flex items-center justify-between", activeColors.bg)}>
                  <div className="flex items-center gap-2">
                    <activeDef.icon className={cn("h-4 w-4", activeColors.iconColor)} />
                    <p className="text-sm font-semibold text-foreground">Seat: {activeSeat}</p>
                    {activeBc && (
                      <span className="text-[10px] text-muted-foreground font-medium">· {activeBc.name}</span>
                    )}
                  </div>
                  <SwitchContactButton
                    matches={activeMatches}
                    selectedId={overrides[activeSeat] ?? activeMatches[0]?.id ?? -1}
                    onSelect={id => setOverrides(prev => ({ ...prev, [activeSeat!]: id }))}
                  />
                </div>
                <div className="px-5 py-4 flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground font-medium">Matching criteria defined in DNA</p>
                  <div className="flex flex-col gap-2">
                    {activeConfig && activeConfig.seniorities.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">Seniority</span>
                        <div className="flex flex-wrap gap-1">
                          {activeConfig.seniorities.map(s => <SenioritySwatch key={s} value={s} />)}
                        </div>
                      </div>
                    )}
                    {activeConfig && activeConfig.departments.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">Department</span>
                        <div className="flex flex-wrap gap-1">
                          {activeConfig.departments.map(d => (
                            <span key={d} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", activeColors.chipBg, activeColors.border, activeColors.chipText)}>
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">
                      {activeMatches.length} contact{activeMatches.length !== 1 ? "s" : ""} at {selectedCompany.name} match this seat
                      {activeMatches.length > 1 ? " — showing most senior by default" : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* All matches list */}
              {activeMatches.length > 1 && (
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/40 bg-secondary/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      All matches for this seat ({activeMatches.length})
                    </p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {activeMatches.map(c => {
                      const isSelected = (overrides[activeSeat!] ?? activeMatches[0]?.id) === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setOverrides(prev => ({ ...prev, [activeSeat!]: c.id }))}
                          className={cn(
                            "w-full flex items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-secondary/30",
                            isSelected && "bg-secondary/20"
                          )}
                        >
                          <ContactAvatar contact={c} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{c.firstName} {c.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.jobTitle ?? "—"}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {c.seniority && <SenioritySwatch value={c.seniority} />}
                            {isSelected && (
                              <div className="h-5 w-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                                <Check className="h-3 w-3 text-emerald-600" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </Shell>
  );
}
