import { createManualEmailConfiguration, type HqVoiceOptions, type InsightCategory } from "./manual-email-model";
import { createPhoneCallConfiguration } from "./phone-call-model";
import { createLinkedInConnectionConfiguration } from "./linkedin-connection-model";

type WorkflowNode = { data: Record<string, unknown> };

/** Upgrade retired touchpoints without changing identities, edges, delays or branches.
 * Keep the original fields too, so saved seller content is never discarded.
 */
export function editableTemplateNodes<T extends WorkflowNode>(nodes: T[], voice?: HqVoiceOptions): T[] {
  return nodes.map(node => {
    const data = node.data;
    const text = (key: string) => typeof data[key] === "string" ? data[key] as string : "";
    const type = data.blockType === "send-email" ? "manual-email"
      : data.blockType === "make-call" ? "phone-call"
      : data.blockType === "send-linkedin" && data.linkedinAction === "Send Connection Request" ? "linkedin-connection-request"
      : null;
    if (!type) return node;
    const configuration = data.configuration as { version?: number; variants?: unknown[] } | undefined;
    if (configuration?.version === 1 && configuration.variants?.length) {
      return { ...node, data: { ...data, blockType: type } };
    }
    const config = type === "manual-email" ? createManualEmailConfiguration(voice)
      : type === "phone-call" ? createPhoneCallConfiguration(voice)
      : createLinkedInConnectionConfiguration(voice);
    const variant = config.variants[0];
    const category = text("insightCategory").toLowerCase();
    if (["personal", "company", "industry", "role", "colleagues", "counterparts"].includes(category)) {
      variant.insightCategory = category as InsightCategory;
    }
    variant.guidelines = [
      ...(text("messagingObjective") ? [{ id: crypto.randomUUID(), text: `Messaging objective: ${text("messagingObjective")}` }] : []),
      ...(text("callToAction") ? [{ id: crypto.randomUUID(), text: `Call to action: ${text("callToAction")}` }] : []),
    ];
    if ("templateSubject" in variant) {
      variant.emailType = /breakup|last pitch/i.test(text("emailType")) ? "Last pitch"
        : /follow.up/i.test(text("emailType")) ? "Follow-up" : "Outreach";
      variant.templateSubject = text("subject");
      variant.templateBody = text("emailBody");
      if (variant.templateSubject || variant.templateBody) variant.mode = "template";
    } else if ("template" in variant) {
      variant.template.opener = text("opener");
      variant.template.questions = text("discoveryQuestion") ? [text("discoveryQuestion")] : [];
      variant.template.voicemail = text("voicemail");
      if (text("callObjective")) variant.guidelines.push({ id: crypto.randomUUID(), text: `Call objective: ${text("callObjective")}` });
      if (variant.template.opener || variant.template.questions.length || variant.template.voicemail) variant.mode = "template";
    } else {
      variant.templateBody = text("linkedinBody");
      if (variant.templateBody) variant.mode = "template";
    }
    const defaultLabel = data.blockType === "send-email" ? "Send Email"
      : data.blockType === "make-call" ? "Make Call" : "Send LinkedIn Message";
    return { ...node, data: {
      ...data, blockType: type,
      label: text("label") && text("label") !== defaultLabel ? text("label")
        : type === "manual-email" ? "Manual Email" : type === "phone-call" ? "Phone Call" : "Send Connection Request",
      stepType: "action", category: type === "linkedin-connection-request" ? "linkedin" : "communication",
      executionMode: "manual", configuration: config,
    } };
  });
}
