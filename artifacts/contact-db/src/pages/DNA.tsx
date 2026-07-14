import { useState, useEffect, useRef } from "react";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";
import {
  Mic2, Package, Building2, Plus, Trash2, ChevronDown,
  Save, CheckCircle2, Dna, Sparkles, Upload, X, FileText,
  Loader2, RefreshCw, Ban,
} from "lucide-react";

// ── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "whyhello_dna_v3";

function loadDNA(): DNAData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DNAData>;
      const d = defaultDNA();
      return {
        ...d,
        ...parsed,
        voice: { ...d.voice, ...(parsed.voice ?? {}) },
        company: { ...d.company, ...(parsed.company ?? {}) },
      };
    }
  } catch { /* ignore */ }
  return defaultDNA();
}

function saveDNA(data: DNAData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Types ────────────────────────────────────────────────────────────────────

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
    toneTags: string[];
    communicationStyle: string;
    writingNotes: string;
    trainingText: string;
    suppressions: string[];
    suppressionNotes: string;
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

// ── Voice Profile card ───────────────────────────────────────────────────────

function VoiceProfileCard({
  summary, loading, onRefresh, hasInputs, textDirty,
}: {
  summary: string;
  loading: boolean;
  onRefresh: () => void;
  hasInputs: boolean;
  textDirty: boolean;
}) {
  if (!hasInputs && !loading && !summary) return null;

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-colors",
      textDirty && summary && !loading
        ? "border-violet-300 bg-violet-50/80"
        : "border-violet-200 bg-violet-50/60"
    )}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-violet-200/60">
        <div className="h-6 w-6 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700 flex-1">Your Voice Profile</span>
        {textDirty && summary && !loading && (
          <span className="text-[10px] text-violet-500 mr-1">Text updated — save fields to refresh</span>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Regenerate"
          className="h-6 w-6 rounded-md flex items-center justify-center text-violet-500 hover:text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>
      <div className="px-4 py-3.5">
        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-3.5 bg-violet-200/60 rounded-full animate-pulse w-full" />
            <div className="h-3.5 bg-violet-200/60 rounded-full animate-pulse w-[88%]" />
            <div className="h-3.5 bg-violet-200/60 rounded-full animate-pulse w-[72%]" />
          </div>
        ) : (
          <p className="text-sm text-violet-900/80 leading-relaxed">{summary}</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DNA() {
  const [data, setData] = useState<DNAData>(loadDNA);
  const saved = useAutoSave(data);

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
