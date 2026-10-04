import {
  Clock, Eye, GitBranch, ListTodo, Mail, MessageSquare, Phone, Send,
  ThumbsUp, UserPlus, type LucideIcon,
} from "lucide-react";
import { createManualEmailConfiguration, readManualEmailConfiguration, validateManualEmailConfiguration } from "./manual-email-model";

export type StepCategory = "communication" | "linkedin" | "seller-actions" | "rules";
export interface StepDefinition {
  id: string;
  type: "action" | "rule";
  category: StepCategory;
  name: string;
  icon: LucideIcon;
  executionMode: "automatic" | "manual" | "logic";
  enabled: boolean;
  configuration: Record<string, unknown>;
  validation: (configuration: Record<string, unknown>) => string | null;
}

export const STEP_CATEGORIES: { id: StepCategory; name: string }[] = [
  { id: "communication", name: "Communication" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "seller-actions", name: "Seller actions" },
];

const notConfigured = () => "Complete this step's configuration before activating.";
const action = (
  id: string, category: StepCategory, name: string, icon: LucideIcon,
  executionMode: StepDefinition["executionMode"] = "manual",
): StepDefinition => ({
  id, type: "action", category, name, icon, executionMode,
  enabled: id === "manual-email", configuration: id === "manual-email" ? { ...createManualEmailConfiguration() } : {},
  validation: id === "manual-email" ? value => validateManualEmailConfiguration(readManualEmailConfiguration(value)) : notConfigured,
});

export const STEP_DEFINITIONS: StepDefinition[] = [
  action("automatic-email", "communication", "Automatic Email", Send, "automatic"),
  action("manual-email", "communication", "Manual Email", Mail),
  action("phone-call", "communication", "Phone Call", Phone),
  action("linkedin-connection-request", "linkedin", "Send Connection Request", UserPlus),
  action("linkedin-message", "linkedin", "Send Message", MessageSquare),
  action("linkedin-profile-view", "linkedin", "View Profile", Eye),
  action("linkedin-post-interaction", "linkedin", "Interact With Post", ThumbsUp),
  action("action-item", "seller-actions", "Action Item", ListTodo),
  ...[
    { id: "time-delay", name: "Time Delay", icon: Clock },
    { id: "split-path", name: "Split Path", icon: GitBranch },
  ].map(rule => ({
    ...rule, type: "rule" as const, category: "rules" as const,
    executionMode: "logic" as const, enabled: false,
    configuration: {}, validation: notConfigured,
  })),
];

export const getStepDefinition = (id: string) => STEP_DEFINITIONS.find(step => step.id === id);