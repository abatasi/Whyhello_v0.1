import { useState, useEffect, useRef } from "react";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";
import {
  Mic2, Package, Building2, Plus, Trash2, ChevronDown,
  Save, CheckCircle2, Dna, Sparkles,
} from "lucide-react";

// ── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = "whyhello_dna_v1";

function loadDNA(): DNAData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaultDNA();
}

function saveDNA(data: DNAData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Types ────────────────────────────────────────────────────────────────────

type ToneTag = string;

interface Product {
  id: string;
  name: string;
  tagline: string;
  features: string;
  outcomes: string;
  persona: string;
}

interface DNAData {
  voice: {
    toneTags: ToneTag[];
    communicationStyle: string;
    writingNotes: string;
    examplePhrases: string;
  };
  products: Product[];
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
      examplePhrases: "",
    },
    products: [],
    company: {
      name: "",
      valueWedge: "",
      positioning: "",
      differentiators: "",
      pillars: ["", "", ""],
    },
  };
}

const TONE_SUGGESTIONS = [
  "Direct", "Empathetic", "Confident", "Consultative", "Witty",
  "Professional", "Warm", "Data-driven", "Story-driven", "Concise",
  "Energetic", "Authoritative",
];

const STYLE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "balanced", label: "Balanced" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
  { value: "executive", label: "Executive" },
];

// ── Auto-save hook ───────────────────────────────────────────────────────────

function useAutoSave(data: DNAData) {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDNA(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [data]);

  return saved;
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  subtitle,
  accentBg,
  accentBorder,
  accentColor,
  defaultOpen = true,
  children,
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
        <div className={cn("border-t border-border/40 px-6 py-6 flex flex-col gap-6")}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Field components ─────────────────────────────────────────────────────────

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
      className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 leading-relaxed transition-colors"
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

// ── Main page ────────────────────────────────────────────────────────────────

export default function DNA() {
  const [data, setData] = useState<DNAData>(loadDNA);
  const saved = useAutoSave(data);

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
    const p: Product = { id: crypto.randomUUID(), name: "", tagline: "", features: "", outcomes: "", persona: "" };
    setData(d => ({ ...d, products: [...d.products, p] }));
  }
  function updateProduct(id: string, patch: Partial<Product>) {
    setData(d => ({ ...d, products: d.products.map(p => p.id === id ? { ...p, ...patch } : p) }));
  }
  function removeProduct(id: string) {
    setData(d => ({ ...d, products: d.products.filter(p => p.id !== id) }));
  }
  function toggleTag(tag: string) {
    setData(d => {
      const has = d.voice.toneTags.includes(tag);
      return { ...d, voice: { ...d.voice, toneTags: has ? d.voice.toneTags.filter(t => t !== tag) : [...d.voice.toneTags, tag] } };
    });
  }

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
          </Field>

          <Field label="Example phrases or openers" hint="Phrases you naturally use or love">
            <Textarea
              value={data.voice.examplePhrases}
              onChange={v => setVoice({ examplePhrases: v })}
              placeholder="e.g. 'Curious if you've seen…' / 'Quick thought based on your recent…' / 'Totally understand if the timing's off…'"
              rows={3}
            />
          </Field>
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
              placeholder="e.g. For revenue teams at growth-stage B2B companies who struggle to personalise outreach at scale, Whyhello is a relationship intelligence platform that surfaces the right context at the right moment — unlike generic CRMs that capture history but not opportunity."
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
                  <span className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border",
                    "bg-emerald-50 border-emerald-200 text-emerald-700"
                  )}>
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

        {/* Footer hint */}
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
