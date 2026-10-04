import { apiFetch } from "@/lib/apiFetch";
import type { CallPreview, CallVariant } from "./phone-call-model";

export async function generatePhoneCallPreview(playbookId: number, variant: CallVariant, contactId: number, regeneration = ""): Promise<CallPreview> {
  const response = await apiFetch(`/api/playbooks/${playbookId}/phone-call/preview`, {
    method: "POST", body: JSON.stringify({ variant, contactId, regeneration }),
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}