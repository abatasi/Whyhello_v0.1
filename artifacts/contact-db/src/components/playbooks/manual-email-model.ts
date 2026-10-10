import { preferredHqPersonaId } from "../../lib/hq-voice-profile-model";

export type EmailMode = "assisted" | "prompt" | "template";
export type TimingUnit = "immediately" | "minutes" | "hours" | "days" | "business-days" | "specific";
export interface EmailTiming { unit: TimingUnit; amount: number; at: string }
export interface EmailPreview {
  subject: string; body: string; personalization: string; cta: string; contactId: number;
  insightsUsed: { id: string; category: string; title: string; description: string; url: string }[];
  anatomy?: { hook: string; bridge: string; value: string; proof: string; cta: string };
}
export type EmailLength = "short" | "medium" | "long";
export type InsightCategory = "personal" | "company" | "industry" | "role" | "colleagues" | "counterparts";
export interface EmailVariant {
  id: string; name: string; allocation: number; mode: EmailMode;
  emailType: "Outreach" | "Follow-up" | "Last pitch";
  researchSources: string[]; tone: string; customTone: string; inheritHqTone: boolean; voicePersonaId?: string | null;
  length?: EmailLength; insightCategory?: InsightCategory;
  contextSources: string[]; userContext: string;
  guidelines: { id: string; text: string }[];
  generationMode: string; prompt: string; templateId: string;
  templateSubject: string; templateBody: string;
  preview?: EmailPreview;
}
export interface ManualEmailConfiguration {
  version: 1; enabled: boolean;
  createTiming: EmailTiming; dueTiming: EmailTiming;
  variants: EmailVariant[];
}
export interface ManualEmailContext {
  contacts: { id: number; name: string; company: string; enrolled: boolean }[];
  contextSources: { id: string; name: string; content: string }[];
  voice: string; aiAvailable: boolean;
  voicePersonas?: { id: string; name: string; summary?: string }[];
  activeVoicePersonaId?: string | null;
  mailboxes: { id: number; email: string; provider: string }[];
  templates: { id: string; name: string; subject: string; body: string }[];
}
export const RESEARCH_SOURCES = [
  { id: "company-news", name: "Recent Company News" },
  { id: "job-postings", name: "Relevant Job Postings" },
  { id: "executive", name: "Executive Persona Research" },
  { id: "strategic", name: "Strategic Company Research" },
  { id: "personal", name: "Personal" }, { id: "company", name: "Company" },
  { id: "colleagues", name: "Colleagues" }, { id: "industry", name: "Industry" },
  { id: "competitors", name: "Competitors" }, { id: "role", name: "Role" },
  { id: "counterparts", name: "Counterparts" },
];
export type HqVoiceOptions = Pick<ManualEmailContext, "voicePersonas" | "activeVoicePersonaId">;
export function createEmailVariant(name = "Test A", voiceOptions?: HqVoiceOptions): EmailVariant {
  return {
    id: crypto.randomUUID(), name, allocation: 100, mode: "assisted", emailType: "Outreach",
    researchSources: ["executive", "strategic"], tone: "Default", customTone: "", inheritHqTone: true,
    ...(voiceOptions ? { voicePersonaId: preferredHqPersonaId(voiceOptions), inheritHqTone: false } : {}),
    contextSources: ["company", "products", "value-propositions"], userContext: "", guidelines: [],
    generationMode: "Standard", prompt: "", templateId: "", templateSubject: "", templateBody: "",
  };
}
export function createManualEmailConfiguration(voiceOptions?: HqVoiceOptions): ManualEmailConfiguration {
  const first = createEmailVariant("Test A", voiceOptions);
  first.length = "medium";
  first.insightCategory = "personal";
  first.tone = "Professional";
  return {
    version: 1, enabled: true,
    createTiming: { unit: "immediately", amount: 1, at: "" },
    dueTiming: { unit: "minutes", amount: 30, at: "" },
    variants: [first],
  };
}
export function readManualEmailConfiguration(value: unknown): ManualEmailConfiguration {
  const defaults = createManualEmailConfiguration();
  if (!value || typeof value !== "object") return defaults;
  const config = value as Partial<ManualEmailConfiguration>;
  return {
    ...defaults, ...config, createTiming: { ...defaults.createTiming, ...config.createTiming },
    dueTiming: { ...defaults.dueTiming, ...config.dueTiming },
    variants: Array.isArray(config.variants) && config.variants.length
      ? config.variants.map(v => {
          const merged = { ...createEmailVariant(v.name), ...v };
          const legacyLength = merged.generationMode === "Concise" ? "short"
            : merged.generationMode === "Detailed" ? "long" : "medium";
          merged.length = merged.length === "short" || merged.length === "long" || merged.length === "medium"
            ? merged.length : legacyLength;
          const canonicalCategory = (value: string): InsightCategory | undefined => {
            if (value === "personal" || value === "executive") return "personal";
            if (["company", "company-news", "job-postings", "strategic", "competitors"].includes(value)) return "company";
            if (value === "industry" || value === "role" || value === "colleagues" || value === "counterparts") return value;
            return undefined;
          };
          const fromLegacy = merged.researchSources.map(canonicalCategory).find(Boolean);
          merged.insightCategory = canonicalCategory(merged.insightCategory ?? "") ?? fromLegacy ?? "personal";
          if (merged.userContext.trim() && !merged.contextSources.includes("custom")) merged.contextSources = [...merged.contextSources, "custom"];
          return merged;
        }) : defaults.variants,
  };
}
export function validateManualEmailConfiguration(config: ManualEmailConfiguration): string | null {
  if (!config.enabled) return null;
  if (!config.variants.length) return "Add at least one email variant.";
  if (config.variants.length > 6) return "Use at most six email variants.";
  if (config.variants.reduce((sum, v) => sum + v.allocation, 0) !== 100) return "Variant traffic allocation must total 100%.";
  for (const timing of [config.createTiming, config.dueTiming]) {
    if (timing.unit === "specific" && (!timing.at || Number.isNaN(Date.parse(timing.at)))) return "Choose a valid date and time.";
    if (!Number.isInteger(timing.amount) || timing.amount < 1 || timing.amount > 525600) return "Set a whole-number timing interval from 1 to 525600.";
  }
  for (const v of config.variants) {
    if (!v.name.trim()) return "Give each email variant a name.";
    if (v.guidelines.length > 30 || v.guidelines.some(g => g.text.length > 1000)) return `${v.name}: use at most 30 guidelines of 1000 characters each.`;
    if (!Number.isInteger(v.allocation) || v.allocation < 0 || v.allocation > 100) return "Traffic percentages must be whole numbers from 0 to 100.";
    if (!v.allocation) continue;
    if (v.tone === "Custom" && !v.customTone.trim()) return `${v.name}: add custom tone instructions.`;
    if (v.mode === "prompt" && !v.prompt.trim()) return `${v.name}: add generation instructions.`;
    if (v.mode === "template" && (!v.templateSubject.trim() || !v.templateBody.trim())) return `${v.name}: add a template subject and body.`;
    if (v.mode !== "template" && (!v.preview?.subject.trim() || !v.preview.body.trim())) return `${v.name}: generate an email preview before activation.`;
  }
  return null;
}
export function timingSummary(timing: EmailTiming): string {
  if (timing.unit === "immediately") return "immediately";
  if (timing.unit === "specific") return timing.at ? `on ${new Date(timing.at).toLocaleString()}` : "at a specific time";
  return `in ${timing.amount} ${timing.unit.replace("-", " ")}`;
}