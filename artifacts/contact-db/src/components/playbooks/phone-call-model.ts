import { createEmailVariant, type EmailTiming, type EmailVariant, type EmailPreview, type HqVoiceOptions } from "./manual-email-model";

export interface CallScript {
  opener: string;
  talkingPoints: string[];
  questions: string[];
  objections: { objection: string; response: string }[];
  voicemail: string;
  closing: string;
}
export interface CallPreview extends CallScript {
  contactId: number;
  personalization: string;
  insightsUsed: EmailPreview["insightsUsed"];
}
export interface CallVariant extends Omit<EmailVariant, "emailType" | "templateId" | "templateSubject" | "templateBody" | "preview"> {
  objective: "First conversation" | "Follow-up" | "Reconnect";
  template: CallScript;
  preview?: CallPreview;
}
export interface PhoneCallConfiguration {
  version: 1;
  enabled: boolean;
  createTiming: EmailTiming;
  dueTiming: EmailTiming;
  variants: CallVariant[];
}
export function createCallVariant(name = "Test A", voiceOptions?: HqVoiceOptions): CallVariant {
  const { emailType: _emailType, templateId: _templateId, templateSubject: _subject, templateBody: _body, preview: _preview, ...common } = createEmailVariant(name, voiceOptions);
  return { ...common, objective: "First conversation", template: { opener: "", talkingPoints: [], questions: [], objections: [], voicemail: "", closing: "" } };
}
export function createPhoneCallConfiguration(voiceOptions?: HqVoiceOptions): PhoneCallConfiguration {
  return { version: 1, enabled: true, createTiming: { unit: "immediately", amount: 1, at: "" }, dueTiming: { unit: "minutes", amount: 30, at: "" }, variants: [createCallVariant("Test A", voiceOptions)] };
}
export function readPhoneCallConfiguration(value: unknown): PhoneCallConfiguration {
  const defaults = createPhoneCallConfiguration();
  if (!value || typeof value !== "object") return defaults;
  const config = value as Partial<PhoneCallConfiguration>;
  return { ...defaults, ...config, createTiming: { ...defaults.createTiming, ...config.createTiming }, dueTiming: { ...defaults.dueTiming, ...config.dueTiming },
    variants: Array.isArray(config.variants) && config.variants.length ? config.variants.map(v => {
      const base = createCallVariant(v.name);
      const merged = { ...base, ...v, template: { ...base.template, ...v.template } };
      if (merged.userContext.trim() && !merged.contextSources.includes("custom")) merged.contextSources = [...merged.contextSources, "custom"];
      return merged;
    }) : defaults.variants };
}
export function validatePhoneCallConfiguration(config: PhoneCallConfiguration): string | null {
  if (!config.enabled) return null;
  if (!config.variants.length || config.variants.length > 6) return "Use one to six call variants.";
  if (new Set(config.variants.map(v => v.id)).size !== config.variants.length) return "Every call variant needs a unique identity.";
  if (config.variants.reduce((sum, v) => sum + v.allocation, 0) !== 100) return "Call variant traffic allocation must total 100%.";
  for (const t of [config.createTiming, config.dueTiming]) {
    if (!Number.isInteger(t.amount) || t.amount < 1 || t.amount > 525600) return "Set a whole-number timing interval from 1 to 525600.";
    if (t.unit === "specific" && (!t.at || Number.isNaN(Date.parse(t.at)))) return "Choose a valid task date and time.";
  }
  for (const v of config.variants) {
    if (!v.name.trim()) return "Give every call variant a name.";
    if (!Number.isInteger(v.allocation) || v.allocation < 0 || v.allocation > 100) return "Traffic percentages must be whole numbers from 0 to 100.";
    if (v.guidelines.length > 30 || v.guidelines.some(g => g.text.length > 1000)) return "Use at most 30 guidelines of 1000 characters each.";
    if (!v.allocation) continue;
    if (v.tone === "Custom" && !v.customTone.trim()) return `${v.name}: add custom tone instructions.`;
    if (v.mode === "prompt" && !v.prompt.trim()) return `${v.name}: add call generation instructions.`;
    const script = v.mode === "template" ? v.template : v.preview;
    if (!script?.opener.trim() || !script.closing.trim() || !script.talkingPoints.some(p => p.trim())) return `${v.name}: ${v.mode === "template" ? "complete the call template" : "generate a call preview"} before activation.`;
  }
  return null;
}