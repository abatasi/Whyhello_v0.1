import { apiFetch } from "@/lib/apiFetch";
import { useBuyingCenterRoles } from "@/hooks/useBuyingCenterRoles";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { isHqVoiceQueryForUser } from "@/lib/hq-voice-query-model";
import { Shell } from "@/components/layout/Shell";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { cn } from "@/lib/utils";
import {
  Mic2, Package, Building2, Plus, Trash2, ChevronDown, Copy,
  Save, CheckCircle2, Landmark, Sparkles, Upload, X, FileText,
  Loader2, RefreshCw, Ban, PenLine, TrendingDown, TrendingUp,
  Info, BarChart3, Users, Users2, Target, Globe, MessageSquare, Shield, Search, MapPin,
  Megaphone, Wallet, Vote, Crown, Briefcase, Cpu, ShieldCheck, Flame,
  ShoppingCart, Scale, Calculator, User, Wrench, MessageCircle, GraduationCap,
} from "lucide-react";
import { useAppMode } from "@/contexts/AppModeContext";
import {
  activateVoicePersona, cloneVoice, createVoicePersonaId, deleteVoicePersona,
  duplicateVoicePersona, migrateVoicePersonas, renameVoicePersona, selectVoicePersona,
  updateVoicePersona, updateVoicePersonaSummary, type VoicePersona,
} from "@/lib/voice-personas";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import "./hq-presentation.css";

// ── Persistence ──────────────────────────────────────────────────────────────

const API_PROFILE_URL = "/api/hq/profile";

const STORAGE_KEY = "whyhello_dna_v4";

function mergeBuyingCenter(saved?: Array<Partial<BuyingCenterSeat>>): BuyingCenterSeat[] {
  const savedMap = new Map((saved ?? []).map(s => [s.seat!, s]));
  return BUYING_CENTER_SEATS.map(def => ({
    seat: def.seat,
    seniorities: savedMap.get(def.seat)?.seniorities ?? [],
    departments: savedMap.get(def.seat)?.departments ?? [],
  }));
}

function mergeBuyingCenters(
  saved?: Array<Partial<BuyingCenterConfig>>,
  legacy?: Array<Partial<BuyingCenterSeat>>,
): BuyingCenterConfig[] {
  if (saved && saved.length > 0) {
    return saved.map(bc => ({
      id: bc.id ?? "default",
      name: bc.name ?? "Default",
      seats: mergeBuyingCenter(bc.seats),
    }));
  }
  if (legacy && legacy.length > 0) {
    return [{ id: "default", name: "Default", seats: mergeBuyingCenter(legacy) }];
  }
  return [];
}

function mergeTargetMarkets(
  saved?: Array<Partial<TargetMarketConfig>>,
  legacy?: { industries?: string[]; companySizes?: string[]; locations?: string[] },
): TargetMarketConfig[] {
  if (saved && saved.length > 0) {
    return saved.map(tm => ({
      id: tm.id ?? "default",
      name: tm.name ?? "Default",
      industries: tm.industries ?? [],
      companySizes: tm.companySizes ?? [],
      locations: tm.locations ?? [],
    }));
  }
  if (legacy && (legacy.industries?.length || legacy.companySizes?.length || legacy.locations?.length)) {
    return [{ id: "default", name: "Default", industries: legacy.industries ?? [], companySizes: legacy.companySizes ?? [], locations: legacy.locations ?? [] }];
  }
  return [];
}

function mergeDNA(parsed: StoredDNA): DNAData {
  const d = defaultDNA();
  const buyingCenters = mergeBuyingCenters(parsed.buyingCenters, parsed.buyingCenter);
  const targetMarkets = mergeTargetMarkets(parsed.targetMarkets, parsed.targetMarket);
  const merged: DNAData = {
    ...d,
    ...parsed,
    voice: { ...d.voice, ...(parsed.voice ?? {}) },
    voicePersonas: parsed.voicePersonas ?? [],
    activeVoicePersonaId: parsed.activeVoicePersonaId ?? "",
    company: { ...d.company, ...(parsed.company ?? {}) },
    products: (parsed.products ?? []).map(p => ({ ...p, economicBenefits: (p.economicBenefits ?? []).map(eb => ({ label: "", ...eb })) })),
    customers: (parsed.customers ?? []).map(c => ({
      ...c,
      companyId: c.companyId ?? null,
      companyName: c.companyName ?? "",
      companyIndustry: c.companyIndustry ?? "",
      companySize: c.companySize ?? "",
      companyHeadquarters: c.companyHeadquarters ?? "",
      testimonialAttribution: c.testimonialAttribution === "named" ? "named" : "anonymized",
      anonymizedCustomerLabel: c.anonymizedCustomerLabel ?? "",
      economicBenefits: (c.economicBenefits ?? []).map(eb => ({ label: "", ...eb })),
    })),
    marketPosition: { ...d.marketPosition, ...(parsed.marketPosition ?? {}) },
    competitors: (parsed.competitors ?? []).map(c => ({
      ...c,
      // Migrate legacy single-string category to array
      category: Array.isArray(c.category)
        ? c.category
        : c.category ? [c.category] : [],
      // Migrate legacy records that predate companyId
      companyId: c.companyId ?? null,
    })),
    buyingCenters,
    targetMarkets,
    liveBuyingCenterId: buyingCenters.some(bc => bc.id === parsed.liveBuyingCenterId) ? parsed.liveBuyingCenterId! : null,
    liveTargetMarketId: targetMarkets.some(tm => tm.id === parsed.liveTargetMarketId) ? parsed.liveTargetMarketId! : null,
  };
  return migrateVoicePersonas(merged);
}

function saveDNA(data: DNAData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function frequencyPhrase(freq: string): string {
  switch (freq) {
    case "yearly":          return "yearly";
    case "monthly":         return "monthly";
    case "weekly":          return "weekly";
    case "one-time":        return "one-time";
    case "per-transaction": return "per transaction";
    default:                return freq;
  }
}

// Maps any common verb form (past participle, gerund, base, 3sg present)
// → [present-3sg, simple-past] so we can pick the right tense per context.
const VERB_FORMS: Record<string, [string, string]> = {
  // Gain verbs
  generate: ["generates","generated"], generates: ["generates","generated"],
  generated: ["generates","generated"], generating: ["generates","generated"],
  grow: ["grows","grew"], grows: ["grows","grew"],
  grown: ["grows","grew"], growing: ["grows","grew"],
  create: ["creates","created"], creates: ["creates","created"],
  created: ["creates","created"], creating: ["creates","created"],
  increase: ["increases","increased"], increases: ["increases","increased"],
  increased: ["increases","increased"], increasing: ["increases","increased"],
  boost: ["boosts","boosted"], boosts: ["boosts","boosted"],
  boosted: ["boosts","boosted"], boosting: ["boosts","boosted"],
  drive: ["drives","drove"], drives: ["drives","drove"],
  driven: ["drives","drove"], driving: ["drives","drove"],
  unlock: ["unlocks","unlocked"], unlocks: ["unlocks","unlocked"],
  unlocked: ["unlocks","unlocked"], unlocking: ["unlocks","unlocked"],
  produce: ["produces","produced"], produces: ["produces","produced"],
  produced: ["produces","produced"], producing: ["produces","produced"],
  deliver: ["delivers","delivered"], delivers: ["delivers","delivered"],
  delivered: ["delivers","delivered"], delivering: ["delivers","delivered"],
  enable: ["enables","enabled"], enables: ["enables","enabled"],
  enabled: ["enables","enabled"], enabling: ["enables","enabled"],
  accelerate: ["accelerates","accelerated"], accelerates: ["accelerates","accelerated"],
  accelerated: ["accelerates","accelerated"], accelerating: ["accelerates","accelerated"],
  expand: ["expands","expanded"], expands: ["expands","expanded"],
  expanded: ["expands","expanded"], expanding: ["expands","expanded"],
  improve: ["improves","improved"], improves: ["improves","improved"],
  improved: ["improves","improved"], improving: ["improves","improved"],
  build: ["builds","built"], builds: ["builds","built"],
  built: ["builds","built"], building: ["builds","built"],
  capture: ["captures","captured"], captures: ["captures","captured"],
  captured: ["captures","captured"], capturing: ["captures","captured"],
  develop: ["develops","developed"], develops: ["develops","developed"],
  developed: ["develops","developed"], developing: ["develops","developed"],
  earn: ["earns","earned"], earns: ["earns","earned"],
  earned: ["earns","earned"], earning: ["earns","earned"],
  attract: ["attracts","attracted"], attracts: ["attracts","attracted"],
  attracted: ["attracts","attracted"], attracting: ["attracts","attracted"],
  retain: ["retains","retained"], retains: ["retains","retained"],
  retained: ["retains","retained"], retaining: ["retains","retained"],
  acquire: ["acquires","acquired"], acquires: ["acquires","acquired"],
  acquired: ["acquires","acquired"], acquiring: ["acquires","acquired"],
  compound: ["compounds","compounded"], compounds: ["compounds","compounded"],
  compounded: ["compounds","compounded"], compounding: ["compounds","compounded"],
  // Pain verbs
  reduce: ["reduces","reduced"], reduces: ["reduces","reduced"],
  reduced: ["reduces","reduced"], reducing: ["reduces","reduced"],
  eliminate: ["eliminates","eliminated"], eliminates: ["eliminates","eliminated"],
  eliminated: ["eliminates","eliminated"], eliminating: ["eliminates","eliminated"],
  remove: ["removes","removed"], removes: ["removes","removed"],
  removed: ["removes","removed"], removing: ["removes","removed"],
  prevent: ["prevents","prevented"], prevents: ["prevents","prevented"],
  prevented: ["prevents","prevented"], preventing: ["prevents","prevented"],
  minimize: ["minimizes","minimized"], minimizes: ["minimizes","minimized"],
  minimized: ["minimizes","minimized"], minimizing: ["minimizes","minimized"],
  avoid: ["avoids","avoided"], avoids: ["avoids","avoided"],
  avoided: ["avoids","avoided"], avoiding: ["avoids","avoided"],
  lower: ["lowers","lowered"], lowers: ["lowers","lowered"],
  lowered: ["lowers","lowered"], lowering: ["lowers","lowered"],
  save: ["saves","saved"], saves: ["saves","saved"],
  saved: ["saves","saved"], saving: ["saves","saved"],
  decrease: ["decreases","decreased"], decreases: ["decreases","decreased"],
  decreased: ["decreases","decreased"], decreasing: ["decreases","decreased"],
  mitigate: ["mitigates","mitigated"], mitigates: ["mitigates","mitigated"],
  mitigated: ["mitigates","mitigated"], mitigating: ["mitigates","mitigated"],
  resolve: ["resolves","resolved"], resolves: ["resolves","resolved"],
  resolved: ["resolves","resolved"], resolving: ["resolves","resolved"],
  address: ["addresses","addressed"], addresses: ["addresses","addressed"],
  addressed: ["addresses","addressed"], addressing: ["addresses","addressed"],
  limit: ["limits","limited"], limits: ["limits","limited"],
  limited: ["limits","limited"], limiting: ["limits","limited"],
  cut: ["cuts","cut"], cuts: ["cuts","cut"], cutting: ["cuts","cut"],
  // Additional verbs commonly found in financial / B2B descriptions
  protect: ["protects","protected"], protects: ["protects","protected"],
  protected: ["protects","protected"], protecting: ["protects","protected"],
  preserve: ["preserves","preserved"], preserves: ["preserves","preserved"],
  preserved: ["preserves","preserved"], preserving: ["preserves","preserved"],
  transfer: ["transfers","transferred"], transfers: ["transfers","transferred"],
  transferred: ["transfers","transferred"], transferring: ["transfers","transferred"],
  manage: ["manages","managed"], manages: ["manages","managed"],
  managed: ["manages","managed"], managing: ["manages","managed"],
  sustain: ["sustains","sustained"], sustains: ["sustains","sustained"],
  sustained: ["sustains","sustained"], sustaining: ["sustains","sustained"],
  maximize: ["maximizes","maximized"], maximizes: ["maximizes","maximized"],
  maximized: ["maximizes","maximized"], maximizing: ["maximizes","maximized"],
  optimize: ["optimizes","optimized"], optimizes: ["optimizes","optimized"],
  optimized: ["optimizes","optimized"], optimizing: ["optimizes","optimized"],
  diversify: ["diversifies","diversified"], diversifies: ["diversifies","diversified"],
  diversified: ["diversifies","diversified"], diversifying: ["diversifies","diversified"],
  allocate: ["allocates","allocated"], allocates: ["allocates","allocated"],
  allocated: ["allocates","allocated"], allocating: ["allocates","allocated"],
  support: ["supports","supported"], supports: ["supports","supported"],
  supported: ["supports","supported"], supporting: ["supports","supported"],
  recover: ["recovers","recovered"], recovers: ["recovers","recovered"],
  recovered: ["recovers","recovered"], recovering: ["recovers","recovered"],
  simplify: ["simplifies","simplified"], simplifies: ["simplifies","simplified"],
  simplified: ["simplifies","simplified"], simplifying: ["simplifies","simplified"],
  streamline: ["streamlines","streamlined"], streamlines: ["streamlines","streamlined"],
  streamlined: ["streamlines","streamlined"], streamlining: ["streamlines","streamlined"],
  automate: ["automates","automated"], automates: ["automates","automated"],
  automated: ["automates","automated"], automating: ["automates","automated"],
  replaced: ["replaces","replaced"], replace: ["replaces","replaced"], replacing: ["replaces","replaced"],
  replaces: ["replaces","replaced"],
  scale: ["scales","scaled"], scales: ["scales","scaled"],
  scaled: ["scales","scaled"], scaling: ["scales","scaled"],
};

/**
 * Extracts the core verb from a free-text description and returns a verb phrase
 * in the requested tense. Returns null when no verb can be identified.
 *
 * Handles four cases:
 *  1. Description starts with a known verb form: "generates recurring revenue"
 *  2. Description starts with a past participle at first position: "reduced overhead"
 *  3. Embedded past participle after a noun: "revenue generated from assets"
 *     → restructured to "generates revenue from assets"
 *  4. Pure noun phrase ("net-new asset growth") → returns null
 */
function descriptionToVerbPhrase(rawDesc: string, tense: "present" | "past"): string | null {
  const words = rawDesc.trim().split(/\s+/);
  if (!words.length) return null;
  const idx = tense === "present" ? 0 : 1;

  const firstLower = words[0].toLowerCase();
  const rest = words.slice(1).map(w => w.toLowerCase()).join(" ");

  // Case 1 & 2: verb (in any form) is the first word
  if (VERB_FORMS[firstLower]) {
    return VERB_FORMS[firstLower][idx] + (rest ? " " + rest : "");
  }

  // Case 3: embedded verb later in the phrase — find the first known verb word
  for (let i = 1; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (VERB_FORMS[w]) {
      const before = words.slice(0, i).map(x => x.toLowerCase()).join(" ");
      const after  = words.slice(i + 1).map(x => x.toLowerCase()).join(" ");
      return `${VERB_FORMS[w][idx]} ${before}${after ? " " + after : ""}`;
    }
  }

  return null; // pure noun phrase
}

interface EBSummaryParts {
  subject: string;
  predicate: string;
  amount: string;
  unit: string;
  freq: string;
  type: "pain" | "gain";
}

function buildProductEBParts(productName: string, eb: EconomicBenefit): EBSummaryParts | null {
  const desc = eb.description.trim();
  if (!desc) return null;
  const verbPhrase = descriptionToVerbPhrase(desc, "present");
  return {
    subject: productName.trim() || "This offering",
    predicate: verbPhrase ?? (eb.type === "gain" ? "generates" : "reduces") + " " + desc.toLowerCase(),
    amount: eb.amount.trim(),
    unit: eb.unit.trim().replace(/^[Pp][Ee][Rr]\s+/, "per "),
    freq: eb.frequency ? frequencyPhrase(eb.frequency) : "",
    type: eb.type,
  };
}

function buildCustomerEBParts(customerName: string, eb: EconomicBenefit): EBSummaryParts | null {
  const desc = eb.description.trim();
  if (!desc) return null;
  const verbPhrase = descriptionToVerbPhrase(desc, "past");
  return {
    subject: customerName.trim() || "This customer",
    predicate: verbPhrase ?? (eb.type === "gain" ? "generated" : "reduced") + " " + desc.toLowerCase(),
    amount: eb.amount.trim(),
    unit: eb.unit.trim().replace(/^[Pp][Ee][Rr]\s+/, "per "),
    freq: eb.frequency ? frequencyPhrase(eb.frequency) : "",
    type: eb.type,
  };
}

function customerEBSubject(customer: Customer): string {
  if (customer.testimonialAttribution === "named") {
    return customer.companyName.trim() || customer.customerProfile.trim() || "This customer";
  }
  return customer.anonymizedCustomerLabel.trim() || "An anonymized customer";
}

function EBSummary({ parts, colorClass, iconClass }: {
  parts: EBSummaryParts;
  colorClass: string;
  iconClass: string;
}) {
  const hasAmount = !!parts.amount;
  const quantifier = hasAmount
    ? <strong className="not-italic font-semibold">{parts.amount}{parts.unit ? ` ${parts.unit}` : ""}</strong>
    : null;

  return (
    <div className={cn("rounded-lg px-3.5 py-2.5 flex items-start gap-2 border", colorClass)}>
      <CheckCircle2 className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", iconClass)} />
      <p className={cn("text-xs leading-relaxed italic", colorClass.includes("rose") ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
        <span className="not-italic">{parts.subject} </span>
        <strong className="not-italic font-semibold">{parts.predicate}</strong>
        {hasAmount && parts.type === "gain" && <><span className="not-italic font-normal">, gaining </span>{quantifier}</>}
        {hasAmount && parts.type === "pain" && <>, saving {quantifier}</>}
        {parts.freq && <span className="not-italic"> {parts.freq}</span>}
        <span className="not-italic">.</span>
      </p>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface EconomicBenefit {
  id: string;
  type: "pain" | "gain";
  label: string;
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
  companyId: number | null;
  companyName: string;
  companyIndustry: string;
  companySize: string;
  companyHeadquarters: string;
  testimonialAttribution: "named" | "anonymized";
  anonymizedCustomerLabel: string;
  startingSituation: string;
  customerPriorities: string;
  solutionProvided: string;
  customerTransformation: string;
  results: string;
  economicBenefits: EconomicBenefit[];
  customerQuote: string;
}

function companyScaleLabel(size: string | null, employeeCount: number | null): string {
  if (employeeCount) {
    if (employeeCount >= 5_000) return "large";
    if (employeeCount >= 200) return "mid-sized";
    if (employeeCount < 50) return "small";
  }
  const normalized = (size ?? "").toLowerCase().replace(/,/g, "");
  const upperBound = Number(normalized.match(/\d+/g)?.at(-1) ?? 0);
  if (normalized.includes("10000") || normalized.includes("5000+") || upperBound >= 5_000) return "large";
  if (upperBound >= 200) return "mid-sized";
  if (upperBound > 0) return "small";
  return "";
}

function industryCompanyLabel(industry: string | null): string {
  const value = (industry ?? "").trim().toLowerCase();
  if (!value) return "company";
  if (value.includes("technology") || value.includes("software")) return "technology firm";
  if (value.includes("retail")) return "retailer";
  if (value.includes("financial") || value.includes("bank")) return "financial services firm";
  if (value.includes("health")) return "healthcare organization";
  if (value.includes("manufactur")) return "manufacturer";
  return `${value} company`;
}

function buildAnonymizedCompanyLabel(company: CompanyOption): string {
  const scale = companyScaleLabel(company.size, company.employeeCount);
  const companyType = industryCompanyLabel(company.industry);
  const headquarters = company.location?.trim() || company.country?.trim();
  return [
    "A",
    scale,
    companyType,
    headquarters ? `headquartered in ${headquarters}` : "",
  ].filter(Boolean).join(" ");
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
  companyId: number | null;
  name: string;
  website: string;
  productCompared: string;
  category: string[];
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

type StoredDNA = Partial<DNAData> & {
  buyingCenter?: Array<Partial<BuyingCenterSeat>>;
  buyingCenters?: Array<Partial<BuyingCenterConfig>>;
  targetMarket?: { industries?: string[]; companySizes?: string[]; locations?: string[] };
  targetMarkets?: Array<Partial<TargetMarketConfig>>;
};

interface DNAData {
  liveBuyingCenterId: string | null;
  liveTargetMarketId: string | null;
  voicePersonas: VoicePersona[];
  activeVoicePersonaId: string;
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
  buyingCenters: BuyingCenterConfig[];
  targetMarkets: TargetMarketConfig[];
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
    liveBuyingCenterId: null,
    liveTargetMarketId: null,
    voice: {
      toneTags: [],
      communicationStyle: "balanced",
      writingNotes: "",
      trainingText: "",
      suppressions: [],
      suppressionNotes: "",
    },
    voicePersonas: [],
    activeVoicePersonaId: "",
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
    buyingCenters: [],
    targetMarkets: [],
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
  violet:  { bg: "bg-violet-50 dark:bg-background",  border: "border-violet-200 dark:border-violet-500/30",  iconBg: "bg-violet-100",  iconColor: "text-violet-600",  chipBg: "bg-violet-100",  chipBorder: "border-violet-200",  chipText: "text-violet-700"  },
  emerald: { bg: "bg-emerald-50 dark:bg-background", border: "border-emerald-200 dark:border-emerald-500/30", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", chipBg: "bg-emerald-100", chipBorder: "border-emerald-200", chipText: "text-emerald-700" },
  blue:    { bg: "bg-blue-50 dark:bg-background",    border: "border-blue-200 dark:border-blue-500/30",    iconBg: "bg-blue-100",    iconColor: "text-blue-600",    chipBg: "bg-blue-100",    chipBorder: "border-blue-200",    chipText: "text-blue-700"    },
  amber:   { bg: "bg-amber-50 dark:bg-background",   border: "border-amber-200 dark:border-amber-500/30",   iconBg: "bg-amber-100",   iconColor: "text-amber-600",   chipBg: "bg-amber-100",   chipBorder: "border-amber-200",   chipText: "text-amber-700"   },
  slate:   { bg: "bg-slate-50 dark:bg-background",   border: "border-slate-200 dark:border-slate-500/30",   iconBg: "bg-slate-100 dark:bg-slate-500/20",   iconColor: "text-slate-500 dark:text-slate-400",   chipBg: "bg-slate-100 dark:bg-slate-500/20",   chipBorder: "border-slate-200 dark:border-slate-500/20",   chipText: "text-slate-600 dark:text-slate-300"   },
  sky:     { bg: "bg-sky-50 dark:bg-background",     border: "border-sky-200 dark:border-sky-500/30",     iconBg: "bg-sky-100",     iconColor: "text-sky-600",     chipBg: "bg-sky-100",     chipBorder: "border-sky-200",     chipText: "text-sky-700"     },
  rose:    { bg: "bg-rose-50 dark:bg-background",    border: "border-rose-200 dark:border-rose-500/30",    iconBg: "bg-rose-100",    iconColor: "text-rose-600",    chipBg: "bg-rose-100",    chipBorder: "border-rose-200",    chipText: "text-rose-600"    },
};

// ── Auto-save hook ───────────────────────────────────────────────────────────

function useAutoSave(data: DNAData, ready: boolean, revision: React.RefObject<string>, profileUrl: string, live: boolean) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!ready) return;
    // The server GET populates data; it is not a user edit and needs no PUT.
    if (!hydrated.current) {
      hydrated.current = true;
      setSaved(true);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const version = ++saveVersion.current;
    setSaved(false);
    timer.current = setTimeout(() => {
      // Profile PUT replaces the whole JSON document. Serialize in-flight
      // writes so a slower, older response cannot overwrite the latest choice.
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          const saveOwnerId = currentUserId.current;
          const response = await apiFetch(profileUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "X-Profile-Revision": revision.current ?? "new" },
            body: JSON.stringify({ data }),
          });
          if (!response.ok) {
            throw new Error(response.status === 409
              ? "Profile changed elsewhere — reload HQ to continue"
              : "Not synced — edit to retry");
          }
          const result: { revision: string } = await response.json();
          revision.current = result.revision;
          if (version !== saveVersion.current) return;
          if (!live) { setSaveError(""); setSaved(true); return; }
          saveDNA(data);
          setSaveError("");
          setSaved(true);
          void queryClient.invalidateQueries({
            predicate: query => isHqVoiceQueryForUser(query.queryKey, saveOwnerId),
          });
          void queryClient.invalidateQueries({
            predicate: query => typeof query.queryKey[0] === "string" &&
              /^\/api\/(contacts|companies)\/\d+$/.test(query.queryKey[0]),
          });
          void queryClient.invalidateQueries({ queryKey: ["/api/home/top-buyers"] });
        } catch (error) {
          if (version === saveVersion.current) setSaveError(error instanceof Error ? error.message : "Not synced — edit to retry");
        }
      });
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [data, ready, queryClient, revision, profileUrl, live]);

  return { saved, saveError };
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, subtitle,
  accentBg, accentBorder, accentColor,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  accentBg: string;
  accentBorder: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hq-section-card overflow-hidden rounded-[10px] border border-border bg-card">
      <div className="hq-section-heading flex w-full items-center gap-3 px-5 text-left">
        <div className={cn("hq-section-icon flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border", accentBg, accentBorder)}>
          <Icon className={cn("h-5 w-5", accentColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold tracking-tight text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="hq-section-body flex flex-col gap-5 border-t border-border px-5 py-5">
        {children}
      </div>
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
  id: string;
  personaId: string;
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
        ? "border-violet-400 bg-violet-50/90 dark:bg-background dark:border-violet-500/40"
        : textDirty && summary && !loading
          ? "border-violet-300 bg-violet-50/80 dark:bg-background dark:border-violet-500/30"
          : "border-violet-200 bg-violet-50/60 dark:bg-background dark:border-violet-500/30"
    )}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-violet-200/60 dark:border-violet-500/30">
        <div className="h-6 w-6 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300 flex-1">Your Voice Profile</span>
        {!isEditing && textDirty && summary && !loading && (
          <span className="text-[10px] text-violet-500 dark:text-violet-300 mr-1">Text updated — save fields to refresh</span>
        )}
        {!isEditing && !loading && summary && (
          <button
            onClick={startEdit}
            title="Edit profile"
            className="h-6 w-6 rounded-md flex items-center justify-center text-violet-400 dark:text-violet-300 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-100 transition-colors"
          >
            <PenLine className="h-3 w-3" />
          </button>
        )}
        {!isEditing && (
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Regenerate"
            className="h-6 w-6 rounded-md flex items-center justify-center text-violet-500 dark:text-violet-300 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-40"
          >
            {loading ? <ThinkingIndicator decorative className="h-3 w-5" /> : <RefreshCw className="h-3 w-3" />}
          </button>
        )}
      </div>

      <div className="px-4 py-3.5">
        {loading ? (
          <div className="flex items-center gap-3">
            <ThinkingIndicator label="Generating this persona's voice profile" />
            <span className="text-xs text-muted-foreground">Building your voice profile…</span>
          </div>
        ) : isEditing ? (
          <div className="flex flex-col gap-2.5">
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-violet-300 bg-background px-3 py-2 text-sm text-violet-900 dark:text-violet-100 placeholder:text-violet-300 dark:placeholder:text-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-400 leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelEdit}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-violet-500 dark:text-violet-300 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-100 transition-colors"
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
      const resp = await apiFetch("/api/hq/testimonial-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customer.rawTestimonial }),
      });
      const extracted = await resp.json() as Partial<Customer>;
      const extractedCompanyName = extracted.companyName?.trim();

      if (extractedCompanyName) {
        const companyResp = await apiFetch(
          `/api/companies?search=${encodeURIComponent(extractedCompanyName)}&limit=8`,
        );
        const companyJson = await companyResp.json() as { data?: CompanyOption[] };
        const candidates = companyJson.data ?? [];
        const company = candidates.find(
          candidate => candidate.name.toLowerCase() === extractedCompanyName.toLowerCase(),
        );

        if (company) {
          const headquarters = company.location?.trim() || company.country?.trim() || "";
          onUpdate({
            ...extracted,
            companyId: company.id,
            companyName: company.name,
            companyIndustry: company.industry ?? "",
            companySize: company.size ?? (company.employeeCount ? `${company.employeeCount.toLocaleString()} employees` : ""),
            companyHeadquarters: headquarters,
            anonymizedCustomerLabel: buildAnonymizedCompanyLabel(company),
          });
        } else {
          onUpdate(extracted);
        }
      } else {
        onUpdate(extracted);
      }
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
      const resp = await apiFetch("/api/hq/extract-text", { method: "POST", body: formData });
      const data = await resp.json();
      onUpdate({ rawTestimonial: (customer.rawTestimonial ? customer.rawTestimonial + "\n\n" : "") + (data.text ?? "") });
    } catch { /* ignore */ }
    e.target.value = "";
  }

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 dark:bg-background overflow-hidden">
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
        <div className="rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/40 dark:bg-background p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-bold text-foreground">Match company from your database</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pull Industry, Company Size, and Headquarters to create a safe anonymous description.
            </p>
          </div>
          <CompanySearchField
            name={customer.companyName ?? ""}
            companyId={customer.companyId ?? null}
            onSelect={company => {
              const headquarters = company.location?.trim() || company.country?.trim() || "";
              onUpdate({
                companyId: company.id,
                companyName: company.name,
                companyIndustry: company.industry ?? "",
                companySize: company.size ?? (company.employeeCount ? `${company.employeeCount.toLocaleString()} employees` : ""),
                companyHeadquarters: headquarters,
                customerProfile: [
                  company.name,
                  company.industry,
                  company.size,
                  headquarters,
                ].filter(Boolean).join(" · "),
                anonymizedCustomerLabel: buildAnonymizedCompanyLabel(company),
              });
            }}
            onClear={() => onUpdate({
              companyId: null,
              companyName: "",
              companyIndustry: "",
              companySize: "",
              companyHeadquarters: "",
            })}
          />
          {customer.companyId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                ["Industry", customer.companyIndustry],
                ["Company size", customer.companySize],
                ["Headquarters", customer.companyHeadquarters],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-sky-100 bg-background/70 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{value || "Not available"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

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

        {/* Testimonial attribution permission */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-background p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-bold text-foreground">Testimonial attribution</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Control whether generated messaging may identify this customer.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ testimonialAttribution: "named" })}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-all",
                customer.testimonialAttribution === "named"
                  ? "border-indigo-300 bg-background ring-1 ring-indigo-200"
                  : "border-border/60 bg-background/60 hover:border-indigo-200",
              )}
            >
              <p className="text-xs font-semibold text-foreground">Use in full</p>
              <p className="text-[10px] text-muted-foreground mt-1">Company name may be included, e.g. “Acme Retail”.</p>
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ testimonialAttribution: "anonymized" })}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-all",
                customer.testimonialAttribution !== "named"
                  ? "border-indigo-300 bg-background ring-1 ring-indigo-200"
                  : "border-border/60 bg-background/60 hover:border-indigo-200",
              )}
            >
              <p className="text-xs font-semibold text-foreground">Anonymize</p>
              <p className="text-[10px] text-muted-foreground mt-1">Never reveal the company name or identifying details.</p>
            </button>
          </div>
          {customer.testimonialAttribution !== "named" && (
            <Field label="Anonymous description" hint="The safe description used in generated messaging">
              <Input
                value={customer.anonymizedCustomerLabel ?? ""}
                onChange={v => onUpdate({ anonymizedCustomerLabel: v })}
                placeholder="e.g. A large retailer in North America"
              />
            </Field>
          )}
        </div>

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
              <div key={eb.id} className={cn("rounded-xl border p-3.5 flex flex-col gap-3", eb.type === "pain" ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/30 dark:bg-background" : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-background")}>
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
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Economic benefit</label>
                  <input type="text" value={eb.label} onChange={e => onUpdateEB(eb.id, { label: e.target.value })} placeholder={eb.type === "pain" ? "e.g. Reduced compliance overhead" : "e.g. Net-new asset growth"} className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{eb.type === "pain" ? "Cost or risk reduced" : "Value or upside created"}</label>
                  <textarea value={eb.description} onChange={e => onUpdateEB(eb.id, { description: e.target.value })} rows={2} placeholder={eb.type === "pain" ? "e.g. Eliminated manual research time per rep" : "e.g. Recurring revenue generated from new client assets"} className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 leading-relaxed transition-colors" />
                </div>
                <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Amount</label>
                    <input type="text" value={eb.amount} onChange={e => onUpdateEB(eb.id, { amount: e.target.value })} placeholder="e.g. $9,000" className="h-9 w-28 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit of measurement</label>
                    <input type="text" value={eb.unit} onChange={e => onUpdateEB(eb.id, { unit: e.target.value })} placeholder="e.g. Per $1M of net-new AUM" className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors" />
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

                {/* Natural language confirmation */}
                {(() => {
                  const parts = buildCustomerEBParts(customerEBSubject(customer), eb);
                  return parts ? (
                    <EBSummary
                      parts={parts}
                      colorClass={eb.type === "pain" ? "bg-rose-50/60 dark:bg-background border-rose-200/70 dark:border-rose-500/30" : "bg-emerald-50/60 dark:bg-background border-emerald-200/70 dark:border-emerald-500/30"}
                      iconClass={eb.type === "pain" ? "text-rose-400" : "text-emerald-500"}
                    />
                  ) : null;
                })()}
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

// ── CompanySearchField ────────────────────────────────────────────────────────

interface CompanyOption {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  country: string | null;
  employeeCount: number | null;
}
interface CompanySample { id: number; name: string; industry: string | null; size: string | null; location: string | null; }

function CompanySearchField({
  name, companyId, onSelect, onClear,
}: {
  name: string;
  companyId: number | null;
  onSelect: (c: CompanyOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(name);
  const [results, setResults] = useState<CompanyOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep input text in sync when external name changes (e.g. on load)
  useEffect(() => { setQuery(name); }, [name]);

  // Debounced search
  useEffect(() => {
    if (companyId) return; // already linked — don't search
    const q = query.trim();
    if (!q) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/companies?search=${encodeURIComponent(q)}&limit=8`);
        const json = await res.json();
        setResults(json.data ?? []);
        setOpen(true);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, companyId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (companyId) {
    // Linked state — show name as read-only pill with an unlink button
    return (
      <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-primary/30 bg-primary/5 text-sm">
        <Building2 className="h-3.5 w-3.5 text-primary/60 shrink-0" />
        <span className="flex-1 truncate text-foreground font-medium">{name}</span>
        <button
          onClick={onClear}
          title="Unlink company"
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 animate-spin" />}
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search companies…"
          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {results.map(c => (
            <button
              key={c.id}
              onMouseDown={e => { e.preventDefault(); onSelect(c); setOpen(false); }}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent transition-colors"
            >
              <Building2 className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {[c.industry, c.size, c.location || c.country].filter(Boolean).join(" · ")}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.trim().length > 1 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-popover shadow-lg px-3 py-3 text-sm text-muted-foreground">
          No companies found
        </div>
      )}
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
    <div className="rounded-xl border border-border/60 bg-secondary/20 dark:bg-background overflow-hidden">
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
          <Field label="Company">
            <CompanySearchField
              name={competitor.name}
              companyId={competitor.companyId}
              onSelect={c => onUpdate({ companyId: c.id, name: c.name, website: c.website ?? "" })}
              onClear={() => onUpdate({ companyId: null, name: "", website: "" })}
            />
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
              {["Direct", "Indirect", "Substitute", "Status quo"].map(opt => {
                const cats = competitor.category ?? [];
                const active = cats.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => onUpdate({ category: active ? cats.filter(c => c !== opt) : [...cats, opt] })}
                    className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                      active ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/60"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
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
        <div className="rounded-xl border border-rose-200/70 dark:border-rose-500/30 bg-rose-50/20 dark:bg-background p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-5 rounded-md bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-3 w-3 text-rose-500" />
            </div>
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Where they are stronger</p>
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
        <div className="rounded-xl border border-blue-200/70 dark:border-blue-500/30 bg-blue-50/20 dark:bg-background p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-5 rounded-md bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <Shield className="h-3 w-3 text-blue-500" />
            </div>
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Where we are stronger</p>
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

function DeptSelector({ selected, options, loading, error, onChange }: {
  selected: string[];
  options: string[];
  loading: boolean;
  error: boolean;
  onChange: (v: string[]) => void;
}) {
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

  const filtered = options.filter(d =>
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
                {error ? (
                  <p className="text-xs text-destructive px-3 py-2">Could not load Roles. Reopen this page to try again.</p>
                ) : loading ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">Loading Roles…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">No matching Roles</p>
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

interface ContactSample {
  id: number;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  seniority: string | null;
  department: string | null;
  companyName: string | null;
}

function BuyingCenterModal({ seatName, seniorities, departments, roleOptions, rolesLoading, rolesError, onUpdate, open, onClose }: {
  seatName: string;
  seniorities: string[];
  departments: string[];
  roleOptions: string[];
  rolesLoading: boolean;
  rolesError: boolean;
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

  // ── Contact preview ──────────────────────────────────────────────────────────
  const [sampleContacts, setSampleContacts] = useState<ContactSample[]>([]);
  const [sampleTotal, setSampleTotal] = useState<number>(0);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState(false);
  const hasFilter = seniorities.length > 0 || departments.length > 0;
  // Choosing every seniority level means "any seniority", including contacts
  // whose seniority has not been recorded yet.
  const restrictSeniority = seniorities.length > 0 &&
    !SENIORITY_OPTIONS.every(option => seniorities.includes(option));

  useEffect(() => {
    if (!open || !hasFilter) {
      setSampleContacts([]);
      setSampleTotal(0);
      setSampleError(false);
      setSampleLoading(false);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ limit: "3", page: "1" });
    if (restrictSeniority) params.set("seniority", seniorities.join(","));
    if (departments.length > 0) params.set("department", departments.join(","));
    setSampleContacts([]);
    setSampleTotal(0);
    setSampleError(false);
    setSampleLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/contacts?${params}`);
        if (!res.ok) throw new Error("Could not load qualifying contacts");
        const json = await res.json();
        if (!cancelled) {
          setSampleContacts(json.data ?? []);
          setSampleTotal(json.total ?? 0);
        }
      } catch {
        if (!cancelled) setSampleError(true);
      } finally {
        if (!cancelled) setSampleLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [seatName, seniorities.join(","), departments.join(","), open, hasFilter, restrictSeniority]);

  const initials = (c: ContactSample) => {
    const f = (c.firstName ?? "").charAt(0).toUpperCase();
    const l = (c.lastName ?? "").charAt(0).toUpperCase();
    return f + l || "?";
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[500px]">
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
              <p className="text-[11px] text-muted-foreground mt-0.5">Choose a Role for this seat. Existing department selections are preserved.</p>
            </div>
            <DeptSelector selected={departments} options={roleOptions} loading={rolesLoading} error={rolesError} onChange={v => onUpdate({ departments: v })} />
          </div>

          {/* Contact preview */}
          {(hasFilter || sampleLoading) && (
            <div className="flex flex-col gap-2">
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Qualifying records</p>
                {!sampleLoading && !sampleError && (
                  <span className="text-xs font-semibold text-foreground bg-secondary/60 border border-border/60 px-2 py-0.5 rounded-full" role="status">
                    {sampleTotal.toLocaleString()} contact{sampleTotal === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {seniorities.length > 0 && !restrictSeniority && (
                <p className="text-[11px] text-muted-foreground">
                  All seniority levels selected; contacts without a recorded seniority are included.
                </p>
              )}
              <p className="text-xs font-semibold text-foreground">Example contacts</p>

              {sampleLoading ? (
                <div className="flex flex-col gap-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-secondary/20 animate-pulse">
                      <div className="h-8 w-8 rounded-full bg-border/60 shrink-0" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="h-2.5 w-32 bg-border/60 rounded" />
                        <div className="h-2 w-24 bg-border/40 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sampleError ? (
                <p className="text-xs text-destructive" role="alert">Could not load qualifying contacts. Close and reopen this seat to try again.</p>
              ) : sampleContacts.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-border/40 bg-secondary/20">
                  <Users className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <p className="text-xs text-muted-foreground">No contacts in your database match these criteria</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sampleContacts.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-secondary/20">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border",
                        colors.iconBg, colors.border, colors.iconColor
                      )}>
                        {initials(c)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-snug truncate">
                          {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug truncate mt-0.5">
                          {[c.jobTitle, c.companyName].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      {c.seniority && (
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                          colors.chipBg, colors.chipBorder, colors.chipText
                        )}>
                          {c.seniority === "Individual Contributor" ? "IC" : c.seniority}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

// ── TargetFilterPicker ────────────────────────────────────────────────────────

function TargetFilterPicker({
  title,
  options,
  selected,
  onChange,
  hint,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between min-h-[1.75rem]">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className="text-[10px] font-semibold text-teal-700 bg-teal-100 border border-teal-200 rounded-full px-2 py-0.5">
              {selected.length} selected
            </span>
            <button onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
              Clear
            </button>
          </div>
        )}
      </div>

      {options.length > 8 && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1.5">
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder={`Filter ${title.toLowerCase()}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className={cn(
        "flex flex-wrap gap-1.5",
        options.length > 8 && "max-h-52 overflow-y-auto pr-0.5"
      )}>
        {filtered.length > 0 ? filtered.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={cn(
                "px-2.5 py-1 rounded-lg border text-xs font-medium transition-all",
                isSelected
                  ? "bg-teal-100 border-teal-300 text-teal-700"
                  : "bg-secondary/50 border-border/60 text-muted-foreground hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-700"
              )}
            >
              {opt}
            </button>
          );
        }) : (
          <p className="text-xs text-muted-foreground/50 py-1">
            {search ? `No results for "${search}"` : "No options available"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Navigation config ────────────────────────────────────────────────────────

type SectionId = "voice" | "products" | "customers" | "competitors" | "buyingCenter" | "targetMarket" | "company";

const HQ_NAV: {
  id: SectionId;
  icon: React.ElementType;
  title: string;
  description: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  iconBg: string;
}[] = [
  { id: "voice",        icon: Mic2,      title: "Voice & Tone",   description: "Personality & style",   activeBg: "bg-violet-50",  activeBorder: "border-violet-200",  activeText: "text-violet-700",  iconBg: "bg-violet-100"  },
  { id: "products",     icon: Package,   title: "Products",        description: "Features & outcomes",   activeBg: "bg-blue-50",    activeBorder: "border-blue-200",    activeText: "text-blue-700",    iconBg: "bg-blue-100"    },
  { id: "customers",    icon: Users,     title: "Customers",       description: "Stories & proof",       activeBg: "bg-sky-50",     activeBorder: "border-sky-200",     activeText: "text-sky-700",     iconBg: "bg-sky-100"     },
  { id: "competitors",  icon: Target,    title: "Competitors",     description: "Market position",       activeBg: "bg-orange-50",  activeBorder: "border-orange-200",  activeText: "text-orange-700",  iconBg: "bg-orange-100"  },
  { id: "buyingCenter", icon: Users2,    title: "Buying Center",   description: "Roles & criteria",      activeBg: "bg-indigo-50",  activeBorder: "border-indigo-200",  activeText: "text-indigo-700",  iconBg: "bg-indigo-100"  },
  { id: "targetMarket", icon: Globe,     title: "Target Market",   description: "ICP company profile",   activeBg: "bg-teal-50",    activeBorder: "border-teal-200",    activeText: "text-teal-700",    iconBg: "bg-teal-100"    },
  { id: "company",      icon: Building2, title: "Company",         description: "Context & pillars",     activeBg: "bg-emerald-50", activeBorder: "border-emerald-200", activeText: "text-emerald-700", iconBg: "bg-emerald-100" },
];

// ── Main page ────────────────────────────────────────────────────────────────

export function HQEditor({ profileUrl = API_PROFILE_URL, live = true, onSaveStateChange, toolbar }: {
  profileUrl?: string;
  live?: boolean;
  onSaveStateChange?: (s: { loaded: boolean; saved: boolean; saveError: string; loadError: boolean }) => void;
  toolbar?: React.ReactNode;
}) {
  const { mode, toggleMode } = useAppMode();
  const { names: roleOptions, loading: rolesLoading, error: rolesError } = useBuyingCenterRoles();
  const wartime = mode === "wartime";
  // Never hydrate a user-scoped profile from a browser-global cache before auth-scoped GET.
  const [data, setData] = useState<DNAData>(defaultDNA);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const profileRevision = useRef("new");
  const { saved, saveError } = useAutoSave(data, profileLoaded && !profileLoadError, profileRevision, profileUrl, live);
  const saveStateCb = useRef(onSaveStateChange);
  saveStateCb.current = onSaveStateChange;
  useEffect(() => {
    saveStateCb.current?.({ loaded: profileLoaded, saved, saveError, loadError: profileLoadError });
  }, [profileLoaded, saved, saveError, profileLoadError]);

  // Load the account-scoped profile on mount; do not expose a browser-global startup cache.
  useEffect(() => {
    let cancelled = false;
    apiFetch(profileUrl)
      .then(r => {
        if (!r.ok) throw new Error("Could not load HQ profile");
        return r.json();
      })
      .then((json: { data: StoredDNA | null; revision: string }) => {
        if (!cancelled) {
          profileRevision.current = json.revision;
          if (live && !json?.data) {
            try { localStorage.removeItem(STORAGE_KEY); } catch { /* server is authoritative */ }
          }
          const hydratedData = mergeDNA(json?.data ?? defaultDNA());
          setData(hydratedData);
          if (live) saveDNA(hydratedData);
          setProfileLoaded(true);
        }
      })
      .catch(() => { if (!cancelled) setProfileLoadError(true); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeSeat, setActiveSeat] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("voice");
  const [editorVoicePersonaId, setEditorVoicePersonaId] = useState<string | null>(null);
  const [personaNameDraft, setPersonaNameDraft] = useState("");
  const [personaNameError, setPersonaNameError] = useState("");
  const [summaryLoadingPersonaIds, setSummaryLoadingPersonaIds] = useState<Set<string>>(() => new Set());
  const [summaryError, setSummaryError] = useState("");
  const [summaryErrorPersonaId, setSummaryErrorPersonaId] = useState<string | null>(null);
  const [textDirtyForProfile, setTextDirtyForProfile] = useState(false);
  const summaryRequestVersions = useRef(new Map<string, number>());
  const observedVoiceSignature = useRef<{ id: string; signature: string } | null>(null);
  const [activeBuyingCenterId, setActiveBuyingCenterId] = useState<string>(
    () => data.buyingCenters[0]?.id ?? ""
  );
  const [renamingBcId, setRenamingBcId] = useState<string | null>(null);
  const [renameBcValue, setRenameBcValue] = useState<string>("");
  const [targetMarketOptions, setTargetMarketOptions] = useState<{
    industries: string[];
    companySizes: string[];
    locations: string[];
  }>({ industries: [], companySizes: [], locations: [] });
  const [tmOptionsLoading, setTmOptionsLoading] = useState(false);
  const [activeTargetMarketId, setActiveTargetMarketId] = useState<string>(
    () => data.targetMarkets[0]?.id ?? ""
  );
  const [renamingTmId, setRenamingTmId] = useState<string | null>(null);
  const [renameTmValue, setRenameTmValue] = useState<string>("");
  const [tmSampleCompanies, setTmSampleCompanies] = useState<CompanySample[]>([]);
  const [tmSampleTotal, setTmSampleTotal] = useState<number | null>(null);
  const [tmSampleLoading, setTmSampleLoading] = useState(false);

  useEffect(() => {
    if (!profileLoaded) return;
    const initial = selectVoicePersona(data, data.activeVoicePersonaId);
    setEditorVoicePersonaId(initial.editorPersonaId);
    const persona = data.voicePersonas.find(item => item.id === initial.editorPersonaId);
    setPersonaNameDraft(persona?.name ?? "");
    observedVoiceSignature.current = null;
  }, [profileLoaded]); // authoritative profile initialization only

  useEffect(() => {
    setTmOptionsLoading(true);
    apiFetch("/api/filters/options")
      .then(r => r.json())
      .then((json: { industries?: string[]; companySizes?: string[]; locations?: string[] }) => {
        setTargetMarketOptions({
          industries: json.industries ?? [],
          companySizes: json.companySizes ?? [],
          locations: json.locations ?? [],
        });
      })
      .catch(() => {})
      .finally(() => setTmOptionsLoading(false));
  }, []);

  // Derive the active target market at component level so the effect can watch it
  const activeTmForEffect = data.targetMarkets.find(t => t.id === activeTargetMarketId) ?? data.targetMarkets[0] ?? null;
  const tmFilterKey = [
    activeTmForEffect?.id ?? "",
    activeTmForEffect?.industries.join("|") ?? "",
    activeTmForEffect?.companySizes.join("|") ?? "",
    activeTmForEffect?.locations.join("|") ?? "",
  ].join("__");

  useEffect(() => {
    const tm = activeTmForEffect;
    if (!tm) return;
    const params = new URLSearchParams({ limit: "3", page: "1" });
    if (tm.industries.length > 0)    params.set("industry", tm.industries.join(","));
    if (tm.companySizes.length > 0)  params.set("size",     tm.companySizes.join(","));
    if (tm.locations.length > 0)     params.set("location", tm.locations.join(","));
    setTmSampleLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/companies?${params}`);
        const json = await res.json();
        setTmSampleCompanies(json.data ?? []);
        setTmSampleTotal(json.total ?? 0);
      } catch { /* ignore */ } finally { setTmSampleLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [tmFilterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeBc = data.buyingCenters.find(bc => bc.id === activeBuyingCenterId) ?? data.buyingCenters[0] ?? null;

  function updateBuyingCenterSeat(bcId: string, seatName: string, patch: { seniorities?: string[]; departments?: string[] }) {
    setData(d => ({
      ...d,
      buyingCenters: d.buyingCenters.map(bc =>
        bc.id === bcId
          ? { ...bc, seats: bc.seats.map(s => s.seat === seatName ? { ...s, ...patch } : s) }
          : bc
      ),
    }));
  }

  function addBuyingCenter() {
    const id = `bc_${Date.now()}`;
    setData(d => ({
      ...d,
      buyingCenters: [...d.buyingCenters, {
        id,
        name: "New buying center",
        seats: BUYING_CENTER_SEATS.map(s => ({ seat: s.seat, seniorities: [], departments: [] })),
      }],
    }));
    setActiveBuyingCenterId(id);
    setRenamingBcId(id);
    setRenameBcValue("");
  }

  function removeBuyingCenter(id: string) {
    const remaining = data.buyingCenters.filter(bc => bc.id !== id);
    if (remaining.length === 0) return;
    setData(d => ({
      ...d,
      buyingCenters: d.buyingCenters.filter(bc => bc.id !== id),
      liveBuyingCenterId: d.liveBuyingCenterId === id ? null : d.liveBuyingCenterId,
    }));
    if (activeBuyingCenterId === id) setActiveBuyingCenterId(remaining[0].id);
  }

  function renameBuyingCenter(id: string, name: string) {
    if (!name.trim()) return;
    setData(d => ({
      ...d,
      buyingCenters: d.buyingCenters.map(bc => bc.id === id ? { ...bc, name: name.trim() } : bc),
    }));
  }

  const editorPersona = data.voicePersonas.find(persona => persona.id === editorVoicePersonaId)
    ?? data.voicePersonas.find(persona => persona.id === data.activeVoicePersonaId)
    ?? null;
  const editorPersonaId = editorPersona?.id ?? null;
  const editorVoice = editorPersona?.voice ?? data.voice;
  const voiceSummary = editorPersona?.summary ?? "";
  const voiceSummaryLoading = !!editorPersonaId && summaryLoadingPersonaIds.has(editorPersonaId);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const personaFiles = uploadedFiles.filter(file => file.personaId === editorPersonaId);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Setters ──────────────────────────────────────────────────────────────

  function setVoice(patch: Partial<DNAData["voice"]>) {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    setData(d => updateVoicePersona(d, editorPersonaId, patch));
  }
  function setCompany(patch: Partial<DNAData["company"]>) {
    setData(d => ({ ...d, company: { ...d.company, ...patch } }));
  }
  function updateTargetMarketFilters(id: string, patch: Partial<Omit<TargetMarketConfig, "id" | "name">>) {
    setData(d => ({
      ...d,
      targetMarkets: d.targetMarkets.map(tm => tm.id === id ? { ...tm, ...patch } : tm),
    }));
  }
  function addTargetMarket() {
    const id = `tm_${Date.now()}`;
    setData(d => ({
      ...d,
      targetMarkets: [...d.targetMarkets, { id, name: "New target market", industries: [], companySizes: [], locations: [] }],
    }));
    setActiveTargetMarketId(id);
    setRenamingTmId(id);
    setRenameTmValue("");
  }
  function removeTargetMarket(id: string) {
    const remaining = data.targetMarkets.filter(tm => tm.id !== id);
    setData(d => ({
      ...d,
      targetMarkets: d.targetMarkets.filter(tm => tm.id !== id),
      liveTargetMarketId: d.liveTargetMarketId === id ? null : d.liveTargetMarketId,
    }));
    if (activeTargetMarketId === id) setActiveTargetMarketId(remaining[0]?.id ?? "");
  }
  function renameTargetMarket(id: string, name: string) {
    if (!name.trim()) return;
    setData(d => ({
      ...d,
      targetMarkets: d.targetMarkets.map(tm => tm.id === id ? { ...tm, name: name.trim() } : tm),
    }));
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
    const eb: EconomicBenefit = { id: crypto.randomUUID(), type: "pain", label: "", description: "", amount: "", unit: "", frequency: "yearly" };
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
  const c: Customer = {
    id: crypto.randomUUID(),
    rawTestimonial: "",
    customerProfile: "",
    companyId: null,
    companyName: "",
    companyIndustry: "",
    companySize: "",
    companyHeadquarters: "",
    testimonialAttribution: "anonymized",
    anonymizedCustomerLabel: "",
    startingSituation: "",
    customerPriorities: "",
    solutionProvided: "",
    customerTransformation: "",
    results: "",
    economicBenefits: [],
    customerQuote: "",
  };
    setData(d => ({ ...d, customers: [...d.customers, c] }));
  }
  function updateCustomer(id: string, patch: Partial<Customer>) {
    setData(d => ({ ...d, customers: d.customers.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }
  function removeCustomer(id: string) {
    setData(d => ({ ...d, customers: d.customers.filter(c => c.id !== id) }));
  }
  function addCustomerEB(customerId: string) {
    const eb: EconomicBenefit = { id: crypto.randomUUID(), type: "gain", label: "", description: "", amount: "", unit: "", frequency: "yearly" };
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
    const c: Competitor = { id: crypto.randomUUID(), companyId: null, name: "", website: "", productCompared: "", category: [], marketSegments: "", dealFrequency: "", notes: "", theirStrengths: "", buyersPreferThem: "", theyAreBetterWhen: "", avoidClaiming: "", ourStrengths: "", problemsExposingWeakness: "", buyersPreferUs: "", advantagesOverTime: "" };
    setData(d => ({ ...d, competitors: [...d.competitors, c] }));
  }
  function updateCompetitor(id: string, patch: Partial<Competitor>) {
    setData(d => ({ ...d, competitors: d.competitors.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }
  function removeCompetitor(id: string) {
    setData(d => ({ ...d, competitors: d.competitors.filter(c => c.id !== id) }));
  }
  function toggleTag(tag: string) {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    const has = editorVoice.toneTags.includes(tag);
    setVoice({ toneTags: has ? editorVoice.toneTags.filter(t => t !== tag) : [...editorVoice.toneTags, tag] });
  }
  function toggleSuppression(tag: string) {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    const has = editorVoice.suppressions.includes(tag);
    setVoice({ suppressions: has ? editorVoice.suppressions.filter(t => t !== tag) : [...editorVoice.suppressions, tag] });
  }

  function chooseVoicePersona(id: string) {
    if (!profileLoaded || profileLoadError) return;
    const selected = selectVoicePersona(data, id);
    setEditorVoicePersonaId(selected.editorPersonaId);
    const persona = data.voicePersonas.find(item => item.id === selected.editorPersonaId);
    setPersonaNameDraft(persona?.name ?? "");
    setPersonaNameError("");
    setSummaryError("");
    setSummaryErrorPersonaId(null);
    setTextDirtyForProfile(false);
  }

  function createVoicePersona() {
    if (!profileLoaded || profileLoadError) return;
    const id = createVoicePersonaId();
    let name = "New persona";
    let suffix = 2;
    while (data.voicePersonas.some(persona => persona.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      name = `New persona ${suffix++}`;
    }
    const persona: VoicePersona = {
      id,
      name,
      voice: { toneTags: [], communicationStyle: "balanced", writingNotes: "", trainingText: "", suppressions: [], suppressionNotes: "" },
      summary: "",
    };
    setData(current => ({ ...current, voicePersonas: [...current.voicePersonas, persona] }));
    setEditorVoicePersonaId(id);
    setPersonaNameDraft(name);
    setPersonaNameError("");
  }

  function duplicateCurrentVoicePersona() {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    const id = createVoicePersonaId();
    const next = duplicateVoicePersona(data, editorPersonaId, id);
    const name = next.voicePersonas.find(persona => persona.id === id)?.name ?? "New persona";
    setData(next);
    setEditorVoicePersonaId(id);
    setPersonaNameDraft(name);
    setPersonaNameError("");
  }

  function savePersonaName() {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    const result = renameVoicePersona(data, editorPersonaId, personaNameDraft);
    if (result.error) {
      setPersonaNameError(result.error);
      return;
    }
    setData(result.data);
    setPersonaNameDraft(result.data.voicePersonas.find(persona => persona.id === editorPersonaId)?.name ?? "");
    setPersonaNameError("");
  }

  function activateEditedPersona() {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    setData(current => activateVoicePersona(current, editorPersonaId));
  }

  function confirmDeleteVoicePersona(persona: VoicePersona) {
    if (!profileLoaded || profileLoadError) return;
    if (data.voicePersonas.length <= 1) {
      window.alert("Keep at least one voice persona. The final persona cannot be deleted.");
      return;
    }
    const result = deleteVoicePersona(data, persona.id);
    const replacementName = result.data.voicePersonas.find(item => item.id === result.replacementId)?.name ?? "the remaining persona";
    const isActive = persona.id === data.activeVoicePersonaId;
    const consequence = isActive
      ? ` This persona is active, so ${replacementName} will become active and its voice will replace the messaging voice.`
      : "";
    if (!window.confirm(`Delete “${persona.name}”? This cannot be undone.${consequence}`)) return;
    setData(result.data);
    summaryRequestVersions.current.delete(persona.id);
    if (editorVoicePersonaId === persona.id) {
      const nextEditor = result.replacementId ?? result.data.activeVoicePersonaId;
      setEditorVoicePersonaId(nextEditor);
      setPersonaNameDraft(result.data.voicePersonas.find(item => item.id === nextEditor)?.name ?? "");
    }
    setPersonaNameError("");
  }

  function saveVoiceSummary(text: string) {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    // A seller's manual summary supersedes any AI response still in flight.
    summaryRequestVersions.current.set(editorPersonaId, (summaryRequestVersions.current.get(editorPersonaId) ?? 0) + 1);
    setSummaryLoadingPersonaIds(current => {
      const next = new Set(current);
      next.delete(editorPersonaId);
      return next;
    });
    setData(current => updateVoicePersonaSummary(current, editorPersonaId, text));
    setSummaryError("");
    setSummaryErrorPersonaId(null);
  }

  // ── Voice profile generation ─────────────────────────────────────────────

  // Takes explicit voice snapshot so callers are never affected by stale closures
  async function generateVoiceSummary(personaId: string, voice: DNAData["voice"]) {
    const { toneTags, communicationStyle, writingNotes, trainingText, suppressions, suppressionNotes } = voice;
    const hasInputs = toneTags.length > 0 || !!communicationStyle || !!writingNotes || !!trainingText || suppressions.length > 0 || !!suppressionNotes;
    if (!hasInputs || !profileLoaded || profileLoadError) return;

    const signature = JSON.stringify(voice);
    const requestVersion = (summaryRequestVersions.current.get(personaId) ?? 0) + 1;
    summaryRequestVersions.current.set(personaId, requestVersion);
    setSummaryLoadingPersonaIds(current => new Set(current).add(personaId));
    setSummaryError("");
    setSummaryErrorPersonaId(null);
    if (personaId === editorPersonaId) {
      setTextDirtyForProfile(false);
    }
    try {
      const resp = await apiFetch("/api/hq/voice-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toneTags, communicationStyle, writingNotes, trainingText, suppressions, suppressionNotes }),
      });
      if (!resp.ok) throw new Error("Could not generate a voice profile");
      const json = await resp.json() as { summary: string };
      if (summaryRequestVersions.current.get(personaId) !== requestVersion) return;
      setData(current => {
        const target = current.voicePersonas.find(persona => persona.id === personaId);
        if (!target || JSON.stringify(target.voice) !== signature) return current;
        return updateVoicePersonaSummary(current, personaId, json.summary ?? "");
      });
    } catch {
      if (summaryRequestVersions.current.get(personaId) === requestVersion) {
        setSummaryError("Could not generate a voice profile. Your saved summary is unchanged.");
        setSummaryErrorPersonaId(personaId);
      }
    } finally {
      if (summaryRequestVersions.current.get(personaId) === requestVersion) {
        setSummaryLoadingPersonaIds(current => {
          const next = new Set(current);
          next.delete(personaId);
          return next;
        });
      }
    }
  }

  // Picker edits can refresh the profile; switching personas establishes a baseline only.
  useEffect(() => {
    if (!profileLoaded || profileLoadError || !editorPersonaId) return;
    const signature = JSON.stringify(editorVoice);
    const previous = observedVoiceSignature.current;
    if (!previous || previous.id !== editorPersonaId) {
      observedVoiceSignature.current = { id: editorPersonaId, signature };
      setTextDirtyForProfile(false);
      return;
    }
    if (previous.signature === signature) return;
    let before: typeof editorVoice;
    try { before = JSON.parse(previous.signature) as typeof editorVoice; } catch { before = editorVoice; }
    observedVoiceSignature.current = { id: editorPersonaId, signature };
    const pickerChanged = JSON.stringify([before.toneTags, before.communicationStyle, before.suppressions])
      !== JSON.stringify([editorVoice.toneTags, editorVoice.communicationStyle, editorVoice.suppressions]);
    const textChanged = before.writingNotes !== editorVoice.writingNotes || before.trainingText !== editorVoice.trainingText;
    if (textChanged) {
      setTextDirtyForProfile(true);
    }
    if (pickerChanged) void generateVoiceSummary(editorPersonaId, cloneVoice(editorVoice));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded, profileLoadError, editorPersonaId, JSON.stringify(editorVoice)]);

  // ── File upload handling ─────────────────────────────────────────────────

  async function processFile(file: File) {
    const targetPersonaId = editorPersonaId;
    if (!targetPersonaId || !profileLoaded || profileLoadError) return;
    const name = file.name;
    const allowed = name.endsWith(".txt") || name.endsWith(".docx") || name.endsWith(".pdf");
    if (!allowed) return;

    const uploadId = createVoicePersonaId();
    setUploadedFiles(prev => [...prev, { id: uploadId, personaId: targetPersonaId, name, status: "processing" }]);

    try {
      const form = new FormData();
      form.append("file", file);
      const resp = await apiFetch("/api/hq/extract-text", { method: "POST", body: form });
      if (!resp.ok) throw new Error("Extraction failed");
      const { text } = await resp.json() as { text: string };
      setData(current => {
        const target = current.voicePersonas.find(persona => persona.id === targetPersonaId);
        if (!target) return current;
        return updateVoicePersona(current, targetPersonaId, {
          trainingText: target.voice.trainingText
            ? target.voice.trainingText + "\n\n---\n\n" + text
            : text,
        });
      });
      setUploadedFiles(prev => prev.map(f => f.id === uploadId ? { ...f, status: "done" } : f));
    } catch {
      setUploadedFiles(prev => prev.map(f => f.id === uploadId ? { ...f, status: "error" } : f));
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(processFile);
  }

  const voiceHasInputs =
    editorVoice.toneTags.length > 0 ||
    !!editorVoice.communicationStyle ||
    !!editorVoice.writingNotes ||
    !!editorVoice.trainingText ||
    editorVoice.suppressions.length > 0 ||
    !!editorVoice.suppressionNotes;

  return (
    <Shell>
      <div className="hq-approved-design flex w-full flex-1 min-h-0 flex-col gap-6 overflow-y-auto px-6 pb-10 pt-8 md:px-[42px]">

        {/* Page header */}
        <div className="hq-page-header flex flex-wrap items-start justify-between gap-3 border-b border-border pb-[18px]">
          <div className="flex items-center gap-4">
            <div className="hq-page-mark flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
              <Landmark className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.035em] text-foreground">HQ</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your training ground — voice, products, and company context for every AI interaction.
              </p>
            </div>
          </div>
          <div className={cn(
            "hq-save-status flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
            saveError || profileLoadError
              ? "text-destructive bg-destructive/10 border-destructive/30"
              : saved
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-muted-foreground bg-secondary border-border/50"
          )} role={saveError || profileLoadError ? "alert" : "status"}>
            {saved && !saveError ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {profileLoadError ? "Profile unavailable — reload to retry" : !profileLoaded ? "Loading HQ…" : saveError || (saved ? "Saved" : "Auto-saving")}
          </div>
        </div>
        {toolbar}

        {/* Two-column body */}
        <div className="flex flex-col gap-6 items-stretch lg:flex-row lg:items-start" inert={!profileLoaded || profileLoadError} aria-busy={!profileLoaded}>

          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-border bg-card p-3 lg:hidden">
            <label className="min-w-0 text-xs font-semibold text-muted-foreground">
              HQ section
              <select
                aria-label="HQ section"
                value={activeSection}
                onChange={event => setActiveSection(event.target.value as SectionId)}
                className="mt-1 block h-10 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                {HQ_NAV.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Mode
              <select
                aria-label="HQ mode"
                value={wartime ? "wartime" : "peacetime"}
                onChange={event => { if ((event.target.value === "wartime") !== wartime) toggleMode(); }}
                className="mt-1 block h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="peacetime">Peacetime</option>
                <option value="wartime">Wartime</option>
              </select>
            </label>
          </div>

          {/* Left sidebar nav */}
          <nav className="hq-section-nav sticky top-0 hidden w-56 flex-shrink-0 flex-col gap-0.5 rounded-md border border-border bg-card p-1.5 lg:flex">
            {HQ_NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                  activeSection === item.id
                    ? cn(item.activeBg, item.activeBorder)
                    : "hover:bg-secondary/60 border border-transparent"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border",
                  activeSection === item.id ? cn(item.iconBg, item.activeBorder) : "bg-secondary/60 border-border/50"
                )}>
                  <item.icon className={cn("h-4 w-4", activeSection === item.id ? item.activeText : "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold leading-tight", activeSection === item.id ? item.activeText : "text-foreground")}>{item.title}</p>
                  <p className={cn("text-[10px] mt-0.5 truncate", activeSection === item.id ? cn(item.activeText, "opacity-70") : "text-muted-foreground")}>{item.description}</p>
                </div>
              </button>
            ))}

            {/* Mode selector */}
            <div className="mt-2 border-t border-border pt-2">
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mode</p>
              <button
                onClick={() => { if (wartime) toggleMode(); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                  !wartime
                    ? "bg-primary/8 border-primary/20"
                    : "border-transparent hover:bg-secondary/60"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border",
                  !wartime ? "bg-primary/10 border-primary/20" : "bg-secondary/60 border-border/50"
                )}>
                  <ShieldCheck className={cn("h-4 w-4", !wartime ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold leading-tight", !wartime ? "text-primary" : "text-foreground")}>Peacetime</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground leading-snug">Expand & warm pipeline</p>
                </div>
                {!wartime && <div className="ml-auto h-4 w-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><div className="h-1.5 w-1.5 rounded-full bg-background dark:bg-background" /></div>}
              </button>
              <button
                onClick={() => { if (!wartime) toggleMode(); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                  wartime
                    ? "bg-[#F4E2D8] border-[#DDB99E] dark:bg-[#3d1c12] dark:border-[#5a2c1d]"
                    : "border-transparent hover:bg-secondary/60"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border",
                  wartime ? "bg-[#E8C4B0] border-[#DDB99E] dark:bg-[#5a2c1d] dark:border-[#7c3e2a]" : "bg-secondary/60 border-border/50"
                )}>
                  <Flame className={cn("h-4 w-4", wartime ? "text-[#7C3E2A] dark:text-[#edd4c6]" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold leading-tight", wartime ? "text-[#7C3E2A] dark:text-[#edd4c6]" : "text-foreground")}>Wartime</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground leading-snug">Focus & close deals</p>
                </div>
                {wartime && <div className="ml-auto h-4 w-4 rounded-full bg-[#7C3E2A] dark:bg-[#edd4c6] flex items-center justify-center flex-shrink-0"><div className="h-1.5 w-1.5 rounded-full bg-[#F4E2D8] dark:bg-[#3d1c12]" /></div>}
              </button>
            </div>
          </nav>

          {/* Right content pane */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">

        {/* ── Voice & Tone ── */}
        {activeSection === "voice" && (
        <Section
          icon={Mic2}
          title="Your Voice & Tone"
          subtitle="How you communicate — personality, style, and language patterns"
          accentBg="bg-violet-50"
          accentBorder="border-violet-200"
          accentColor="text-violet-600"
        >
          <div className="rounded-2xl border border-violet-200/70 bg-background p-5 shadow-sm dark:border-violet-500/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">Persona library</span>
                  <span className="rounded-full border border-violet-200 bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-500/30 dark:text-violet-300">
                    {data.voicePersonas.length} {data.voicePersonas.length === 1 ? "voice" : "voices"}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold text-foreground">One voice, shaped for each conversation.</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  Voice fields and profile summaries auto-save to your account. Choose a persona to edit without changing the voice your messaging uses; only “Use this persona” switches the active voice.
                </p>
              </div>
              <button
                type="button"
                data-testid="button-add-voice-persona"
                onClick={createVoicePersona}
                disabled={!profileLoaded || profileLoadError}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> New persona
              </button>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {data.voicePersonas.map(persona => {
                const isEditor = persona.id === editorPersonaId;
                const isActive = persona.id === data.activeVoicePersonaId;
                return (
                  <div
                    key={persona.id}
                    data-testid={`card-voice-persona-${persona.id}`}
                    className={cn(
                      "min-w-0 rounded-xl border p-3 transition-colors",
                      isEditor ? "border-violet-400 bg-background shadow-sm ring-1 ring-violet-200 dark:ring-violet-500/30" : "border-border/70 bg-background/70",
                    )}
                  >
                    <button
                      type="button"
                      data-testid={`button-edit-voice-persona-${persona.id}`}
                      onClick={() => chooseVoicePersona(persona.id)}
                      disabled={!profileLoaded || profileLoadError}
                      className="w-full text-left"
                      aria-pressed={isEditor}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-foreground">{persona.name}</span>
                        <span className="flex flex-shrink-0 items-center gap-1">
                          {isActive && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">Active</span>}
                          {isEditor && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">Editing</span>}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                        {persona.voice.toneTags.length ? persona.voice.toneTags.slice(0, 3).join(" · ") : "No tone tags yet"}
                      </span>
                    </button>
                    <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-2.5">
                      {isEditor && !isActive ? (
                        <button
                          type="button"
                          data-testid={`button-activate-voice-persona-${persona.id}`}
                          onClick={activateEditedPersona}
                          disabled={!profileLoaded || profileLoadError}
                          className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-emerald-800"
                        >
                          Use this persona
                        </button>
                      ) : (
                        <span className="flex-1 text-[10px] text-muted-foreground">
                          {isActive ? "Used by messaging" : "Not active"}
                        </span>
                      )}
                      {isEditor && (
                        <>
                          <button
                            type="button"
                            data-testid="button-duplicate-voice-persona"
                            onClick={duplicateCurrentVoicePersona}
                            disabled={!profileLoaded || profileLoadError}
                            title="Duplicate persona"
                            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border/70 px-2 py-1.5 text-[10px] font-semibold text-foreground hover:bg-secondary"
                          >
                            <Copy className="h-3 w-3" /> Duplicate
                          </button>
                          <button
                            type="button"
                            data-testid="button-delete-voice-persona"
                            onClick={() => confirmDeleteVoicePersona(persona)}
                            disabled={!profileLoaded || profileLoadError || data.voicePersonas.length <= 1}
                            title={data.voicePersonas.length <= 1 ? "Keep at least one persona" : "Delete persona"}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {data.voicePersonas.length === 0 && (
                <div className="rounded-xl border border-dashed border-violet-300 bg-background/60 p-4 text-xs text-muted-foreground">
                  Your first voice persona will appear here after the profile finishes loading.
                </div>
              )}
            </div>

            {editorPersona && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-200/70 bg-background/80 p-3 sm:flex-row sm:items-end dark:border-violet-500/20">
                <div className="min-w-0 flex-1">
                  <label htmlFor="voice-persona-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Editing persona name</label>
                  <input
                    id="voice-persona-name"
                    data-testid="input-voice-persona-name"
                    value={personaNameDraft}
                    maxLength={120}
                    disabled={!profileLoaded || profileLoadError}
                    onChange={event => { setPersonaNameDraft(event.target.value); setPersonaNameError(""); }}
                    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); savePersonaName(); } }}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200/70"
                  />
                  {personaNameError && <p className="mt-1 text-[11px] font-medium text-destructive" role="alert">{personaNameError}</p>}
                </div>
                <button
                  type="button"
                  data-testid="button-save-voice-persona-name"
                  onClick={savePersonaName}
                  disabled={!profileLoaded || profileLoadError}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-200"
                >
                  Save name
                </button>
                {editorPersona.id !== data.activeVoicePersonaId && (
                  <p className="basis-full text-[10px] leading-relaxed text-violet-800/80 dark:text-violet-200/80">
                    You are editing a draft selection. Changes save automatically. Messaging continues to use {data.voicePersonas.find(persona => persona.id === data.activeVoicePersonaId)?.name ?? "the active persona"} until you explicitly activate this one.
                  </p>
                )}
              </div>
            )}
          </div>

          <Field label="Tone tags" hint="Select all that apply">
            <div className="flex flex-wrap gap-2">
              {TONE_SUGGESTIONS.map(tag => {
                const active = editorVoice.toneTags.includes(tag);
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
                const active = editorVoice.communicationStyle === opt.value;
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
              value={editorVoice.writingNotes}
              onChange={v => setVoice({ writingNotes: v })}
              placeholder="e.g. I keep sentences short and punchy. I avoid jargon. I like to lead with a question that makes the reader think…"
              rows={4}
            />
            <SaveFieldButton
              show={!!editorVoice.writingNotes}
              onSave={() => editorPersonaId && generateVoiceSummary(editorPersonaId, cloneVoice(editorVoice))}
            />
          </Field>

          {/* Training communications */}
          <Field
            label="Training communications"
            hint="Paste emails, messages, or any writing you want Whyhello to learn from"
          >
            <Textarea
              value={editorVoice.trainingText}
              onChange={v => setVoice({ trainingText: v })}
              placeholder={`Paste previous emails, LinkedIn messages, proposals, or any writing that reflects how you genuinely communicate. The more you share, the more accurately Whyhello can write in your voice.\n\nYou can also upload .txt, .docx, or .pdf files below — the extracted text will be added here automatically.`}
              rows={10}
            />
            <SaveFieldButton
              show={!!editorVoice.trainingText}
              onSave={() => editorPersonaId && generateVoiceSummary(editorPersonaId, cloneVoice(editorVoice))}
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
            {personaFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {personaFiles.map(f => (
                  <div
                    key={f.id}
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
                      onClick={e => { e.stopPropagation(); setUploadedFiles(prev => prev.filter(file => file.id !== f.id)); }}
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
          <div className="flex flex-col gap-4 rounded-xl border border-rose-200/60 dark:border-rose-500/30 bg-rose-50/30 dark:bg-background px-5 py-4">
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
                const active = editorVoice.suppressions.includes(tag);
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
                value={editorVoice.suppressionNotes}
                onChange={e => setVoice({ suppressionNotes: e.target.value })}
                rows={3}
                placeholder="Anything else to avoid — phrases, structural habits, or stylistic tics you want to leave behind…"
                className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-rose-300/40 leading-relaxed transition-colors"
              />
              <SaveFieldButton
                show={!!editorVoice.suppressionNotes}
                onSave={() => editorPersonaId && generateVoiceSummary(editorPersonaId, cloneVoice(editorVoice))}
              />
            </div>
          </div>

          {/* AI Voice Profile card */}
          <VoiceProfileCard
            key={editorPersonaId ?? "voice-persona-none"}
            summary={voiceSummary}
            loading={voiceSummaryLoading}
            onRefresh={() => editorPersonaId && generateVoiceSummary(editorPersonaId, cloneVoice(editorVoice))}
            onSave={saveVoiceSummary}
            hasInputs={voiceHasInputs}
            textDirty={textDirtyForProfile}
          />
          {summaryError && summaryErrorPersonaId === editorPersonaId && (
            <p className="text-xs text-destructive" role="status">{summaryError}</p>
          )}
        </Section>
        )}

        {/* ── Products ── */}
        {activeSection === "products" && (
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
                            ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/30 dark:bg-background"
                            : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-background"
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

                        {/* Economic benefit label */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Economic benefit</label>
                          <input
                            type="text"
                            value={eb.label}
                            onChange={e => updateEconomicBenefit(product.id, eb.id, { label: e.target.value })}
                            placeholder={eb.type === "pain" ? "e.g. Reduced compliance overhead" : "e.g. Net-new asset growth"}
                            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors"
                          />
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
                              : "e.g. Recurring revenue generated from new client assets"}
                            className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 leading-relaxed transition-colors"
                          />
                        </div>

                        {/* Amount + Unit of measurement + Frequency */}
                        <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Amount</label>
                            <input
                              type="text"
                              value={eb.amount}
                              onChange={e => updateEconomicBenefit(product.id, eb.id, { amount: e.target.value })}
                              placeholder="e.g. $9,000"
                              className="h-9 w-28 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit of measurement</label>
                            <input
                              type="text"
                              value={eb.unit}
                              onChange={e => updateEconomicBenefit(product.id, eb.id, { unit: e.target.value })}
                              placeholder="e.g. Per $1M of net-new AUM"
                              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors"
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

                        {/* Natural language confirmation */}
                        {(() => {
                          const parts = buildProductEBParts(product.name, eb);
                          return parts ? (
                            <EBSummary
                              parts={parts}
                              colorClass={eb.type === "pain" ? "bg-rose-50/60 dark:bg-background border-rose-200/70 dark:border-rose-500/30" : "bg-emerald-50/60 dark:bg-background border-emerald-200/70 dark:border-emerald-500/30"}
                              iconClass={eb.type === "pain" ? "text-rose-400" : "text-emerald-500"}
                            />
                          ) : null;
                        })()}
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
        )}

        {/* ── Customers ── */}
        {activeSection === "customers" && (
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
        )}

        {/* ── Competitors ── */}
        {activeSection === "competitors" && (
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
        )}

        {/* ── Audience ── */}
        {activeSection === "buyingCenter" && (
        <Section
          icon={Users2}
          title="Buying Center"
          subtitle="Map the buying center — define who typically fills each role and which contacts in Whyhello match them"
          accentBg="bg-indigo-50"
          accentBorder="border-indigo-200"
          accentColor="text-indigo-600"
        >
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-background px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Choose one live Buying Center</p>
            <p className="text-xs text-muted-foreground mt-1">
              The live Buying Center powers seat badges on contact profiles and other platform features. Opening a tab only edits it; use “Make live” to connect it. No badges appear until a seat has matching criteria.
            </p>
            <p className="text-xs font-medium mt-2 text-indigo-700 dark:text-indigo-300">
              {data.buyingCenters.find(bc => bc.id === data.liveBuyingCenterId)?.name
                ? `Live now: ${data.buyingCenters.find(bc => bc.id === data.liveBuyingCenterId)?.name}`
                : "No live Buying Center selected"}
            </p>
          </div>
          {data.buyingCenters.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="h-12 w-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                <Users2 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No buying centers defined yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">Add a buying center to map the roles and seat criteria for your typical deals</p>
              </div>
              <button
                onClick={addBuyingCenter}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add buying center
              </button>
            </div>
          ) : (
            <>
              {/* Buying center tab bar */}
              <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-border/40 mb-2">
                {data.buyingCenters.map(bc => (
                  <div
                    key={bc.id}
                    className={cn(
                      "group flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all",
                      activeBuyingCenterId === bc.id
                        ? "bg-indigo-100 border-indigo-300"
                        : "bg-secondary/50 border-border/60 hover:bg-secondary cursor-pointer"
                    )}
                  >
                    {renamingBcId === bc.id ? (
                      <form
                        onSubmit={e => { e.preventDefault(); renameBuyingCenter(bc.id, renameBcValue); setRenamingBcId(null); }}
                        className="flex items-center"
                      >
                        <input
                          autoFocus
                          value={renameBcValue}
                          onChange={e => setRenameBcValue(e.target.value)}
                          onBlur={() => { renameBuyingCenter(bc.id, renameBcValue); setRenamingBcId(null); }}
                          className="bg-transparent outline-none text-sm font-semibold w-32 text-indigo-700"
                          placeholder="Name this buying center…"
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => setActiveBuyingCenterId(bc.id)}
                        onDoubleClick={() => { setRenamingBcId(bc.id); setRenameBcValue(bc.name); }}
                        className={cn(
                          "text-sm font-semibold",
                          activeBuyingCenterId === bc.id ? "text-indigo-700" : "text-muted-foreground"
                        )}
                      >
                        {bc.name}
                      </button>
                    )}
                    {data.liveBuyingCenterId === bc.id && (
                      <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Live</span>
                    )}
                    {data.buyingCenters.length > 1 && !renamingBcId && (
                      <button
                        onClick={e => { e.stopPropagation(); removeBuyingCenter(bc.id); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addBuyingCenter}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-border hover:border-indigo-300 hover:bg-indigo-50/50 text-xs font-semibold text-muted-foreground hover:text-indigo-700 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New buying center
                </button>
              </div>

              {activeBc && (
                <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border/60 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {data.liveBuyingCenterId === activeBc.id ? "This Buying Center is live across the platform." : "This Buying Center is a draft until you make it live."}
                  </span>
                  <button
                    type="button"
                    disabled={!profileLoaded || profileLoadError}
                    aria-pressed={data.liveBuyingCenterId === activeBc.id}
                    onClick={() => setData(d => ({
                      ...d,
                      liveBuyingCenterId: d.liveBuyingCenterId === activeBc.id ? null : activeBc.id,
                    }))}
                    className={cn("shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                      data.liveBuyingCenterId === activeBc.id
                        ? "border-indigo-300 bg-indigo-100 text-indigo-800 hover:bg-indigo-50 dark:bg-background dark:text-indigo-300"
                        : "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700")}
                  >
                    {data.liveBuyingCenterId === activeBc.id ? "Remove live" : "Make live"}
                  </button>
                </div>
              )}
              {activeSeat && activeBc && (
                <BuyingCenterModal
                  seatName={activeSeat}
                  seniorities={activeBc.seats.find(s => s.seat === activeSeat)?.seniorities ?? []}
                  departments={activeBc.seats.find(s => s.seat === activeSeat)?.departments ?? []}
                  roleOptions={roleOptions}
                  rolesLoading={rolesLoading}
                  rolesError={rolesError}
                  onUpdate={patch => updateBuyingCenterSeat(activeBc.id, activeSeat, patch)}
                  open={!!activeSeat}
                  onClose={() => setActiveSeat(null)}
                />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(activeBc?.seats ?? []).map(seat => (
                  <BuyingCenterTile
                    key={seat.seat}
                    seat={seat}
                    onClick={() => setActiveSeat(seat.seat)}
                  />
                ))}
              </div>
            </>
          )}
        </Section>
        )}

        {/* ── Target Market ── */}
        {activeSection === "targetMarket" && (() => {
          const activeTm = data.targetMarkets.find(t => t.id === activeTargetMarketId) ?? data.targetMarkets[0] ?? null;
          return (
          <Section
            icon={Globe}
            title="Target Market"
            subtitle="Define your ideal customer company — these filters map directly to the Company filters in Directory Search"
            accentBg="bg-teal-50"
            accentBorder="border-teal-200"
            accentColor="text-teal-600"
          >
            <div className="rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-background px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">Choose one live Target Market</p>
              <p className="text-xs text-muted-foreground mt-1">
                The live Target Market identifies companies that meet all its configured criteria and powers company badges and other platform features. Opening a tab only edits it; use “Make live” to connect it. Add at least one criterion to get matches.
              </p>
              <p className="text-xs font-medium mt-2 text-teal-700 dark:text-teal-300">
                {data.targetMarkets.find(tm => tm.id === data.liveTargetMarketId)?.name
                  ? `Live now: ${data.targetMarkets.find(tm => tm.id === data.liveTargetMarketId)?.name}`
                  : "No live Target Market selected"}
              </p>
            </div>
            {data.targetMarkets.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-14 text-center">
                <div className="h-12 w-12 rounded-2xl bg-teal-100 border border-teal-200 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No target markets defined yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">Add a target market to define the ideal company profile for a segment you sell into</p>
                </div>
                <button
                  onClick={addTargetMarket}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add target market
                </button>
              </div>
            ) : (<>
            {/* Target market tab bar */}
            <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-border/40 mb-2">
              {data.targetMarkets.map(tm => (
                <div
                  key={tm.id}
                  className={cn(
                    "group flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all",
                    activeTargetMarketId === tm.id
                      ? "bg-teal-100 border-teal-300"
                      : "bg-secondary/50 border-border/60 hover:bg-secondary cursor-pointer"
                  )}
                >
                  {renamingTmId === tm.id ? (
                    <form
                      onSubmit={e => { e.preventDefault(); renameTargetMarket(tm.id, renameTmValue); setRenamingTmId(null); }}
                      className="flex items-center"
                    >
                      <input
                        autoFocus
                        value={renameTmValue}
                        onChange={e => setRenameTmValue(e.target.value)}
                        onBlur={() => {
                          if (renameTmValue.trim()) {
                            renameTargetMarket(tm.id, renameTmValue);
                          } else {
                            removeTargetMarket(tm.id);
                          }
                          setRenamingTmId(null);
                        }}
                        className="bg-transparent outline-none text-sm font-semibold w-36 text-teal-700 placeholder:text-teal-400"
                        placeholder="Name this market…"
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => setActiveTargetMarketId(tm.id)}
                      onDoubleClick={() => { setRenamingTmId(tm.id); setRenameTmValue(tm.name); }}
                      className={cn(
                        "text-sm font-semibold",
                        activeTargetMarketId === tm.id ? "text-teal-700" : "text-muted-foreground"
                      )}
                    >
                      {tm.name}
                    </button>
                  )}
                  {data.liveTargetMarketId === tm.id && (
                    <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Live</span>
                  )}
                  {data.targetMarkets.length > 1 && !renamingTmId && (
                    <button
                      onClick={e => { e.stopPropagation(); removeTargetMarket(tm.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTargetMarket}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-border hover:border-teal-300 hover:bg-teal-50/50 text-xs font-semibold text-muted-foreground hover:text-teal-700 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                New target market
              </button>
            </div>

            {activeTm && (
              <>
                <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border/60 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {data.liveTargetMarketId === activeTm.id ? "This Target Market is live across the platform." : "This Target Market is a draft until you make it live."}
                  </span>
                  <button
                    type="button"
                    disabled={!profileLoaded || profileLoadError}
                    aria-pressed={data.liveTargetMarketId === activeTm.id}
                    onClick={() => setData(d => ({
                      ...d,
                      liveTargetMarketId: d.liveTargetMarketId === activeTm.id ? null : activeTm.id,
                    }))}
                    className={cn("shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                      data.liveTargetMarketId === activeTm.id
                        ? "border-teal-300 bg-teal-100 text-teal-800 hover:bg-teal-50 dark:bg-background dark:text-teal-300"
                        : "border-teal-600 bg-teal-600 text-white hover:bg-teal-700")}
                  >
                    {data.liveTargetMarketId === activeTm.id ? "Remove live" : "Make live"}
                  </button>
                </div>
                {renamingTmId === activeTm.id ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border border-dashed border-border/60 bg-secondary/20">
                    <div className="h-10 w-10 rounded-xl bg-teal-100/70 border border-teal-200/60 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-teal-500/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Name this target market first</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Filters unlock once you've confirmed the name above</p>
                    </div>
                  </div>
                ) : tmOptionsLoading ? (
                  <div className="flex items-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Loading filter options…</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <TargetFilterPicker
                      title="Industry"
                      options={targetMarketOptions.industries}
                      selected={activeTm.industries}
                      onChange={industries => updateTargetMarketFilters(activeTm.id, { industries })}
                    />
                    <TargetFilterPicker
                      title="Company Size"
                      options={targetMarketOptions.companySizes}
                      selected={activeTm.companySizes}
                      onChange={companySizes => updateTargetMarketFilters(activeTm.id, { companySizes })}
                    />
                    <TargetFilterPicker
                      title="Location"
                      options={targetMarketOptions.locations}
                      selected={activeTm.locations}
                      onChange={locations => updateTargetMarketFilters(activeTm.id, { locations })}
                      hint="City or region"
                    />
                  </div>
                )}

                {(activeTm.industries.length > 0 || activeTm.companySizes.length > 0 || activeTm.locations.length > 0) && (
                  <div className="rounded-xl bg-teal-50 border border-teal-200 dark:bg-background dark:border-teal-500/30 p-4 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wide">
                        ICP summary — {activeTm.name}
                      </p>
                      {tmSampleLoading ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-teal-600 dark:text-teal-300 bg-background border border-teal-200 dark:border-teal-500/20 rounded-full px-2.5 py-0.5">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          counting…
                        </span>
                      ) : tmSampleTotal !== null ? (
                        <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-background border border-teal-200 dark:border-teal-500/20 rounded-full px-2.5 py-0.5">
                          {tmSampleTotal.toLocaleString()} {tmSampleTotal === 1 ? "company" : "companies"} in your database
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeTm.industries.map(v => (
                        <span key={`ind-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-teal-200 dark:border-teal-500/20 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                          <Globe className="h-2.5 w-2.5 flex-shrink-0" />{v}
                        </span>
                      ))}
                      {activeTm.companySizes.map(v => (
                        <span key={`sz-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-teal-200 dark:border-teal-500/20 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                          <BarChart3 className="h-2.5 w-2.5 flex-shrink-0" />{v}
                        </span>
                      ))}
                      {activeTm.locations.map(v => (
                        <span key={`loc-${v}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-teal-200 dark:border-teal-500/20 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />{v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Company examples */}
                {(activeTm.industries.length > 0 || activeTm.companySizes.length > 0 || activeTm.locations.length > 0) && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-foreground">Example companies</p>
                    {tmSampleLoading ? (
                      <div className="grid grid-cols-3 gap-2">
                        {[0,1,2].map(i => (
                          <div key={i} className="flex flex-col gap-2 p-3 rounded-xl border border-border/40 bg-secondary/20 animate-pulse">
                            <div className="h-7 w-7 rounded-lg bg-border/60" />
                            <div className="h-2.5 w-3/4 bg-border/60 rounded" />
                            <div className="h-2 w-1/2 bg-border/40 rounded" />
                          </div>
                        ))}
                      </div>
                    ) : tmSampleCompanies.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-border/40 bg-secondary/20">
                        <Building2 className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <p className="text-xs text-muted-foreground">No companies in your database match these criteria</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {tmSampleCompanies.map(c => (
                          <div key={c.id} className="flex flex-col gap-2 p-3 rounded-xl border border-border/40 bg-secondary/20 dark:bg-background min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center shrink-0">
                              <Building2 className="h-3.5 w-3.5 text-teal-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground leading-snug truncate">{c.name}</p>
                              {c.industry && (
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.industry}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-auto">
                              {c.size && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 border border-teal-200 text-teal-700 truncate max-w-full">
                                  {c.size}
                                </span>
                              )}
                              {c.location && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-secondary/80 border border-border/40 text-muted-foreground truncate max-w-full">
                                  {c.location}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            </>
          )}
          </Section>
          );
        })()}

        {/* ── Company ── */}
        {activeSection === "company" && (
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
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 py-2 justify-center">
          <Sparkles className="h-3 w-3 text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Everything you add here is used by the Strategy Assistant to write and advise in your voice.
          </p>
        </div>

          </div>{/* /right-pane */}
        </div>{/* /two-col */}

      </div>
    </Shell>
  );
}
