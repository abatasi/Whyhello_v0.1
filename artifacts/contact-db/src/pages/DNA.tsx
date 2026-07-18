import { useState, useEffect, useRef } from "react";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";
import {
  Mic2, Package, Building2, Plus, Trash2, ChevronDown,
  Save, CheckCircle2, Dna, Sparkles, Upload, X, FileText,
  Loader2, RefreshCw, Ban, PenLine, TrendingDown, TrendingUp,
  Info, BarChart3, Users, Users2, Target, Globe, MessageSquare, Shield,
  Megaphone, Wallet, Vote, Crown, Briefcase, Cpu, ShieldCheck,
  ShoppingCart, Scale, Calculator, User, Wrench, MessageCircle, GraduationCap,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// ── Persistence ──────────────────────────────────────────────────────────────

const API_PROFILE_URL = "/api/dna/profile";

const STORAGE_KEY = "whyhello_dna_v3";

function mergeBuyingCenter(saved?: Array<Partial<BuyingCenterSeat>>): BuyingCenterSeat[] {
  const savedMap = new Map((saved ?? []).map(s => [s.seat!, s]));
  return BUYING_CENTER_SEATS.map(def => ({
    seat: def.seat,
    seniorities: savedMap.get(def.seat)?.seniorities ?? [],
    departments: savedMap.get(def.seat)?.departments ?? [],
  }));
}

function mergeDNA(parsed: Partial<DNAData>): DNAData {
  const d = defaultDNA();
  return {
    ...d,
    ...parsed,
    voice: { ...d.voice, ...(parsed.voice ?? {}) },
    company: { ...d.company, ...(parsed.company ?? {}) },
    products: (parsed.products ?? []).map(p => ({ ...p, economicBenefits: p.economicBenefits ?? [] })),
    customers: (parsed.customers ?? []).map(c => ({ ...c, economicBenefits: c.economicBenefits ?? [] })),
    marketPosition: { ...d.marketPosition, ...(parsed.marketPosition ?? {}) },
    competitors: parsed.competitors ?? [],
    buyingCenter: mergeBuyingCenter(parsed.buyingCenter),
  };
}

function loadDNA(): DNAData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return mergeDNA(JSON.parse(raw) as Partial<DNAData>);
  } catch { /* ignore */ }
  return defaultDNA();
}

function saveDNA(data: DNAData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Types ────────────────────────────────────────────────────────────────────

interface EconomicBenefit {
  id: string;
  type: "pain" | "gain";
  description: string;
  amount: string;
  unit: string;
  frequency: string;
}

interface Product {
  id: string;
  name: string;
  tagline: string;
  features: string;
  outcomes: string;
  persona: string;
  economicBenefits: EconomicBenefit[];
}

interface Customer {
  id: string;
  rawTestimonial: string;
  customerProfile: string;
  startingSituation: string;
  customerPriorities: string;
  solutionProvided: string;
  customerTransformation: string;
  results: string;
  economicBenefits: EconomicBenefit[];
  customerQuote: string;
}

interface MarketPosition {
  pricePosition: string;
  productBreadth: string;
  productDepth: string;
  customerFocus: string;
  deliveryModel: string;
  primaryAdvantage: string;
  typicalBuyingPriority: string;
}

interface Competitor {
  id: string;
  name: string;
  website: string;
  productCompared: string;
  category: string;
  marketSegments: string;
  dealFrequency: string;
  notes: string;
  theirStrengths: string;
  buyersPreferThem: string;
  theyAreBetterWhen: string;
  avoidClaiming: string;
  ourStrengths: string;
  problemsExposingWeakness: string;
  buyersPreferUs: string;
  advantagesOverTime: string;
}

interface BuyingCenterSeat {
  seat: string;
  seniorities: string[];
  departments: string[];
}

interface DNAData {
  voice: {
    toneTags: string[];
    communicationStyle: string;
    writingNotes: string;
    trainingText: string;
    suppressions: string[];
    suppressionNotes: string;
  };
  products: Product[];
  customers: Customer[];
  marketPosition: MarketPosition;
  competitors: Competitor[];
  buyingCenter: BuyingCenterSeat[];
  company: {
    name: string;
    valueWedge: string;
    positioning: string;
    differentiators: string;
    pillars: [string, string, string];
  };
}

function defaultDNA(): DNAData {
  return {
    voice: {
      toneTags: [],
      communicationStyle: "balanced",
      writingNotes: "",
      trainingText: "",
      suppressions: [],
      suppressionNotes: "",
    },
    products: [],
    company: {
      name: "",
      valueWedge: "",
      positioning: "",
      differentiators: "",
      pillars: ["", "", ""],
    },
    customers: [],
    marketPosition: {
      pricePosition: "",
      productBreadth: "",
      productDepth: "",
      customerFocus: "",
      deliveryModel: "",
      primaryAdvantage: "",
      typicalBuyingPriority: "",
    },
    competitors: [],
    buyingCenter: BUYING_CENTER_SEATS.map(s => ({ seat: s.seat, seniorities: [], departments: [] })),
  };
}

const TONE_SUGGESTIONS = [
  "Direct", "Empathetic", "Confident", "Consultative", "Witty",
  "Professional", "Warm", "Data-driven", "Story-driven", "Concise",
  "Energetic", "Authoritative",
];

const SUPPRESSION_SUGGESTIONS = [
  "Em dashes (—)",
  "Emojis",
  "Exclamation marks",
  "Bullet point lists",
  "Passive voice",
  "Numbered lists",
  "Corporate jargon",
  "Rhetorical questions",
  "Hedging language",
  "Alliteration",
  '"Game-changer" / "Paradigm shift"',
  '"Hope this finds you well"',
  '"Circle back" / "Touch base"',
  '"Leverage" / "Synergy"',
  '"Dive deep" / "Double-click"',
  "Oxford comma",
];

const STYLE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "balanced", label: "Balanced" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
  { value: "executive", label: "Executive" },
];

const SENIORITY_OPTIONS = [
  "C-Suite", "VP", "Director", "Manager", "Individual Contributor",
];

const DEPARTMENT_OPTIONS = [
  "Business Development", "Claims", "Clinical", "Consulting", "Content", "Creative",
  "Customer Experience", "Customer Success", "Data", "Design", "Development", "Digital",
  "Education", "Engineering", "Executive", "Finance", "Investments", "Legal", "Marketing",
  "Medical", "Merchandising", "Operations", "Product", "Production", "Programs", "R&D",
  "Research", "Revenue", "Risk", "Sales", "Security", "Underwriting",
];

const BUYING_CENTER_SEATS: { seat: string; role: string; icon: React.ElementType; color: string }[] = [
  { seat: "Business Champion",               role: "Promotes the solution internally and helps advance the sale",    icon: Megaphone,     color: "violet"  },
  { seat: "Economic Buyer",                  role: "Controls or authorizes the budget",                             icon: Wallet,        color: "emerald" },
  { seat: "Decision Maker",                  role: "Makes or materially influences the final selection",            icon: Vote,          color: "violet"  },
  { seat: "Executive Sponsor",               role: "Connects the initiative to executive priorities",               icon: Crown,         color: "violet"  },
  { seat: "Business Owner",                  role: "Owns the business problem and expected outcome",                icon: Briefcase,     color: "amber"   },
  { seat: "Technical Buyer",                 role: "Evaluates architecture, integrations and technical viability",  icon: Cpu,           color: "blue"    },
  { seat: "Security or Compliance Reviewer", role: "Assesses security, privacy, legal or regulatory risk",         icon: ShieldCheck,   color: "slate"   },
  { seat: "Procurement",                     role: "Manages commercial terms and purchasing requirements",          icon: ShoppingCart,  color: "emerald" },
  { seat: "Legal",                           role: "Reviews contractual and legal obligations",                     icon: Scale,         color: "slate"   },
  { seat: "Finance",                         role: "Validates costs, ROI and budget treatment",                     icon: Calculator,    color: "emerald" },
  { seat: "End User",                        role: "Uses the product or experiences the operational change",        icon: User,          color: "sky"     },
  { seat: "Implementer",                     role: "Owns deployment, configuration or change management",          icon: Wrench,        color: "blue"    },
  { seat: "Influencer",                      role: "Shapes requirements or internal opinions",                     icon: MessageCircle, color: "sky"     },
  { seat: "Blocker",                         role: "Can delay, oppose or prevent the purchase",                    icon: Ban,           color: "rose"    },
  { seat: "Coach",                           role: "Privately helps the seller understand the account and process", icon: GraduationCap, color: "amber"  },
];

const COLOR_MAP: Record<string, {
  bg: string; border: string; iconBg: string; iconColor: string;
  chipBg: string; chipBorder: string; chipText: string;
}> = {
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  iconBg: "bg-violet-100",  iconColor: "text-violet-600",  chipBg: "bg-violet-100",  chipBorder: "border-violet-200",  chipText: "text-violet-700"  },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", chipBg: "bg-emerald-100", chipBorder: "border-emerald-200", chipText: "text-emerald-700" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    iconBg: "bg-blue-100",    iconColor: "text-blue-600",    chipBg: "bg-blue-100",    chipBorder: "border-blue-200",    chipText: "text-blue-700"    },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   iconBg: "bg-amber-100",   iconColor: "text-amber-600",   chipBg: "bg-amber-100",   chipBorder: "border-amber-200",   chipText: "text-amber-700"   },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   iconBg: "bg-slate-100",   iconColor: "text-slate-500",   chipBg: "bg-slate-100",   chipBorder: "border-slate-200",   chipText: "text-slate-600"   },
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     iconBg: "bg-sky-100",     iconColor: "text-sky-600",     chipBg: "bg-sky-100",     chipBorder: "border-sky-200",     chipText: "text-sky-700"     },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    iconBg: "bg-rose-100",    iconColor: "text-rose-600",    chipBg: "bg-rose-100",    chipBorder: "border-rose-200",    chipText: "text-rose-600"    },
};

// ── Auto-save hook ───────────────────────────────────────────────────────────

function useAutoSave(data: DNAData) {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      saveDNA(data);
      try {
        await fetch(API_PROFILE_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
      } catch { /* localStorage save already succeeded — API failure is non-fatal */ }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [data]);

  return saved;
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, subtitle,
  accentBg, accentBorder, accentColor,
  defaultOpen = true, children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  accentBg: string;
  accentBorder: string;
  accentColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0", accentBg, accentBorder)}>
          <Icon className={cn("h-5 w-5", accentColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground/60 transition-transform flex-shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border/40 px-6 py-6 flex flex-col gap-6">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 leading-relaxed transition-colors"
    />
  );
}

function Input({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
    />
  );
}

// ── Uploaded file pill ───────────────────────────────────────────────────────

interface UploadedFile {
  name: string;
  status: "processing" | "done" | "error";
}

// ── Save field button ─────────────────────────────────────────────────────────

function SaveFieldButton({ show, onSave }: { show: boolean; onSave: () => void }) {
  const [flash, setFlash] = useState(false);

  function handleClick() {
    onSave();
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  }

  if (!show) return null;

  return (
    <div className="flex justify-end mt-1">
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all",
          flash
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
        )}
      >
        {flash
          ? <><CheckCircle2 className="h-3 w-3" /> Saved</>
          : <><Sparkles className="h-3 w-3" /> Save &amp; update profile</>
        }
      </button>
    </div>
  );
}

// ── Pain / Gain tooltip ───────────────────────────────────────────────────────

function PainGainTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="h-4 w-4 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 z-50 w-[340px] rounded-xl border border-border bg-card shadow-xl p-4 text-xs pointer-events-none">
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                <p className="font-bold text-rose-600">Pain</p>
              </div>
              <p className="text-muted-foreground leading-relaxed">The economic costs or risks a product helps the customer reduce or avoid.</p>
              <p className="text-muted-foreground mt-1.5 leading-relaxed"><span className="font-semibold text-foreground/70">Examples:</span> reducing operating costs, preventing lost revenue, eliminating wasted employee time, lowering customer churn, reducing costly errors, minimizing downtime, avoiding compliance penalties, preventing project delays, capturing missed opportunities, or reducing the cost of maintaining the status quo.</p>
            </div>
            <div className="border-t border-border/50" />
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                <p className="font-bold text-emerald-600">Gain</p>
              </div>
              <p className="text-muted-foreground leading-relaxed">The economic value or upside a product helps the customer create or realize.</p>
              <p className="text-muted-foreground mt-1.5 leading-relaxed"><span className="font-semibold text-foreground/70">Examples:</span> increasing revenue, improving profit margins, boosting productivity, accelerating time to market, strengthening customer retention, generating more sales opportunities, improving resource utilization, shortening time to value, or enabling growth without equivalent increases in cost.</p>
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-border" />
          <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-px w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-card" />
        </div>
      )}
    </div>
  );
}

// ── Voice Profile card ───────────────────────────────────────────────────────

function VoiceProfileCard({
  summary, loading, onRefresh, onSave, hasInputs, textDirty,
}: {
  summary: string;
  loading: boolean;
  onRefresh: () => void;
  onSave: (text: string) => void;
  hasInputs: boolean;
  textDirty: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(summary);
    setIsEditing(true);
  }
  function cancelEdit() {
    setIsEditing(false);
    setDraft("");
  }
  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    setIsEditing(false);
    setDraft("");
  }

  if (!hasInputs && !loading && !summary) return null;

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-colors",
      isEditing
        ? "border-violet-400 bg-violet-50/90"
        : textDirty && summary && !loading
          ? "border-violet-300 bg-violet-50/80"
          : "border-violet-200 bg-violet-50/60"
    )}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-violet-200/60">
        <div className="h-6 w-6 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700 flex-1">Your Voice Profile</span>
        {!isEditing && textDirty && summary && !loading && (
          <span className="text-[10px] text-violet-500 mr-1">Text updated — save fields to refresh</span>
        )}
        {!isEditing && !loading && summary && (
          <button
            onClick={startEdit}
            title="Edit profile"
            className="h-6 w-6 rounded-md flex items-center justify-center text-violet-400 hover:text-violet-700 hover:bg-violet-100 transition-colors"
          >
            <PenLine className="h-3 w-3" />
          </button>
        )}
        {!isEditing && (
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Regenerate"
            className="h-6 w-6 rounded-md flex items-center justify-center text-violet-500 hover:text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </button>
        )}
      </div>

      <div className="px-4 py-3.5">
        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-3.5 bg-violet-200/60 rounded-full animate-pulse w-full" />
            <div className="h-3.5 bg-violet-200/60 rounded-full animate-pulse w-[88%]" />
            <div className="h-3.5 bg-violet-200/60 rounded-full animate-pulse w-[72%]" />
          </div>
        ) : isEditing ? (
          <div className="flex flex-col gap-2.5">
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm text-violet-900 placeholder:text-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-400 leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelEdit}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-violet-500 hover:text-violet-700 hover:bg-violet-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={commitEdit}
                disabled={!draft.trim()}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-violet-900/80 leading-relaxed">{summary}</p>
        )}
      </div>
    </div>
  );
}

// ── CustomerCard ─────────────────────────────────────────────────────────────

function CustomerCard({
  customer, idx, onUpdate, onRemove, onAddEB, onUpdateEB, onRemoveEB,
}: {
  customer: Customer; idx: number;
  onUpdate: (patch: Partial<Customer>) => void;
  onRemove: () => void;
  onAddEB: () => void;
  onUpdateEB: (benefitId: string, patch: Partial<EconomicBenefit>) => void;
  onRemoveEB: (benefitId: string) => void;
}) {
  const [extracting, setExtracting] = useState(false);
  const [showSource, setShowSource] = useState(!customer.customerProfile);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExtract() {
    if (!customer.rawTestimonial.trim()) return;
    setExtracting(true);
    try {
      const resp = await fetch("/api/dna/testimonial-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customer.rawTestimonial }),
      });
      const extracted = await resp.json();
      onUpdate(extracted);
      setShowSource(false);
    } catch { /* ignore */ }
    setExtracting(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await fetch("/api/dna/extract-text", { method: "POST", body: formData });
      const data = await resp.json();
      onUpdate({ rawTestimonial: (customer.rawTestimonial ? customer.rawTestimonial + "\n\n" : "") + (data.text ?? "") });
    } catch { /* ignore */ }
    e.target.value = "";
  }

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer {idx + 1}</span>
        <div className="flex-1" />
        <button onClick={onRemove} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Source */}
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <button
            className="flex items-center gap-2 w-full px-3.5 py-2.5 bg-card text-left hover:bg-secondary/30 transition-colors"
            onClick={() => setShowSource(v => !v)}
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs font-semibold text-foreground flex-1">Source testimonial or case study</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !showSource && "-rotate-90")} />
          </button>
          {showSource && (
            <div className="p-3.5 border-t border-border/40 flex flex-col gap-2.5 bg-secondary/10">
              <textarea
                value={customer.rawTestimonial}
                onChange={e => onUpdate({ rawTestimonial: e.target.value })}
                rows={5}
                placeholder="Paste a testimonial, case study excerpt, call transcript, or win-loss note here…"
                className="w-full resize-y rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 leading-relaxed transition-colors"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFile} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Upload className="h-3 w-3" />
                  Upload PDF / DOCX / TXT
                </button>
                <button
                  onClick={handleExtract}
                  disabled={!customer.rawTestimonial.trim() || extracting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-violet-50 border-violet-200 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {extracting ? "Extracting…" : "Extract key details"}
                </button>
                {extracting && <span className="text-[10px] text-muted-foreground">AI is reading your testimonial…</span>}
              </div>
            </div>
          )}
        </div>

        {/* Structured fields */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer profile" hint="Company, industry, role, size">
            <Textarea value={customer.customerProfile} onChange={v => onUpdate({ customerProfile: v })} placeholder="e.g. Mid-market SaaS company, 200-person team, VP of Revenue Operations" rows={2} />
          </Field>
          <Field label="Starting situation" hint="The before state">
            <Textarea value={customer.startingSituation} onChange={v => onUpdate({ startingSituation: v })} placeholder="e.g. Spending 3+ hours per rep per day manually researching prospects before outreach…" rows={2} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer priorities" hint="What they were trying to achieve">
            <Textarea value={customer.customerPriorities} onChange={v => onUpdate({ customerPriorities: v })} placeholder="e.g. Reduce research time, increase pipeline quality, scale personalisation without adding headcount…" rows={2} />
          </Field>
          <Field label="Solution provided" hint="What was done for them">
            <Textarea value={customer.solutionProvided} onChange={v => onUpdate({ solutionProvided: v })} placeholder="e.g. Deployed Whyhello across the full SDR team with Salesforce integration…" rows={2} />
          </Field>
        </div>
        <Field label="Customer transformation" hint="The after state — how their situation changed">
          <Textarea value={customer.customerTransformation} onChange={v => onUpdate({ customerTransformation: v })} placeholder="e.g. The team now enters every first call with full context on the buyer's priorities, recent news, and relationship history. Research is automated." rows={2} />
        </Field>
        <Field label="Results" hint="Specific measurable outcomes">
          <Textarea value={customer.results} onChange={v => onUpdate({ results: v })} placeholder={"3× increase in qualified meetings booked\n80% reduction in prospect research time\n47% higher email reply rates"} rows={3} />
        </Field>

        {/* Economic benefits */}
        <div className="pt-3 border-t border-border/40">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="h-3 w-3 text-amber-600" />
            </div>
            <p className="text-xs font-bold text-foreground">Economic Benefits</p>
            <PainGainTooltip />
            <p className="text-[10px] text-muted-foreground">Quantify the value delivered to this customer</p>
          </div>
          {(customer.economicBenefits ?? []).length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-4 rounded-xl border border-dashed border-border/60 text-center mb-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground/60">No economic benefits added yet</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {(customer.economicBenefits ?? []).map(eb => (
              <div key={eb.id} className={cn("rounded-xl border p-3.5 flex flex-col gap-3", eb.type === "pain" ? "border-rose-200 bg-rose-50/30" : "border-emerald-200 bg-emerald-50/30")}>
                <div className="flex items-center gap-2">
                  <button onClick={() => onUpdateEB(eb.id, { type: "pain" })} className={cn("flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all", eb.type === "pain" ? "bg-rose-100 border-rose-300 text-rose-700" : "bg-card border-border/60 text-muted-foreground hover:border-rose-200 hover:text-rose-600")}>
                    <TrendingDown className="h-3 w-3" />Pain
                  </button>
                  <button onClick={() => onUpdateEB(eb.id, { type: "gain" })} className={cn("flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all", eb.type === "gain" ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "bg-card border-border/60 text-muted-foreground hover:border-emerald-200 hover:text-emerald-600")}>
                    <TrendingUp className="h-3 w-3" />Gain
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => onRemoveEB(eb.id)} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{eb.type === "pain" ? "Cost or risk reduced" : "Value or upside created"}</label>
                  <textarea value={eb.description} onChange={e => onUpdateEB(eb.id, { description: e.target.value })} rows={2} placeholder={eb.type === "pain" ? "e.g. Eliminated manual research time per rep" : "e.g. Increased qualified pipeline per quarter"} className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 leading-relaxed transition-colors" />
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Amount</label>
                    <input type="text" value={eb.amount} onChange={e => onUpdateEB(eb.id, { amount: e.target.value })} placeholder="e.g. 50,000" className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit</label>
                    <input type="text" value={eb.unit} onChange={e => onUpdateEB(eb.id, { unit: e.target.value })} placeholder="$" className="h-9 w-20 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors text-center" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Frequency</label>
                    <select value={eb.frequency} onChange={e => onUpdateEB(eb.id, { frequency: e.target.value })} className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors">
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="one-time">One-time</option>
                      <option value="per-transaction">Per transaction</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onAddEB} className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border hover:border-amber-300 hover:bg-amber-50/50 text-xs font-semibold text-muted-foreground hover:text-amber-700 transition-all">
            <Plus className="h-3.5 w-3.5" />Add economic benefit
          </button>
        </div>

        {/* Quote */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-3 w-3 text-indigo-500" />
            </div>
            <label className="text-xs font-bold text-foreground">Customer Quote</label>
            <span className="text-[10px] text-muted-foreground">The most compelling thing they said — verbatim</span>
          </div>
          <Textarea value={customer.customerQuote} onChange={v => onUpdate({ customerQuote: v })} placeholder={`"We cut our prospect research time by 80% in the first month. The team couldn't believe it was the same job."`} rows={3} />
        </div>
      </div>
    </div>
  );
}

// ── CompetitorCard ────────────────────────────────────────────────────────────

function CompetitorCard({
  competitor, idx, onUpdate, onRemove,
}: {
  competitor: Competitor; idx: number;
  onUpdate: (patch: Partial<Competitor>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {competitor.name || `Competitor ${idx + 1}`}
        </span>
        <div className="flex-1" />
        <button onClick={onRemove} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4 flex flex-col gap-4">
        {/* Basic info */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Competitor name">
            <Input value={competitor.name} onChange={v => onUpdate({ name: v })} placeholder="e.g. Outreach.io" />
          </Field>
          <Field label="Website">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                value={competitor.website}
                onChange={e => onUpdate({ website: e.target.value })}
                placeholder="e.g. outreach.io"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>
          </Field>
          <Field label="Product / solution compared">
            <Input value={competitor.productCompared} onChange={v => onUpdate({ productCompared: v })} placeholder="e.g. Sales engagement platform" />
          </Field>
        </div>

        {/* Category + frequency */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Competitive category">
            <div className="flex flex-wrap gap-1.5">
              {["Direct", "Indirect", "Substitute", "Status quo"].map(opt => (
                <button
                  key={opt}
                  onClick={() => onUpdate({ category: opt === competitor.category ? "" : opt })}
                  className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                    competitor.category === opt ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/60"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Field>
          <Field label="How often in deals">
            <div className="flex flex-wrap gap-1.5">
              {["Rarely", "Sometimes", "Often", "Constantly"].map(opt => (
                <button
                  key={opt}
                  onClick={() => onUpdate({ dealFrequency: opt === competitor.dealFrequency ? "" : opt })}
                  className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                    competitor.dealFrequency === opt ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/60"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Market segments where they compete" hint="Industries, company sizes, geographies">
          <Textarea value={competitor.marketSegments} onChange={v => onUpdate({ marketSegments: v })} placeholder="e.g. Mid-market SaaS, US-based, 200–2000 employees" rows={2} />
        </Field>

        <Field label="Notes, battlecards & win-loss intelligence" hint="Observations, call notes, supporting documents">
          <Textarea value={competitor.notes} onChange={v => onUpdate({ notes: v })} placeholder="Paste battlecard content, call notes, win-loss observations, or any other intelligence here…" rows={3} />
        </Field>

        {/* Their strengths */}
        <div className="rounded-xl border border-rose-200/70 bg-rose-50/20 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-5 rounded-md bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-3 w-3 text-rose-500" />
            </div>
            <p className="text-xs font-bold text-rose-700">Where they are stronger</p>
            <span className="text-[10px] text-muted-foreground">Be honest — this makes your positioning more credible</span>
          </div>
          <Field label="What do they do better than us?">
            <Textarea value={competitor.theirStrengths} onChange={v => onUpdate({ theirStrengths: v })} placeholder="e.g. More mature integrations ecosystem, stronger brand recognition in enterprise, larger customer base…" rows={2} />
          </Field>
          <Field label="Which buyers are likely to prefer them?">
            <Textarea value={competitor.buyersPreferThem} onChange={v => onUpdate({ buyersPreferThem: v })} placeholder="e.g. Large enterprises already deep in Salesforce, buyers who prioritise vendor brand risk…" rows={2} />
          </Field>
          <Field label="Under what circumstances are they the better choice?">
            <Textarea value={competitor.theyAreBetterWhen} onChange={v => onUpdate({ theyAreBetterWhen: v })} placeholder="e.g. When the buyer needs 200+ native integrations out of the box, or has complex multi-team approval workflows…" rows={2} />
          </Field>
          <Field label="What claims should we avoid making against them?">
            <Textarea value={competitor.avoidClaiming} onChange={v => onUpdate({ avoidClaiming: v })} placeholder="e.g. Avoid claiming we're more scalable — their enterprise track record is stronger and buyers know it…" rows={2} />
          </Field>
        </div>

        {/* Our strengths */}
        <div className="rounded-xl border border-blue-200/70 bg-blue-50/20 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-5 rounded-md bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <Shield className="h-3 w-3 text-blue-500" />
            </div>
            <p className="text-xs font-bold text-blue-700">Where we are stronger</p>
          </div>
          <Field label="What do we do better than them?">
            <Textarea value={competitor.ourStrengths} onChange={v => onUpdate({ ourStrengths: v })} placeholder="e.g. Deeper relationship intelligence, faster time-to-value, AI that writes in the user's actual voice…" rows={2} />
          </Field>
          <Field label="Which customer problems expose their weaknesses?">
            <Textarea value={competitor.problemsExposingWeakness} onChange={v => onUpdate({ problemsExposingWeakness: v })} placeholder="e.g. When the pain is personalisation at scale, their template-driven approach becomes a weakness…" rows={2} />
          </Field>
          <Field label="Which buyers are most likely to prefer us?">
            <Textarea value={competitor.buyersPreferUs} onChange={v => onUpdate({ buyersPreferUs: v })} placeholder="e.g. Growth-stage SaaS, VP Sales focused on quality over volume, teams without a dedicated data team…" rows={2} />
          </Field>
          <Field label="What advantages appear over time rather than immediately?">
            <Textarea value={competitor.advantagesOverTime} onChange={v => onUpdate({ advantagesOverTime: v })} placeholder="e.g. As the AI learns the user's voice across campaigns, output quality compounds in ways competitors can't replicate…" rows={2} />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ── DeptSelector ──────────────────────────────────────────────────────────────

function DeptSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const toggle = (dept: string) =>
    onChange(selected.includes(dept) ? selected.filter(d => d !== dept) : [...selected, dept]);

  const filtered = DEPARTMENT_OPTIONS.filter(d =>
    d.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Department</span>
      <div className="flex flex-wrap gap-1.5 items-center">
        {selected.map(dept => (
          <button
            key={dept}
            onClick={() => toggle(dept)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-100 border border-indigo-300 text-indigo-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
          >
            {dept}
            <X className="h-2.5 w-2.5" />
          </button>
        ))}
        <div ref={wrapperRef} className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-dashed border-border hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 text-muted-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
          {open && (
            <div className="absolute top-8 left-0 z-20 w-52 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
              <div className="p-2 border-b border-border/50">
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search departments…"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">No results</p>
                ) : filtered.map(dept => (
                  <button
                    key={dept}
                    onClick={() => { toggle(dept); if (!selected.includes(dept)) setSearch(""); }}
                    className={cn(
                      "w-full text-left text-xs px-3 py-1.5 flex items-center gap-2 transition-colors",
                      selected.includes(dept)
                        ? "bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100"
                        : "text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <span className={cn(
                      "h-3.5 w-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors",
                      selected.includes(dept) ? "bg-indigo-500 border-indigo-500" : "border-border/60"
                    )}>
                      {selected.includes(dept) && (
                        <svg className="h-2 w-2 text-white" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BuyingCenterTile ──────────────────────────────────────────────────────────

function BuyingCenterTile({ seat, onClick }: { seat: BuyingCenterSeat; onClick: () => void }) {
  const def = BUYING_CENTER_SEATS.find(s => s.seat === seat.seat)!;
  const isConfigured = seat.seniorities.length > 0 || seat.departments.length > 0;
  const colors = COLOR_MAP[def.color] ?? COLOR_MAP.slate;
  const Icon = def.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        isConfigured
          ? cn(colors.bg, colors.border)
          : "bg-card border-border/60 hover:border-indigo-200 hover:bg-indigo-50/30"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "h-9 w-9 rounded-lg flex items-center justify-center border transition-colors",
        isConfigured
          ? cn(colors.iconBg, colors.border)
          : "bg-secondary/50 border-border/40 group-hover:bg-indigo-50 group-hover:border-indigo-200"
      )}>
        <Icon className={cn(
          "h-4 w-4 transition-colors",
          isConfigured ? colors.iconColor : "text-muted-foreground/50 group-hover:text-indigo-500"
        )} />
      </div>

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-bold leading-snug",
          isConfigured ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground transition-colors"
        )}>
          {seat.seat}
        </p>
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-0.5 line-clamp-2">
          {def.role}
        </p>
      </div>

      {/* Status footer */}
      <div className="border-t border-black/5 pt-2.5 min-h-[2rem]">
        {isConfigured ? (
          <div className="flex flex-col gap-1">
            {seat.seniorities.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {seat.seniorities.slice(0, 2).map(s => (
                  <span key={s} className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                    colors.chipBg, colors.chipBorder, colors.chipText
                  )}>
                    {s === "Individual Contributor" ? "IC" : s}
                  </span>
                ))}
                {seat.seniorities.length > 2 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                    colors.chipBg, colors.chipBorder, colors.chipText
                  )}>
                    +{seat.seniorities.length - 2}
                  </span>
                )}
              </div>
            )}
            {seat.departments.length > 0 && (
              <p className="text-[10px] text-muted-foreground/60 truncate leading-tight">
                {seat.departments.slice(0, 2).join(", ")}{seat.departments.length > 2 ? ` +${seat.departments.length - 2}` : ""}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/30 group-hover:text-indigo-400 transition-colors">
            Click to configure →
          </p>
        )}
      </div>
    </button>
  );
}

// ── BuyingCenterModal ─────────────────────────────────────────────────────────

function BuyingCenterModal({ seatName, seniorities, departments, onUpdate, open, onClose }: {
  seatName: string;
  seniorities: string[];
  departments: string[];
  onUpdate: (patch: { seniorities?: string[]; departments?: string[] }) => void;
  open: boolean;
  onClose: () => void;
}) {
  const def = BUYING_CENTER_SEATS.find(s => s.seat === seatName);
  if (!def) return null;
  const colors = COLOR_MAP[def.color] ?? COLOR_MAP.slate;
  const Icon = def.icon;

  const toggleSeniority = (s: string) =>
    onUpdate({ seniorities: seniorities.includes(s) ? seniorities.filter(x => x !== s) : [...seniorities, s] });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[480px]">
        <div className="flex flex-col gap-5 pt-1">

          {/* Header */}
          <div className="flex items-center gap-3 pr-6">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0",
              colors.iconBg, colors.border
            )}>
              <Icon className={cn("h-5 w-5", colors.iconColor)} />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold leading-snug">{seatName}</DialogTitle>
              <DialogDescription className="text-[11px] mt-0.5 leading-relaxed">{def.role}</DialogDescription>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Seniority */}
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Seniority</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Select all levels that typically fill this seat</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SENIORITY_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSeniority(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                    seniorities.includes(s)
                      ? cn(colors.chipBg, colors.chipBorder, colors.chipText)
                      : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Department</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Select departments where this role is typically found</p>
            </div>
            <DeptSelector selected={departments} onChange={v => onUpdate({ departments: v })} />
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-border/40 pt-3 -mb-1">
            <button
              onClick={onClose}
              className={cn(
                "px-5 py-2 rounded-lg text-white text-sm font-semibold transition-colors",
                def.color === "violet"  && "bg-violet-600 hover:bg-violet-700",
                def.color === "emerald" && "bg-emerald-600 hover:bg-emerald-700",
                def.color === "blue"    && "bg-blue-600 hover:bg-blue-700",
                def.color === "amber"   && "bg-amber-500 hover:bg-amber-600",
                def.color === "slate"   && "bg-slate-600 hover:bg-slate-700",
                def.color === "sky"     && "bg-sky-600 hover:bg-sky-700",
                def.color === "rose"    && "bg-rose-600 hover:bg-rose-700",
              )}
            >
              Done
            </button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DNA() {
  const [data, setData] = useState<DNAData>(loadDNA);
  const saved = useAutoSave(data);

  // Load from server on mount — server is the source of truth; localStorage is the fast startup cache
  useEffect(() => {
    let cancelled = false;
    fetch(API_PROFILE_URL)
      .then(r => (r.ok ? r.json() : null))
      .then((json: { data: Partial<DNAData> } | null) => {
        if (!cancelled && json?.data) {
          setData(mergeDNA(json.data));
        }
      })
      .catch(() => { /* not authenticated or API unavailable — localStorage data is fine */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeSeat, setActiveSeat] = useState<string | null>(null);

  function updateBuyingCenterSeat(seatName: string, patch: { seniorities?: string[]; departments?: string[] }) {
    setData(d => ({
      ...d,
      buyingCenter: (d.buyingCenter ?? []).map(s =>
        s.seat === seatName ? { ...s, ...patch } : s
      ),
    }));
  }

  // Voice profile AI summary
  const SUMMARY_KEY = "whyhello_voice_summary";
  const [voiceSummary, setVoiceSummaryState] = useState<string>(() => localStorage.getItem(SUMMARY_KEY) ?? "");
  const [voiceSummaryLoading, setVoiceSummaryLoading] = useState(false);
  function setVoiceSummary(text: string) {
    setVoiceSummaryState(text);
    if (text) localStorage.setItem(SUMMARY_KEY, text);
    else localStorage.removeItem(SUMMARY_KEY);
  }
  // True when text fields have changed since the last profile generation
  const [textDirtyForProfile, setTextDirtyForProfile] = useState(false);
  const mountedRef = useRef(false);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Setters ──────────────────────────────────────────────────────────────

  function setVoice(patch: Partial<DNAData["voice"]>) {
    setData(d => ({ ...d, voice: { ...d.voice, ...patch } }));
  }
  function setCompany(patch: Partial<DNAData["company"]>) {
    setData(d => ({ ...d, company: { ...d.company, ...patch } }));
  }
  function setPillar(i: 0 | 1 | 2, v: string) {
    setData(d => {
      const pillars = [...d.company.pillars] as [string, string, string];
      pillars[i] = v;
      return { ...d, company: { ...d.company, pillars } };
    });
  }
  function addProduct() {
    const p: Product = { id: crypto.randomUUID(), name: "", tagline: "", features: "", outcomes: "", persona: "", economicBenefits: [] };
    setData(d => ({ ...d, products: [...d.products, p] }));
  }
  function updateProduct(id: string, patch: Partial<Product>) {
    setData(d => ({ ...d, products: d.products.map(p => p.id === id ? { ...p, ...patch } : p) }));
  }
  function removeProduct(id: string) {
    setData(d => ({ ...d, products: d.products.filter(p => p.id !== id) }));
  }
  function addEconomicBenefit(productId: string) {
    const eb: EconomicBenefit = { id: crypto.randomUUID(), type: "pain", description: "", amount: "", unit: "$", frequency: "yearly" };
    setData(d => ({ ...d, products: d.products.map(p => p.id === productId ? { ...p, economicBenefits: [...(p.economicBenefits ?? []), eb] } : p) }));
  }
  function updateEconomicBenefit(productId: string, benefitId: string, patch: Partial<EconomicBenefit>) {
    setData(d => ({ ...d, products: d.products.map(p => p.id === productId ? { ...p, economicBenefits: (p.economicBenefits ?? []).map(eb => eb.id === benefitId ? { ...eb, ...patch } : eb) } : p) }));
  }
  function removeEconomicBenefit(productId: string, benefitId: string) {
    setData(d => ({ ...d, products: d.products.map(p => p.id === productId ? { ...p, economicBenefits: (p.economicBenefits ?? []).filter(eb => eb.id !== benefitId) } : p) }));
  }
  // ── Customer helpers ──
  function addCustomer() {
    const c: Customer = { id: crypto.randomUUID(), rawTestimonial: "", customerProfile: "", startingSituation: "", customerPriorities: "", solutionProvided: "", customerTransformation: "", results: "", economicBenefits: [], customerQuote: "" };
    setData(d => ({ ...d, customers: [...d.customers, c] }));
  }
  function updateCustomer(id: string, patch: Partial<Customer>) {
    setData(d => ({ ...d, customers: d.customers.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }
  function removeCustomer(id: string) {
    setData(d => ({ ...d, customers: d.customers.filter(c => c.id !== id) }));
  }
  function addCustomerEB(customerId: string) {
    const eb: EconomicBenefit = { id: crypto.randomUUID(), type: "gain", description: "", amount: "", unit: "$", frequency: "yearly" };
    setData(d => ({ ...d, customers: d.customers.map(c => c.id === customerId ? { ...c, economicBenefits: [...(c.economicBenefits ?? []), eb] } : c) }));
  }
  function updateCustomerEB(customerId: string, benefitId: string, patch: Partial<EconomicBenefit>) {
    setData(d => ({ ...d, customers: d.customers.map(c => c.id === customerId ? { ...c, economicBenefits: (c.economicBenefits ?? []).map(eb => eb.id === benefitId ? { ...eb, ...patch } : eb) } : c) }));
  }
  function removeCustomerEB(customerId: string, benefitId: string) {
    setData(d => ({ ...d, customers: d.customers.map(c => c.id === customerId ? { ...c, economicBenefits: (c.economicBenefits ?? []).filter(eb => eb.id !== benefitId) } : c) }));
  }
  // ── Market position ──
  function setMarketPosition(patch: Partial<MarketPosition>) {
    setData(d => ({ ...d, marketPosition: { ...d.marketPosition, ...patch } }));
  }
  // ── Competitor helpers ──
  function addCompetitor() {
    const c: Competitor = { id: crypto.randomUUID(), name: "", website: "", productCompared: "", category: "", marketSegments: "", dealFrequency: "", notes: "", theirStrengths: "", buyersPreferThem: "", theyAreBetterWhen: "", avoidClaiming: "", ourStrengths: "", problemsExposingWeakness: "", buyersPreferUs: "", advantagesOverTime: "" };
    setData(d => ({ ...d, competitors: [...d.competitors, c] }));
  }
  function updateCompetitor(id: string, patch: Partial<Competitor>) {
    setData(d => ({ ...d, competitors: d.competitors.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }
  function removeCompetitor(id: string) {
    setData(d => ({ ...d, competitors: d.competitors.filter(c => c.id !== id) }));
  }
  function toggleTag(tag: string) {
    setData(d => {
      const has = d.voice.toneTags.includes(tag);
      return { ...d, voice: { ...d.voice, toneTags: has ? d.voice.toneTags.filter(t => t !== tag) : [...d.voice.toneTags, tag] } };
    });
  }
  function toggleSuppression(tag: string) {
    setData(d => {
      const has = d.voice.suppressions.includes(tag);
      return { ...d, voice: { ...d.voice, suppressions: has ? d.voice.suppressions.filter(t => t !== tag) : [...d.voice.suppressions, tag] } };
    });
  }

  // ── Voice profile generation ─────────────────────────────────────────────

  // Takes explicit voice snapshot so callers are never affected by stale closures
  async function generateVoiceSummary(voice: DNAData["voice"]) {
    const { toneTags, communicationStyle, writingNotes, trainingText, suppressions, suppressionNotes } = voice;
    const hasInputs = toneTags.length > 0 || !!communicationStyle || !!writingNotes || !!trainingText || suppressions.length > 0 || !!suppressionNotes;
    if (!hasInputs) { setVoiceSummary(""); return; }

    setVoiceSummaryLoading(true);
    setTextDirtyForProfile(false);
    try {
      const resp = await fetch("/api/dna/voice-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toneTags, communicationStyle, writingNotes, trainingText, suppressions, suppressionNotes }),
      });
      const json = await resp.json() as { summary: string };
      setVoiceSummary(json.summary ?? "");
    } catch {
      setVoiceSummary("Unable to generate summary right now.");
    } finally {
      setVoiceSummaryLoading(false);
    }
  }

  // Auto-regen when pill pickers change (immediate user actions, not typing).
  // Skip the very first render to avoid firing on page load.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    generateVoiceSummary(data.voice);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.voice.toneTags, data.voice.communicationStyle, data.voice.suppressions]);

  // When text fields change, just mark the profile as potentially stale.
  // The user triggers regen explicitly via the Save button.
  useEffect(() => {
    if (!mountedRef.current) return;
    setTextDirtyForProfile(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.voice.writingNotes, data.voice.trainingText]);

  // ── File upload handling ─────────────────────────────────────────────────

  async function processFile(file: File) {
    const name = file.name;
    const allowed = name.endsWith(".txt") || name.endsWith(".docx") || name.endsWith(".pdf");
    if (!allowed) return;

    setUploadedFiles(prev => [...prev, { name, status: "processing" }]);

    try {
      const form = new FormData();
      form.append("file", file);
      const resp = await fetch("/api/dna/extract-text", { method: "POST", body: form });
      if (!resp.ok) throw new Error("Extraction failed");
      const { text } = await resp.json() as { text: string };
      setData(d => ({
        ...d,
        voice: {
          ...d.voice,
          trainingText: d.voice.trainingText
            ? d.voice.trainingText + "\n\n---\n\n" + text
            : text,
        },
      }));
      setUploadedFiles(prev => prev.map(f => f.name === name ? { ...f, status: "done" } : f));
    } catch {
      setUploadedFiles(prev => prev.map(f => f.name === name ? { ...f, status: "error" } : f));
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(processFile);
  }

  const voiceHasInputs =
    data.voice.toneTags.length > 0 ||
    !!data.voice.communicationStyle ||
    !!data.voice.writingNotes ||
    !!data.voice.trainingText ||
    data.voice.suppressions.length > 0 ||
    !!data.voice.suppressionNotes;

  return (
    <Shell>
      <div className="max-w-3xl mx-auto py-10 px-4 flex flex-col gap-8">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Dna className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">DNA</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your training ground — voice, products, and company context for every AI interaction.
              </p>
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-all duration-300",
            saved
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-muted-foreground bg-secondary border-border/50"
          )}>
            {saved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? "Saved" : "Auto-saving"}
          </div>
        </div>

        {/* ── Voice & Tone ── */}
        <Section
          icon={Mic2}
          title="Your Voice & Tone"
          subtitle="How you communicate — personality, style, and language patterns"
          accentBg="bg-violet-50"
          accentBorder="border-violet-200"
          accentColor="text-violet-600"
        >
          <Field label="Tone tags" hint="Select all that apply">
            <div className="flex flex-wrap gap-2">
              {TONE_SUGGESTIONS.map(tag => {
                const active = data.voice.toneTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                      active
                        ? "bg-violet-100 border-violet-300 text-violet-700"
                        : "bg-background border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Communication style">
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(opt => {
                const active = data.voice.communicationStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setVoice({ communicationStyle: opt.value })}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      active
                        ? "bg-violet-100 border-violet-300 text-violet-700"
                        : "bg-background border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Writing style notes" hint="Describe your natural voice in detail">
            <Textarea
              value={data.voice.writingNotes}
              onChange={v => setVoice({ writingNotes: v })}
              placeholder="e.g. I keep sentences short and punchy. I avoid jargon. I like to lead with a question that makes the reader think…"
              rows={4}
            />
            <SaveFieldButton
              show={!!data.voice.writingNotes}
              onSave={() => generateVoiceSummary(data.voice)}
            />
          </Field>

          {/* Training communications */}
          <Field
            label="Training communications"
            hint="Paste emails, messages, or any writing you want Whyhello to learn from"
          >
            <Textarea
              value={data.voice.trainingText}
              onChange={v => setVoice({ trainingText: v })}
              placeholder={`Paste previous emails, LinkedIn messages, proposals, or any writing that reflects how you genuinely communicate. The more you share, the more accurately Whyhello can write in your voice.\n\nYou can also upload .txt, .docx, or .pdf files below — the extracted text will be added here automatically.`}
              rows={10}
            />
            <SaveFieldButton
              show={!!data.voice.trainingText}
              onSave={() => generateVoiceSummary(data.voice)}
            />
          </Field>

          {/* File upload zone */}
          <div className="flex flex-col gap-2">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center gap-2.5 py-5 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all",
                dragOver
                  ? "border-violet-400 bg-violet-50"
                  : "border-border/50 hover:border-violet-300 hover:bg-violet-50/40"
              )}
            >
              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center border transition-colors",
                dragOver ? "bg-violet-100 border-violet-300" : "bg-secondary border-border/60"
              )}>
                <Upload className={cn("h-4 w-4", dragOver ? "text-violet-600" : "text-muted-foreground")} />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">
                  {dragOver ? "Drop to upload" : "Upload files"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">.txt · .docx · .pdf · up to 15 MB each</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {/* Uploaded file pills */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {uploadedFiles.map((f, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-all",
                      f.status === "processing" && "bg-secondary border-border/50 text-muted-foreground",
                      f.status === "done" && "bg-emerald-50 border-emerald-200 text-emerald-700",
                      f.status === "error" && "bg-red-50 border-red-200 text-red-600",
                    )}
                  >
                    {f.status === "processing"
                      ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      : <FileText className="h-2.5 w-2.5" />
                    }
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    {f.status === "done" && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {f.status === "error" && <span className="opacity-70">failed</span>}
                    <button
                      onClick={e => { e.stopPropagation(); setUploadedFiles(prev => prev.filter((_, j) => j !== i)); }}
                      className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suppression / Do-not-use */}
          <div className="flex flex-col gap-4 rounded-xl border border-rose-200/60 bg-rose-50/30 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0">
                <Ban className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">Suppression list</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Patterns, words, or conventions to never appear in your voice</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {SUPPRESSION_SUGGESTIONS.map(tag => {
                const active = data.voice.suppressions.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleSuppression(tag)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                      active
                        ? "bg-rose-100 border-rose-300 text-rose-700"
                        : "bg-background border-border/60 text-muted-foreground hover:border-rose-200 hover:text-rose-700 hover:bg-rose-50"
                    )}
                  >
                    {active && <span className="mr-1 opacity-60">✕</span>}{tag}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Additional suppressions</label>
              <textarea
                value={data.voice.suppressionNotes}
                onChange={e => setVoice({ suppressionNotes: e.target.value })}
                rows={3}
                placeholder="Anything else to avoid — phrases, structural habits, or stylistic tics you want to leave behind…"
                className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-rose-300/40 leading-relaxed transition-colors"
              />
              <SaveFieldButton
                show={!!data.voice.suppressionNotes}
                onSave={() => generateVoiceSummary(data.voice)}
              />
            </div>
          </div>

          {/* AI Voice Profile card */}
          <VoiceProfileCard
            summary={voiceSummary}
            loading={voiceSummaryLoading}
            onRefresh={() => generateVoiceSummary(data.voice)}
            onSave={setVoiceSummary}
            hasInputs={voiceHasInputs}
            textDirty={textDirtyForProfile}
          />
        </Section>

        {/* ── Products ── */}
        <Section
          icon={Package}
          title="Your Products"
          subtitle="Features, benefits, and key outcomes — one card per product or offering"
          accentBg="bg-blue-50"
          accentBorder="border-blue-200"
          accentColor="text-blue-600"
        >
          {data.products.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No products yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add your first product or offering below</p>
              </div>
            </div>
          )}

          {data.products.map((product, idx) => (
            <div key={product.id} className="rounded-xl border border-border/60 bg-secondary/20 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Product {idx + 1}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => removeProduct(product.id)}
                  className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Product / offering name">
                    <Input
                      value={product.name}
                      onChange={v => updateProduct(product.id, { name: v })}
                      placeholder="e.g. Growth Intelligence Platform"
                    />
                  </Field>
                  <Field label="One-line tagline">
                    <Input
                      value={product.tagline}
                      onChange={v => updateProduct(product.id, { tagline: v })}
                      placeholder="e.g. Pipeline from signal, not spray"
                    />
                  </Field>
                </div>
                <Field label="Key features & benefits" hint="One per line">
                  <Textarea
                    value={product.features}
                    onChange={v => updateProduct(product.id, { features: v })}
                    placeholder={"AI-powered contact intelligence\nReal-time buying signal detection\nNative CRM sync (Salesforce, HubSpot)"}
                    rows={4}
                  />
                </Field>
                <Field label="Key outcomes for buyers" hint="What do customers actually get?">
                  <Textarea
                    value={product.outcomes}
                    onChange={v => updateProduct(product.id, { outcomes: v })}
                    placeholder={"3× faster pipeline generation\nReduce research time by 80%\nHigher reply rates through personalisation"}
                    rows={3}
                  />
                </Field>
                <Field label="Target persona" hint="Who is this for?">
                  <Input
                    value={product.persona}
                    onChange={v => updateProduct(product.id, { persona: v })}
                    placeholder="e.g. VP Sales at B2B SaaS companies, 50–500 employees"
                  />
                </Field>

                {/* ── Economic Benefits ── */}
                <div className="pt-3 border-t border-border/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-5 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-3 w-3 text-amber-600" />
                    </div>
                    <p className="text-xs font-bold text-foreground">Economic Benefits</p>
                    <PainGainTooltip />
                    <p className="text-[10px] text-muted-foreground">Quantify the value this product creates or costs it removes</p>
                  </div>

                  {(product.economicBenefits ?? []).length === 0 && (
                    <div className="flex flex-col items-center gap-1.5 py-5 rounded-xl border border-dashed border-border/60 text-center mb-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground/60">No economic benefits added yet</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {(product.economicBenefits ?? []).map(eb => (
                      <div
                        key={eb.id}
                        className={cn(
                          "rounded-xl border p-3.5 flex flex-col gap-3",
                          eb.type === "pain"
                            ? "border-rose-200 bg-rose-50/30"
                            : "border-emerald-200 bg-emerald-50/30"
                        )}
                      >
                        {/* Type toggle + remove */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateEconomicBenefit(product.id, eb.id, { type: "pain" })}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                              eb.type === "pain"
                                ? "bg-rose-100 border-rose-300 text-rose-700"
                                : "bg-card border-border/60 text-muted-foreground hover:border-rose-200 hover:text-rose-600"
                            )}
                          >
                            <TrendingDown className="h-3 w-3" />
                            Pain
                          </button>
                          <button
                            onClick={() => updateEconomicBenefit(product.id, eb.id, { type: "gain" })}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                              eb.type === "gain"
                                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                                : "bg-card border-border/60 text-muted-foreground hover:border-emerald-200 hover:text-emerald-600"
                            )}
                          >
                            <TrendingUp className="h-3 w-3" />
                            Gain
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => removeEconomicBenefit(product.id, eb.id)}
                            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            {eb.type === "pain" ? "Cost or risk reduced" : "Value or upside created"}
                          </label>
                          <textarea
                            value={eb.description}
                            onChange={e => updateEconomicBenefit(product.id, eb.id, { description: e.target.value })}
                            rows={2}
                            placeholder={eb.type === "pain"
                              ? "e.g. Eliminates manual prospect research time per rep"
                              : "e.g. Increases qualified pipeline generated per quarter"}
                            className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 leading-relaxed transition-colors"
                          />
                        </div>

                        {/* Amount + Unit + Frequency */}
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Amount</label>
                            <input
                              type="text"
                              value={eb.amount}
                              onChange={e => updateEconomicBenefit(product.id, eb.id, { amount: e.target.value })}
                              placeholder="e.g. 50,000"
                              className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit</label>
                            <input
                              type="text"
                              value={eb.unit}
                              onChange={e => updateEconomicBenefit(product.id, eb.id, { unit: e.target.value })}
                              placeholder="$"
                              className="h-9 w-20 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Frequency</label>
                            <select
                              value={eb.frequency}
                              onChange={e => updateEconomicBenefit(product.id, eb.id, { frequency: e.target.value })}
                              className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors"
                            >
                              <option value="yearly">Yearly</option>
                              <option value="monthly">Monthly</option>
                              <option value="weekly">Weekly</option>
                              <option value="one-time">One-time</option>
                              <option value="per-transaction">Per transaction</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => addEconomicBenefit(product.id)}
                    className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border hover:border-amber-300 hover:bg-amber-50/50 text-xs font-semibold text-muted-foreground hover:text-amber-700 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add economic benefit
                  </button>
                </div>

              </div>
            </div>
          ))}

          <button
            onClick={addProduct}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-blue-300 hover:bg-blue-50/50 text-sm font-semibold text-muted-foreground hover:text-blue-700 transition-all self-start"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
        </Section>

        {/* ── Customers ── */}
        <Section
          icon={Users}
          title="Your Customers"
          subtitle="Build structured testimonials from your best customer stories — used to power social proof and objection handling"
          accentBg="bg-sky-50"
          accentBorder="border-sky-200"
          accentColor="text-sky-600"
        >
          {(data.customers ?? []).length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center">
                <Users className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No customer stories yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Paste a testimonial or case study to get started — the AI will extract the key details</p>
              </div>
            </div>
          )}

          {(data.customers ?? []).map((customer, idx) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              idx={idx}
              onUpdate={patch => updateCustomer(customer.id, patch)}
              onRemove={() => removeCustomer(customer.id)}
              onAddEB={() => addCustomerEB(customer.id)}
              onUpdateEB={(benefitId, patch) => updateCustomerEB(customer.id, benefitId, patch)}
              onRemoveEB={benefitId => removeCustomerEB(customer.id, benefitId)}
            />
          ))}

          <button
            onClick={addCustomer}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-sky-300 hover:bg-sky-50/50 text-sm font-semibold text-muted-foreground hover:text-sky-700 transition-all self-start"
          >
            <Plus className="h-4 w-4" />
            Add customer
          </button>
        </Section>

        {/* ── Competitors ── */}
        <Section
          icon={Target}
          title="Your Competitors"
          subtitle="Define your market position and build an honest, balanced view of each competitor — powers credible, non-generic positioning"
          accentBg="bg-orange-50"
          accentBorder="border-orange-200"
          accentColor="text-orange-600"
        >
          {/* Market Position */}
          <div className="rounded-xl border border-border/60 bg-secondary/20 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card">
              <div className="h-6 w-6 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                <Target className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <span className="text-xs font-bold text-foreground">Our Market Position</span>
              <span className="text-[10px] text-muted-foreground ml-1">Define where you generally sit — this becomes the baseline for every competitor comparison</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {(
                [
                  { key: "pricePosition",         label: "Price position",          options: ["Budget", "Value", "Mid-market", "Premium"] },
                  { key: "productBreadth",         label: "Product breadth",         options: ["Specialized", "Balanced", "Comprehensive"] },
                  { key: "productDepth",           label: "Product depth",           options: ["Basic", "Advanced", "Best-in-class"] },
                  { key: "customerFocus",          label: "Customer focus",          options: ["SMB", "Mid-market", "Enterprise", "Multiple segments"] },
                  { key: "deliveryModel",          label: "Delivery model",          options: ["Self-service", "Supported", "High-touch"] },
                  { key: "primaryAdvantage",       label: "Primary advantage",       options: ["Price", "Simplicity", "Specialization", "Performance", "Service", "Breadth"] },
                  { key: "typicalBuyingPriority",  label: "Typical buying priority", options: ["Lowest cost", "Fastest deployment", "Lowest risk", "Best capabilities", "Best long-term value"] },
                ] as { key: keyof MarketPosition; label: string; options: string[] }[]
              ).map(({ key, label, options }) => (
                <div key={key} className="flex items-start gap-3">
                  <span className="text-[10px] font-semibold text-muted-foreground w-36 flex-shrink-0 pt-1.5 leading-tight">{label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setMarketPosition({ [key]: opt === (data.marketPosition ?? {})[key] ? "" : opt })}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                          (data.marketPosition ?? {})[key] === opt
                            ? "bg-orange-100 border-orange-300 text-orange-700"
                            : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Competitor cards */}
          {(data.competitors ?? []).length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center">
                <Target className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No competitors added yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add each competitor and define honestly where they beat you — and where you beat them</p>
              </div>
            </div>
          )}

          {(data.competitors ?? []).map((competitor, idx) => (
            <CompetitorCard
              key={competitor.id}
              competitor={competitor}
              idx={idx}
              onUpdate={patch => updateCompetitor(competitor.id, patch)}
              onRemove={() => removeCompetitor(competitor.id)}
            />
          ))}

          <button
            onClick={addCompetitor}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-orange-300 hover:bg-orange-50/50 text-sm font-semibold text-muted-foreground hover:text-orange-700 transition-all self-start"
          >
            <Plus className="h-4 w-4" />
            Add competitor
          </button>
        </Section>

        {/* ── Audience ── */}
        <Section
          icon={Users2}
          title="Your Audience"
          subtitle="Map the buying center — define who typically fills each role and which contacts in your database match them"
          accentBg="bg-indigo-50"
          accentBorder="border-indigo-200"
          accentColor="text-indigo-600"
        >
          {activeSeat && (
            <BuyingCenterModal
              seatName={activeSeat}
              seniorities={(data.buyingCenter ?? []).find(s => s.seat === activeSeat)?.seniorities ?? []}
              departments={(data.buyingCenter ?? []).find(s => s.seat === activeSeat)?.departments ?? []}
              onUpdate={patch => updateBuyingCenterSeat(activeSeat, patch)}
              open={!!activeSeat}
              onClose={() => setActiveSeat(null)}
            />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(data.buyingCenter ?? []).map(seat => (
              <BuyingCenterTile
                key={seat.seat}
                seat={seat}
                onClick={() => setActiveSeat(seat.seat)}
              />
            ))}
          </div>
        </Section>

        {/* ── Company ── */}
        <Section
          icon={Building2}
          title="Your Company"
          subtitle="Value wedge, positioning, and messaging pillars that power every pitch"
          accentBg="bg-emerald-50"
          accentBorder="border-emerald-200"
          accentColor="text-emerald-600"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name">
              <Input
                value={data.company.name}
                onChange={v => setCompany({ name: v })}
                placeholder="e.g. Whyhello"
              />
            </Field>
            <Field label="Value wedge" hint="One sharp sentence">
              <Input
                value={data.company.valueWedge}
                onChange={v => setCompany({ valueWedge: v })}
                placeholder="e.g. We turn relationship data into revenue"
              />
            </Field>
          </div>

          <Field label="Positioning statement" hint="For internal clarity — who you help, how, and why you're different">
            <Textarea
              value={data.company.positioning}
              onChange={v => setCompany({ positioning: v })}
              placeholder="e.g. For revenue teams at growth-stage B2B companies who struggle to personalise outreach at scale, Whyhello is a relationship intelligence platform that surfaces the right context at the right moment…"
              rows={4}
            />
          </Field>

          <Field label="Key differentiators" hint="One per line — what you do that no one else does">
            <Textarea
              value={data.company.differentiators}
              onChange={v => setCompany({ differentiators: v })}
              placeholder={"Only platform that maps professional relationships across org charts\nReal-time signal detection from 40+ public sources\nNative AI that writes in your voice, not a template"}
              rows={4}
            />
          </Field>

          <Field label="Messaging pillars" hint="The three core themes underpinning everything you say">
            <div className="flex flex-col gap-2">
              {([0, 1, 2] as const).map(i => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border bg-emerald-50 border-emerald-200 text-emerald-700">
                    {i + 1}
                  </span>
                  <Input
                    value={data.company.pillars[i]}
                    onChange={v => setPillar(i, v)}
                    placeholder={
                      i === 0 ? "e.g. Know your buyer before the first word" :
                      i === 1 ? "e.g. Personalisation that scales" :
                      "e.g. Relationships, not just records"
                    }
                  />
                </div>
              ))}
            </div>
          </Field>
        </Section>

        {/* Footer */}
        <div className="flex items-center gap-2 py-2 justify-center">
          <Sparkles className="h-3 w-3 text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Everything you add here is used by the Strategy Assistant to write and advise in your voice.
          </p>
        </div>

      </div>
    </Shell>
  );
}
