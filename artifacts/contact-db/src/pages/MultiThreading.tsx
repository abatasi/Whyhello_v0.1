import { apiFetch } from "@/lib/apiFetch";
import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { ContactProfileView } from "@/pages/ContactProfile";
import { cn } from "@/lib/utils";
import {
  Megaphone, Wallet, Vote, Crown, Briefcase, Cpu, ShieldCheck,
  ShoppingCart, Scale, Calculator, User, Wrench, MessageCircle, Ban, GraduationCap,
  Building2, Globe, X, ExternalLink, Mail, Phone, MapPin, Linkedin,
  ChevronRight, Loader2, GitBranch, Users, ChevronDown, AlertCircle,
  Landmark, Check, ListTree,
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

interface TargetMarketConfig {
  id: string;
  name: string;
  industries: string[];
  companySizes: string[];
  locations: string[];
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

// Target market selector dropdown
function TargetMarketSelector({
  targetMarkets,
  selectedId,
  onSelect,
}: {
  targetMarkets: TargetMarketConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = targetMarkets.find(tm => tm.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const criteriaCount = selected
    ? selected.industries.length + selected.companySizes.length + selected.locations.length
    : 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors text-left"
      >
        <Globe className="h-3 w-3 text-teal-500 flex-shrink-0" />
        <span className="flex-1 text-xs font-semibold text-teal-700 truncate">
          {selected ? selected.name : "All companies"}
        </span>
        {criteriaCount > 0 && (
          <span className="text-[9px] font-semibold bg-teal-200/60 text-teal-700 rounded-full px-1.5 py-0.5 flex-shrink-0">
            {criteriaCount} filter{criteriaCount !== 1 ? "s" : ""}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 text-teal-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-secondary/20">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target market</p>
          </div>
          <button
            onClick={() => { onSelect(""); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 text-left transition-colors border-b border-border/30"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">All companies</p>
              <p className="text-[10px] text-muted-foreground">No target market filter</p>
            </div>
            {selectedId === "" && <Check className="h-3.5 w-3.5 text-teal-600 flex-shrink-0" />}
          </button>
          {targetMarkets.map(tm => {
            const count = tm.industries.length + tm.companySizes.length + tm.locations.length;
            return (
              <button
                key={tm.id}
                onClick={() => { onSelect(tm.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{tm.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {count > 0 ? `${count} filter criterion${count !== 1 ? "a" : ""}` : "No criteria defined"}
                  </p>
                </div>
                {tm.id === selectedId && <Check className="h-3.5 w-3.5 text-teal-600 flex-shrink-0" />}
              </button>
            );
          })}
          {targetMarkets.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">No target markets in HQ yet.</p>
              <Link href="/hq">
                <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">Configure in HQ →</span>
              </Link>
            </div>
          )}
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
  const [targetMarkets, setTargetMarkets] = useState<TargetMarketConfig[]>([]);
  const [selectedTmId, setSelectedTmId] = useState<string>("");
  const [dnaLoaded, setDnaLoaded] = useState(false);

  const [companyList, setCompanyList] = useState<CompanyResult[]>([]);
  const [companyListLoading, setCompanyListLoading] = useState(false);
  const [companyListTotal, setCompanyListTotal] = useState(0);
  const [companyFilter, setCompanyFilter] = useState("");

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [activeTabContactId, setActiveTabContactId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  // ── Derived active BC / TM ──
  const activeBc = buyingCenters.find(bc => bc.id === selectedBcId) ?? buyingCenters[0] ?? null;
  const activeTm = targetMarkets.find(tm => tm.id === selectedTmId) ?? null;

  // Only seats that have at least one criterion configured
  const configuredSeatDefs = BUYING_CENTER_SEATS.filter(def => {
    const seat = activeBc?.seats.find(s => s.seat === def.seat);
    return seat && (seat.seniorities.length > 0 || seat.departments.length > 0);
  });

  // ── Load DNA buying centers ──
  useEffect(() => {
    type StoredShape = {
      buyingCenters?: BuyingCenterConfig[];
      buyingCenter?: BuyingCenterSeat[];
      targetMarkets?: TargetMarketConfig[];
    };

    function applyDna(d: StoredShape) {
      const bcs: BuyingCenterConfig[] = d.buyingCenters?.length
        ? d.buyingCenters
        : d.buyingCenter ? [{ id: "default", name: "Default", seats: d.buyingCenter }] : [];
      const tms: TargetMarketConfig[] = d.targetMarkets ?? [];
      if (bcs.length > 0) { setBuyingCenters(bcs); setSelectedBcId(bcs[0].id); }
      if (tms.length > 0) { setTargetMarkets(tms); }
      setDnaLoaded(true);
    }

    // Primary: localStorage (always in sync with DNA page)
    try {
      const raw = localStorage.getItem("whyhello_dna_v4");
      if (raw) { applyDna(JSON.parse(raw) as StoredShape); return; }
    } catch {}

    // Fallback: API
    apiFetch("/api/hq/profile")
      .then(r => r.ok ? r.json() : null)
      .then((json: { data?: StoredShape } | null) => {
        if (json?.data) applyDna(json.data);
        else setDnaLoaded(true);
      })
      .catch(() => setDnaLoaded(true));
  }, []);

  // ── Load company list whenever the TM filter changes ──
  useEffect(() => {
    const tm = targetMarkets.find(t => t.id === selectedTmId) ?? null;
    setCompanyListLoading(true);
    setCompanyList([]);
    setCompanyListTotal(0);
    setSelectedCompany(null);
    setActiveTabContactId(null);
    setOverrides({});
    setCompanyFilter("");
    const params = new URLSearchParams({ limit: "200", sortBy: "name" });
    if (tm) {
      if (tm.industries.length > 0) params.set("industry", tm.industries.join(","));
      if (tm.companySizes.length > 0) params.set("size", tm.companySizes.join(","));
      if (tm.locations.length > 0) params.set("location", tm.locations.join(","));
    }
    apiFetch(`/api/companies?${params}`)
      .then(r => r.json())
      .then((json: { data: CompanyResult[]; total: number }) => {
        setCompanyList(json.data ?? []);
        setCompanyListTotal(json.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setCompanyListLoading(false));
  }, [selectedTmId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Select a company from the picklist ──
  function selectCompany(c: CompanyResult) {
    if (selectedCompany?.id === c.id) return;
    setActiveTabContactId(null);
    setOverrides({});
    setSelectedCompany(null);
    setCompanyLoading(true);
    apiFetch(`/api/companies/${c.id}`)
      .then(r => r.json())
      .then((data: Company) => setSelectedCompany(data))
      .catch(() => {})
      .finally(() => setCompanyLoading(false));
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

  // ── Tabs: one per unique matched contact across configured seats ──
  const tabs = useMemo(() => {
    if (!selectedCompany || !activeBc) return [];
    const seen = new Set<number>();
    const result: { contact: Contact; seatName: string; seatDef: typeof BUYING_CENTER_SEATS[0] }[] = [];
    for (const def of configuredSeatDefs) {
      const contact = getActiveContact(def.seat);
      if (contact && !seen.has(contact.id)) {
        seen.add(contact.id);
        result.push({ contact, seatName: def.seat, seatDef: def });
      }
    }
    return result;
  }, [selectedCompany, activeBc, configuredSeatDefs, overrides]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective active tab: explicit selection or auto-first
  const effectiveTabContactId = activeTabContactId ?? tabs[0]?.contact.id ?? null;

  const allUnconfigured = dnaLoaded && buyingCenters.length === 0;

  // Client-side name filter over the pre-loaded list
  const filteredCompanies = companyFilter.trim()
    ? companyList.filter(c => c.name.toLowerCase().includes(companyFilter.toLowerCase().trim()))
    : companyList;

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
                <p className="text-[10px] text-muted-foreground">Target market · Buying center</p>
              </div>
            </div>

            {/* Target market selector */}
            {dnaLoaded && (
              <TargetMarketSelector
                targetMarkets={targetMarkets}
                selectedId={selectedTmId}
                onSelect={id => setSelectedTmId(id)}
              />
            )}

            {/* Buying center selector */}
            {dnaLoaded && buyingCenters.length > 0 && (
              <BuyingCenterSelector
                buyingCenters={buyingCenters}
                selectedId={selectedBcId}
                onSelect={id => { setSelectedBcId(id); setActiveTabContactId(null); setOverrides({}); }}
              />
            )}

          </div>

          {/* Company picklist */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Filter bar */}
            <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2 flex-shrink-0">
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-2.5 py-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Filter companies…"
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40 min-w-0"
                />
                {companyFilter && (
                  <button onClick={() => setCompanyFilter("")} className="text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
                {companyListLoading ? "…" : `${filteredCompanies.length}${companyListTotal > companyList.length ? `+` : ""}`}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {companyListLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-xs">Loading companies…</p>
                </div>
              )}

              {!companyListLoading && allUnconfigured && (
                <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
                  <Landmark className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Set up a buying center in HQ first.</p>
                  <Link href="/hq">
                    <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">Go to HQ →</span>
                  </Link>
                </div>
              )}

              {!companyListLoading && !allUnconfigured && filteredCompanies.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    {companyFilter ? "No companies match that filter." : "No companies match this target market."}
                  </p>
                </div>
              )}

              {!companyListLoading && filteredCompanies.map(c => {
                const isSelected = selectedCompany?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCompany(c)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-b border-border/30 last:border-0 border-l-2",
                      isSelected ? "bg-amber-50/80 border-l-amber-400" : "border-l-transparent hover:bg-secondary/30"
                    )}
                  >
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border mt-0.5",
                      isSelected ? "bg-amber-100 border-amber-200" : "bg-secondary/50 border-border/50"
                    )}>
                      {isSelected && companyLoading
                        ? <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                        : <Building2 className={cn("h-3.5 w-3.5", isSelected ? "text-amber-600" : "text-muted-foreground/70")} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold truncate", isSelected ? "text-amber-800" : "text-foreground")}>{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{[c.industry, c.size, c.location].filter(Boolean).join(" · ")}</p>
                    </div>
                    {isSelected && !companyLoading && <ChevronRight className="h-3.5 w-3.5 text-amber-500/60 flex-shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#F8FAFC]">

          {/* No company selected */}
          {!selectedCompany && !companyLoading && (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Pick a company from the list</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {activeBc
                    ? `Select a company to map the "${activeBc.name}" buying center to their contacts.`
                    : "Select a company from the left to view buying center coverage."}
                </p>
              </div>
            </div>
          )}

          {/* Company loading */}
          {companyLoading && (
            <div className="h-full flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Loading company contacts…</p>
            </div>
          )}

          {/* Company loaded — tab belt + embedded profile */}
          {selectedCompany && !companyLoading && (
            <>
              {/* ── Tab belt ── */}
              <div className="flex-shrink-0 bg-white border-b border-border/60 flex items-end overflow-x-auto px-3 pt-2 gap-px">

                {/* Company pill at the start */}
                <div className="flex items-center gap-2 px-3 py-2 mb-px mr-2 flex-shrink-0">
                  <div className="h-5 w-5 rounded-md bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-3 w-3 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate max-w-[140px]">{selectedCompany.name}</p>
                    <p className="text-[9px] text-muted-foreground/60 truncate max-w-[140px]">
                      {[selectedCompany.industry, selectedCompany.size].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {activeBc && (
                    <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">
                      {activeBc.name}
                    </span>
                  )}
                  <div className="w-px h-5 bg-border/60 mx-1 flex-shrink-0" />
                </div>

                {/* One tab per matched contact */}
                {tabs.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 mb-px text-muted-foreground">
                    <ListTree className="h-3.5 w-3.5" />
                    <p className="text-xs">
                      {configuredSeatDefs.length === 0
                        ? "No seats configured — "
                        : "No contacts match this buying center — "}
                    </p>
                    <Link href="/hq">
                      <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">Configure in HQ →</span>
                    </Link>
                  </div>
                ) : (
                  tabs.map(tab => {
                    const isActive = effectiveTabContactId === tab.contact.id;
                    const colors = COLOR_MAP[tab.seatDef.color] ?? COLOR_MAP.slate;
                    return (
                      <button
                        key={tab.contact.id}
                        onClick={() => setActiveTabContactId(tab.contact.id)}
                        className={cn(
                          "flex items-center gap-2 px-3 pt-2 pb-2.5 rounded-t-xl border-t border-l border-r text-left flex-shrink-0 min-w-0 transition-all duration-150",
                          isActive
                            ? "bg-[#F8FAFC] border-border/50 -mb-px relative z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]"
                            : "bg-white/40 border-transparent hover:bg-white/80 hover:border-border/30"
                        )}
                        style={{ maxWidth: 200 }}
                      >
                        <ContactAvatar contact={tab.contact} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {tab.contact.firstName} {tab.contact.lastName}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <tab.seatDef.icon className={cn("h-2.5 w-2.5 flex-shrink-0", isActive ? colors.iconColor : "text-muted-foreground/40")} />
                            <p className={cn("text-[9px] font-medium truncate", isActive ? colors.iconColor : "text-muted-foreground/60")}>
                              {tab.seatName}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* ── Profile area ── */}
              {effectiveTabContactId ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ContactProfileView
                    key={effectiveTabContactId}
                    contactId={effectiveTabContactId}
                    embedded
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
                  <Users className="h-5 w-5" />
                  <p className="text-sm">No matched contacts to display.</p>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </Shell>
  );
}
