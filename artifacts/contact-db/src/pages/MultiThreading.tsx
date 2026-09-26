import { apiFetch } from "@/lib/apiFetch";
import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { ContactProfileView, type SeatContext } from "@/pages/ContactProfile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Megaphone, Wallet, Vote, Crown, Briefcase, Cpu, ShieldCheck,
  ShoppingCart, Scale, Calculator, User, Wrench, MessageCircle, Ban, GraduationCap,
  Building2, Globe, X, ExternalLink, Mail, Phone, MapPin, Linkedin,
  ChevronRight, Loader2, GitBranch, Users, ChevronDown, AlertCircle,
  Landmark, Check, ListTree, Plus, ChevronUp,
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
  violet:  { bg: "bg-violet-50 dark:bg-background",  border: "border-violet-200 dark:border-violet-500/40",  borderL: "border-l-violet-400 dark:border-l-violet-500/50",  iconBg: "bg-violet-100 dark:bg-violet-500/20",  iconColor: "text-violet-600 dark:text-violet-400",  chipBg: "bg-violet-100 dark:bg-violet-500/20",  chipText: "text-violet-700 dark:text-violet-300",  activeBg: "bg-violet-50/80 dark:bg-background"  },
  emerald: { bg: "bg-emerald-50 dark:bg-background", border: "border-emerald-200 dark:border-emerald-500/40", borderL: "border-l-emerald-400 dark:border-l-emerald-500/50", iconBg: "bg-emerald-100 dark:bg-emerald-500/20", iconColor: "text-emerald-600 dark:text-emerald-400", chipBg: "bg-emerald-100 dark:bg-emerald-500/20", chipText: "text-emerald-700 dark:text-emerald-300", activeBg: "bg-emerald-50/80 dark:bg-background" },
  blue:    { bg: "bg-blue-50 dark:bg-background",    border: "border-blue-200 dark:border-blue-500/40",    borderL: "border-l-blue-400 dark:border-l-blue-500/50",    iconBg: "bg-blue-100 dark:bg-blue-500/20",    iconColor: "text-blue-600 dark:text-blue-400",    chipBg: "bg-blue-100 dark:bg-blue-500/20",    chipText: "text-blue-700 dark:text-blue-300",    activeBg: "bg-blue-50/80 dark:bg-background"    },
  amber:   { bg: "bg-amber-50 dark:bg-background",   border: "border-amber-200 dark:border-amber-500/40",   borderL: "border-l-amber-400 dark:border-l-amber-500/50",   iconBg: "bg-amber-100 dark:bg-amber-500/20",   iconColor: "text-amber-600 dark:text-amber-400",   chipBg: "bg-amber-100 dark:bg-amber-500/20",   chipText: "text-amber-700 dark:text-amber-300",   activeBg: "bg-amber-50/80 dark:bg-background"   },
  slate:   { bg: "bg-slate-50 dark:bg-background",   border: "border-slate-200 dark:border-slate-500/40",   borderL: "border-l-slate-400 dark:border-l-slate-500/50",   iconBg: "bg-slate-100 dark:bg-slate-500/20",   iconColor: "text-slate-500 dark:text-slate-400",   chipBg: "bg-slate-100 dark:bg-slate-500/20",   chipText: "text-slate-600 dark:text-slate-300",   activeBg: "bg-slate-50/80 dark:bg-background"   },
  sky:     { bg: "bg-sky-50 dark:bg-background",     border: "border-sky-200 dark:border-sky-500/40",     borderL: "border-l-sky-400 dark:border-l-sky-500/50",     iconBg: "bg-sky-100 dark:bg-sky-500/20",     iconColor: "text-sky-600 dark:text-sky-400",     chipBg: "bg-sky-100 dark:bg-sky-500/20",     chipText: "text-sky-700 dark:text-sky-300",     activeBg: "bg-sky-50/80 dark:bg-background"     },
  rose:    { bg: "bg-rose-50 dark:bg-background",    border: "border-rose-200 dark:border-rose-500/40",    borderL: "border-l-rose-400 dark:border-l-rose-500/50",    iconBg: "bg-rose-100 dark:bg-rose-500/20",    iconColor: "text-rose-600 dark:text-rose-400",    chipBg: "bg-rose-100 dark:bg-rose-500/20",    chipText: "text-rose-600 dark:text-rose-400",    activeBg: "bg-rose-50/80 dark:bg-background"    },
};

// ── Seniority ranking ─────────────────────────────────────────────────────────

const SENIORITY_RANK: Record<string, number> = {
  "C-Suite": 5, "VP": 4, "Director": 3, "Manager": 2, "Individual Contributor": 1,
};

const SENIORITY_OPTIONS = ["C-Suite", "VP", "Director", "Manager", "Individual Contributor"];

const DEPARTMENT_OPTIONS = [
  "Business Development", "Claims", "Clinical", "Consulting", "Content", "Creative",
  "Customer Experience", "Customer Success", "Data", "Design", "Development", "Digital",
  "Education", "Engineering", "Executive", "Finance", "Investment Advisor", "Investments",
  "Legal", "Marketing", "Medical", "Merchandising", "Operations", "Product", "Production",
  "Programs", "R&D", "Research", "Revenue", "Risk", "Sales", "Security", "Underwriting",
];

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

// ── DNA persistence helpers ───────────────────────────────────────────────────

const DNA_KEY = "whyhello_dna_v4";

async function persistDnaPatch(patch: (prev: Record<string, unknown>) => Record<string, unknown>) {
  let dna: Record<string, unknown> = {};
  try { const raw = localStorage.getItem(DNA_KEY); if (raw) dna = JSON.parse(raw); } catch {}
  const updated = patch(dna);
  try { localStorage.setItem(DNA_KEY, JSON.stringify(updated)); } catch {}
  try {
    await apiFetch("/api/hq/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: updated }),
    });
  } catch {}
}

// ── Shared pill toggle ────────────────────────────────────────────────────────

function PillGroup({
  options, selected, onToggle, accent = "primary",
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  accent?: "primary" | "teal" | "indigo";
}) {
  const activeClass =
    accent === "teal" ? "bg-teal-100 border-teal-300 text-teal-700" :
    accent === "indigo" ? "bg-indigo-100 border-indigo-300 text-indigo-700" :
    "bg-primary/10 border-primary/30 text-primary";
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
            selected.includes(o)
              ? activeClass
              : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ── Create Target Market modal ────────────────────────────────────────────────

function CreateTargetMarketModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (tm: TargetMarketConfig) => void;
}) {
  const [name, setName] = useState("New target market");
  const [industries, setIndustries] = useState<string[]>([]);
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [options, setOptions] = useState<{ industries: string[]; companySizes: string[]; locations: string[] }>({ industries: [], companySizes: [], locations: [] });
  const [optLoading, setOptLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("New target market");
    setIndustries([]); setCompanySizes([]); setLocations([]);
    setTimeout(() => nameRef.current?.select(), 50);
    setOptLoading(true);
    apiFetch("/api/filters/options")
      .then(r => r.json())
      .then(json => setOptions({ industries: json.industries ?? [], companySizes: json.companySizes ?? [], locations: json.locations ?? [] }))
      .catch(() => {})
      .finally(() => setOptLoading(false));
  }, [open]);

  function toggle(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function save() {
    setSaving(true);
    try {
      const tm: TargetMarketConfig = {
        id: `tm_${Date.now()}`,
        name: name.trim() || "New target market",
        industries, companySizes, locations,
      };
      await persistDnaPatch(dna => ({
        ...dna,
        targetMarkets: [...((dna.targetMarkets as TargetMarketConfig[]) ?? []), tm],
      }));
      onCreated(tm);
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[540px] max-h-[88vh] overflow-y-auto">
        <div className="flex flex-col gap-5 pt-1">

          {/* Header */}
          <div className="pr-6">
            <DialogTitle>New Target Market</DialogTitle>
            <DialogDescription>
              Define the company criteria for this customer segment. Reflects in HQ once saved.
            </DialogDescription>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              placeholder="e.g. Mid-market SaaS"
            />
          </div>

          <div className="h-px bg-border/50" />

          {optLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading filter options…
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Industries */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">Industries</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Which industries does this segment include?</p>
                </div>
                {options.industries.length > 0
                  ? <PillGroup options={options.industries} selected={industries} onToggle={v => toggle(industries, v, setIndustries)} accent="teal" />
                  : <p className="text-xs text-muted-foreground">No industry data in your database yet.</p>}
              </div>

              {/* Company size */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">Company size</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">How many employees?</p>
                </div>
                {options.companySizes.length > 0
                  ? <PillGroup options={options.companySizes} selected={companySizes} onToggle={v => toggle(companySizes, v, setCompanySizes)} accent="teal" />
                  : <p className="text-xs text-muted-foreground">No company size data yet.</p>}
              </div>

              {/* Locations */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">Locations</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Which geographic regions?</p>
                </div>
                {options.locations.length > 0
                  ? <PillGroup options={options.locations} selected={locations} onToggle={v => toggle(locations, v, setLocations)} accent="teal" />
                  : <p className="text-xs text-muted-foreground">No location data yet.</p>}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground">
              {[industries.length && `${industries.length} industr${industries.length !== 1 ? "ies" : "y"}`,
                companySizes.length && `${companySizes.length} size${companySizes.length !== 1 ? "s" : ""}`,
                locations.length && `${locations.length} location${locations.length !== 1 ? "s" : ""}`]
                .filter(Boolean).join(" · ") || "No filters selected — matches all companies"}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-4 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary/40 transition-colors">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !name.trim()}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Buying Center modal ─────────────────────────────────────────────────

function CreateBuyingCenterModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (bc: BuyingCenterConfig) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("New buying center");
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  // seat config: { [seatName]: { seniorities, departments } }
  const [seatConfig, setSeatConfig] = useState<Record<string, { seniorities: string[]; departments: string[] }>>({});
  const [expandedSeat, setExpandedSeat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setName("New buying center");
    setSelectedSeats([]);
    setSeatConfig({});
    setExpandedSeat(null);
    setTimeout(() => nameRef.current?.select(), 50);
  }, [open]);

  function toggleSeat(seat: string) {
    setSelectedSeats(prev =>
      prev.includes(seat) ? prev.filter(s => s !== seat) : [...prev, seat]
    );
  }

  function updateSeatConfig(seat: string, patch: { seniorities?: string[]; departments?: string[] }) {
    setSeatConfig(prev => ({
      ...prev,
      [seat]: { seniorities: [], departments: [], ...prev[seat], ...patch },
    }));
  }

  function toggleSeniority(seat: string, val: string) {
    const cur = seatConfig[seat]?.seniorities ?? [];
    updateSeatConfig(seat, { seniorities: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] });
  }

  function toggleDept(seat: string, val: string) {
    const cur = seatConfig[seat]?.departments ?? [];
    updateSeatConfig(seat, { departments: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] });
  }

  async function save() {
    setSaving(true);
    try {
      const seats: BuyingCenterSeat[] = BUYING_CENTER_SEATS.map(def => ({
        seat: def.seat,
        seniorities: selectedSeats.includes(def.seat) ? (seatConfig[def.seat]?.seniorities ?? []) : [],
        departments: selectedSeats.includes(def.seat) ? (seatConfig[def.seat]?.departments ?? []) : [],
      }));
      const bc: BuyingCenterConfig = { id: `bc_${Date.now()}`, name: name.trim() || "New buying center", seats };
      await persistDnaPatch(dna => ({
        ...dna,
        buyingCenters: [...((dna.buyingCenters as BuyingCenterConfig[]) ?? []), bc],
      }));
      onCreated(bc);
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[560px] max-h-[88vh] overflow-y-auto">
        <div className="flex flex-col gap-5 pt-1">

          {/* Header */}
          <div className="pr-6 flex items-start justify-between gap-4">
            <div>
              <DialogTitle>New Buying Center</DialogTitle>
              <DialogDescription>
                {step === 1
                  ? "Name this buying center and select the seats that matter for your deals."
                  : "Configure the seniority and department criteria for each seat."}
              </DialogDescription>
            </div>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
              {([1, 2] as const).map(s => (
                <div key={s} className={cn(
                  "h-1.5 rounded-full transition-all",
                  s <= step ? "bg-primary w-6" : "bg-border w-3",
                )} />
              ))}
            </div>
          </div>

          {/* ── Step 1: Name + seat selection ── */}
          {step === 1 && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Name</label>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="e.g. Enterprise buying center"
                />
              </div>

              <div className="h-px bg-border/50" />

              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">Seats</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select the stakeholder roles relevant to this buying center. You'll configure criteria in the next step.
                  </p>
                </div>
                <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-1">
                  {BUYING_CENTER_SEATS.map(def => {
                    const colors = COLOR_MAP[def.color] ?? COLOR_MAP.slate;
                    const Icon = def.icon;
                    const active = selectedSeats.includes(def.seat);
                    return (
                      <button
                        key={def.seat}
                        type="button"
                        onClick={() => toggleSeat(def.seat)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                          active ? cn(colors.bg, colors.border) : "bg-card border-border/40 hover:bg-secondary/30",
                        )}
                      >
                        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border", colors.iconBg, colors.border)}>
                          <Icon className={cn("h-3.5 w-3.5", colors.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-semibold", active ? "text-foreground" : "text-foreground/80")}>{def.seat}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{def.role}</p>
                        </div>
                        <div className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-all",
                          active ? "bg-primary border-primary" : "border-border/60 bg-card",
                        )}>
                          {active && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedSeats.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">{selectedSeats.length} seat{selectedSeats.length !== 1 ? "s" : ""} selected</p>
                )}
              </div>
            </>
          )}

          {/* ── Step 2: Configure each seat ── */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {selectedSeats.map(seatName => {
                const def = BUYING_CENTER_SEATS.find(d => d.seat === seatName)!;
                const colors = COLOR_MAP[def.color] ?? COLOR_MAP.slate;
                const Icon = def.icon;
                const cfg = seatConfig[seatName] ?? { seniorities: [], departments: [] };
                const isExpanded = expandedSeat === seatName;
                const configCount = cfg.seniorities.length + cfg.departments.length;

                return (
                  <div key={seatName} className={cn("rounded-xl border overflow-hidden transition-all", isExpanded ? cn(colors.bg, colors.border) : "border-border/50 bg-card")}>
                    <button
                      type="button"
                      onClick={() => setExpandedSeat(isExpanded ? null : seatName)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border", colors.iconBg, colors.border)}>
                        <Icon className={cn("h-3.5 w-3.5", colors.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{seatName}</p>
                        {configCount > 0
                          ? <p className="text-[10px] text-muted-foreground">{configCount} criterion{configCount !== 1 ? "a" : ""} set</p>
                          : <p className="text-[10px] text-muted-foreground/70">No criteria yet — matches any contact</p>
                        }
                      </div>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/40 px-3 pb-3 pt-3 flex flex-col gap-3.5">
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[11px] font-semibold text-foreground">Seniority</p>
                          <PillGroup
                            options={SENIORITY_OPTIONS}
                            selected={cfg.seniorities}
                            onToggle={v => toggleSeniority(seatName, v)}
                            accent="indigo"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[11px] font-semibold text-foreground">Departments</p>
                          <PillGroup
                            options={DEPARTMENT_OPTIONS}
                            selected={cfg.departments}
                            onToggle={v => toggleDept(seatName, v)}
                            accent="indigo"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <button
              onClick={step === 1 ? onClose : () => setStep(1)}
              className="px-4 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary/40 transition-colors"
            >
              {step === 1 ? "Cancel" : "← Back"}
            </button>
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={selectedSeats.length === 0 || !name.trim()}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Configure seats →
              </button>
            ) : (
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SenioritySwatch({ value }: { value: string }) {
  const colors: Record<string, string> = {
    "C-Suite": "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
    "VP": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    "Director": "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20",
    "Manager": "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    "Individual Contributor": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", colors[value] ?? "bg-secondary text-muted-foreground border-border")}>
      {value}
    </span>
  );
}

function ContactAvatar({ contact, size = "md" }: { contact: Contact; size?: "sm" | "md" | "lg" }) {
  const initials = getInitials(contact.firstName, contact.lastName);
  const sizeClass = size === "lg" ? "h-16 w-16 text-xl" : size === "md" ? "h-12 w-12 text-sm" : "h-8 w-8 text-xs";
  return (
    <div className={cn("rounded-full bg-indigo-100 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100 flex items-center justify-center font-bold flex-shrink-0", sizeClass)}>
      {initials}
    </div>
  );
}

// Buying center selector dropdown
function BuyingCenterSelector({
  buyingCenters,
  selectedId,
  onSelect,
  onCreateNew,
}: {
  buyingCenters: BuyingCenterConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors text-left"
      >
        <ListTree className="h-3 w-3 text-indigo-500 flex-shrink-0" />
        <span className="flex-1 text-xs font-semibold text-indigo-700 truncate">
          {selected?.name ?? "No buying center"}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-indigo-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-secondary/20 dark:bg-background">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Buying center</p>
          </div>
          {buyingCenters.map(bc => {
            const configuredCount = bc.seats.filter(s => s.seniorities.length > 0 || s.departments.length > 0).length;
            return (
              <button
                key={bc.id}
                onClick={() => { onSelect(bc.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 text-left transition-colors border-b border-border/30 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{bc.name}</p>
                  <p className="text-[10px] text-muted-foreground">{configuredCount} seat{configuredCount !== 1 ? "s" : ""} configured</p>
                </div>
                {bc.id === selectedId && <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />}
              </button>
            );
          })}
          <button
            onClick={() => { setOpen(false); onCreateNew(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-50 text-left transition-colors border-t border-border/40"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-indigo-600">Create new buying center</span>
          </button>
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
  onCreateNew,
}: {
  targetMarkets: TargetMarketConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
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
          <div className="px-3 py-2 border-b border-border/50 bg-secondary/20 dark:bg-background">
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
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 text-left transition-colors border-b border-border/30 last:border-0"
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
          <button
            onClick={() => { setOpen(false); onCreateNew(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-teal-50 text-left transition-colors border-t border-border/40"
          >
            <Plus className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-teal-600">Create new target market</span>
          </button>
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
          <div className="px-3 py-2 border-b border-border/60 bg-secondary/30 dark:bg-background">
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
  const [createTmOpen, setCreateTmOpen] = useState(false);
  const [createBcOpen, setCreateBcOpen] = useState(false);

  const [companyList, setCompanyList] = useState<CompanyResult[]>([]);
  const [companyListLoading, setCompanyListLoading] = useState(false);
  const [companyListTotal, setCompanyListTotal] = useState(0);
  const [companyFilter, setCompanyFilter] = useState("");

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [activeTabSeat, setActiveTabSeat] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    sessionStorage.getItem("mt-banner-dismissed") === "1"
  );

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
    setActiveTabSeat(null);
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
    setActiveTabSeat(null);
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
    const overrideId = overrides[seatName];
    if (overrideId) {
      // Allow any company contact as an override, not just matched ones
      const override = selectedCompany?.contacts.find(c => c.id === overrideId);
      if (override) return override;
    }
    const matches = getMatches(seatName);
    return matches.length > 0 ? matches[0] : null;
  }

  // ── Tabs: one per configured seat (contact may repeat across seats) ──
  const tabs = useMemo(() => {
    if (!selectedCompany || !activeBc) return [];
    return configuredSeatDefs.map(def => ({
      seatName: def.seat,
      seatDef: def,
      contact: getActiveContact(def.seat),
    }));
  }, [selectedCompany, activeBc, configuredSeatDefs, overrides]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective active tab: explicit selection or auto-first
  const effectiveTab = tabs.find(t => t.seatName === (activeTabSeat ?? tabs[0]?.seatName)) ?? null;

  const allUnconfigured = dnaLoaded && buyingCenters.length === 0;

  // Client-side name filter over the pre-loaded list
  const filteredCompanies = companyFilter.trim()
    ? companyList.filter(c => c.name.toLowerCase().includes(companyFilter.toLowerCase().trim()))
    : companyList;

  // ── Render ──
  return (
    <Shell>
      {/* ── Announcement bar ── */}
      {!bannerDismissed && (
        <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1 flex items-center justify-center gap-2.5 min-w-0">
            <GitBranch className="h-3.5 w-3.5 text-white/80 flex-shrink-0" />
            <p className="text-xs text-white/95 text-center leading-snug">
              <span className="font-semibold text-white">Deals move faster when you engage the whole buying group:</span>
              {" "}multi-threading increases win rates by 130% on deals over $50K.
            </p>
          </div>
          <button
            onClick={() => { setBannerDismissed(true); sessionStorage.setItem("mt-banner-dismissed", "1"); }}
            className="flex-shrink-0 text-white/60 hover:text-white transition-colors ml-2"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left panel ── */}
        <div className="w-80 flex-shrink-0 border-r border-border/60 bg-card flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/60 flex-shrink-0 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-base font-bold text-foreground leading-tight">Multi-threading</h1>
            </div>

            {/* Target market selector */}
            {dnaLoaded && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Market</p>
                <TargetMarketSelector
                  targetMarkets={targetMarkets}
                  selectedId={selectedTmId}
                  onSelect={id => setSelectedTmId(id)}
                  onCreateNew={() => setCreateTmOpen(true)}
                />
              </div>
            )}

            {/* Buying center selector */}
            {dnaLoaded && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buying Center</p>
                <BuyingCenterSelector
                  buyingCenters={buyingCenters}
                  selectedId={selectedBcId}
                  onSelect={id => { setSelectedBcId(id); setActiveTabSeat(null); setOverrides({}); }}
                  onCreateNew={() => setCreateBcOpen(true)}
                />
              </div>
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
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">

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
              <div className="flex-shrink-0 bg-background border-b border-border/60 flex items-end overflow-x-auto px-3 pt-2 gap-px">

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

                {/* One tab per configured seat */}
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
                    const isActive = effectiveTab?.seatName === tab.seatName;
                    const colors = COLOR_MAP[tab.seatDef.color] ?? COLOR_MAP.slate;
                    return (
                      <button
                        key={tab.seatName}
                        onClick={() => setActiveTabSeat(tab.seatName)}
                        className={cn(
                          "flex items-center gap-2 px-3 pt-2 pb-2.5 rounded-t-xl border-t border-l border-r text-left flex-shrink-0 min-w-0 transition-all duration-150",
                          isActive
                            ? "bg-background border-border/50 -mb-px relative z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]"
                            : "bg-background/40 border-transparent hover:bg-background/80 hover:border-border/30"
                        )}
                        style={{ maxWidth: 200 }}
                      >
                        {tab.contact ? (
                          <ContactAvatar contact={tab.contact} size="sm" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center flex-shrink-0">
                            <tab.seatDef.icon className="h-3.5 w-3.5 text-orange-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {tab.contact
                              ? `${tab.contact.firstName} ${tab.contact.lastName}`
                              : "No match"}
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
              {effectiveTab?.contact ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ContactProfileView
                    key={`${effectiveTab.seatName}-${effectiveTab.contact.id}`}
                    contactId={effectiveTab.contact.id}
                    embedded
                    seatContext={{
                      seatName: effectiveTab.seatName,
                      seatRole: effectiveTab.seatDef.role,
                      icon: effectiveTab.seatDef.icon,
                      colorKey: effectiveTab.seatDef.color,
                      matches: getMatches(effectiveTab.seatName),
                      allCompanyContacts: selectedCompany?.contacts ?? [],
                      currentContactId: effectiveTab.contact.id,
                      onReassign: (contactId) => setOverrides(prev => ({ ...prev, [effectiveTab.seatName]: contactId })),
                    }}
                  />
                </div>
              ) : effectiveTab && !effectiveTab.contact ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center border",
                    (COLOR_MAP[effectiveTab.seatDef.color] ?? COLOR_MAP.slate).iconBg,
                    (COLOR_MAP[effectiveTab.seatDef.color] ?? COLOR_MAP.slate).border
                  )}>
                    <effectiveTab.seatDef.icon className={cn("h-6 w-6", (COLOR_MAP[effectiveTab.seatDef.color] ?? COLOR_MAP.slate).iconColor)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">No match for {effectiveTab.seatName}</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      No contacts at {selectedCompany.name} match the criteria for this seat.
                    </p>
                  </div>
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

      <CreateTargetMarketModal
        open={createTmOpen}
        onClose={() => setCreateTmOpen(false)}
        onCreated={tm => {
          setTargetMarkets(prev => [...prev, tm]);
          setSelectedTmId(tm.id);
        }}
      />

      <CreateBuyingCenterModal
        open={createBcOpen}
        onClose={() => setCreateBcOpen(false)}
        onCreated={bc => {
          setBuyingCenters(prev => [...prev, bc]);
          setSelectedBcId(bc.id);
          setActiveTabSeat(null);
          setOverrides({});
        }}
      />

    </Shell>
  );
}
