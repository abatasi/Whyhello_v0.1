import { createEmailVariant, type EmailTiming, type EmailVariant, type EmailPreview, type HqVoiceOptions } from "./manual-email-model";

export const CONNECTION_NOTE_LIMIT = 200;
export interface ConnectionPreview {
  body: string; contactId: number; personalization: string;
  insightsUsed: EmailPreview["insightsUsed"];
  templateBody?: string;
}
export interface ConnectionVariant extends Omit<EmailVariant, "emailType" | "templateId" | "templateSubject" | "templateBody" | "preview"> {
  objective: "Connect" | "Reconnect";
  templateBody: string;
  preview?: ConnectionPreview;
}
export interface LinkedInConnectionConfiguration {
  version: 1; enabled: boolean; createTiming: EmailTiming; dueTiming: EmailTiming;
  variants: ConnectionVariant[];
}
export function createConnectionVariant(name = "Test A", voiceOptions?: HqVoiceOptions): ConnectionVariant {
  const { emailType: _type, templateId: _id, templateSubject: _subject, templateBody: _body, preview: _preview, ...common } = createEmailVariant(name, voiceOptions);
  return { ...common, objective: "Connect", templateBody: "" };
}
export function createLinkedInConnectionConfiguration(voiceOptions?: HqVoiceOptions): LinkedInConnectionConfiguration {
  return { version: 1, enabled: true, createTiming: { unit: "immediately", amount: 1, at: "" },
    dueTiming: { unit: "minutes", amount: 30, at: "" }, variants: [createConnectionVariant("Test A", voiceOptions)] };
}
export function readLinkedInConnectionConfiguration(value: unknown): LinkedInConnectionConfiguration {
  const base = createLinkedInConnectionConfiguration();
  if (!value || typeof value !== "object") return base;
  const config = value as Partial<LinkedInConnectionConfiguration>;
  return { ...base, ...config, createTiming: { ...base.createTiming, ...config.createTiming }, dueTiming: { ...base.dueTiming, ...config.dueTiming },
    variants: Array.isArray(config.variants) && config.variants.length ? config.variants.map(v => {
      const merged = { ...createConnectionVariant(v.name), ...v };
      if (merged.userContext.trim() && !merged.contextSources.includes("custom")) merged.contextSources = [...merged.contextSources, "custom"];
      return merged;
    }) : base.variants };
}
export function validateLinkedInConnectionConfiguration(config: LinkedInConnectionConfiguration): string | null {
  if (!config.enabled) return null;
  if (!config.variants.length || config.variants.length > 6) return "Use one to six connection-note variants.";
  if (new Set(config.variants.map(v => v.id)).size !== config.variants.length) return "Every connection variant needs a unique identity.";
  if (config.variants.reduce((sum, v) => sum + v.allocation, 0) !== 100) return "Connection-note traffic allocation must total 100%.";
  for (const t of [config.createTiming, config.dueTiming]) {
    if (!Number.isInteger(t.amount) || t.amount < 1 || t.amount > 525600) return "Set a whole-number timing interval from 1 to 525600.";
    if (t.unit === "specific" && (!t.at || Number.isNaN(Date.parse(t.at)))) return "Choose a valid task date and time.";
  }
  for (const v of config.variants) {
    if (!v.name.trim()) return "Give every connection-note variant a name.";
    if (!Number.isInteger(v.allocation) || v.allocation < 0 || v.allocation > 100) return "Traffic percentages must be whole numbers from 0 to 100.";
    if (v.guidelines.length > 30 || v.guidelines.some(g => g.text.length > 1000)) return "Use at most 30 guidelines of 1000 characters each.";
    if (!v.allocation) continue;
    if (v.tone === "Custom" && !v.customTone.trim()) return `${v.name}: add custom tone instructions.`;
    if (v.mode === "prompt" && !v.prompt.trim()) return `${v.name}: add generation instructions.`;
    if (v.mode === "template" && !v.templateBody.trim()) return `${v.name}: add a connection-note template.`;
    if (v.mode === "template" && v.preview?.templateBody !== v.templateBody) return `${v.name}: preview the current template for a contact before activation.`;
    if (!v.preview?.body.trim()) return `${v.name}: generate a contact preview before activation.`;
    if (v.preview.body.length > CONNECTION_NOTE_LIMIT) return `${v.name}: connection notes must be 200 characters or fewer.`;
    if (v.mode === "template" && !v.templateBody.includes("{{") && v.templateBody.length > CONNECTION_NOTE_LIMIT) return `${v.name}: connection notes must be 200 characters or fewer.`;
  }
  return null;
}