import { apiFetch } from "@/lib/apiFetch";
import type { EmailPreview, EmailVariant, ManualEmailContext } from "./manual-email-model";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body as T;
}
export const getManualEmailContext = (playbookId: number) =>
  request<ManualEmailContext>(`/api/playbooks/${playbookId}/manual-email/context`);
export const generateManualEmailPreview = (playbookId: number, variant: EmailVariant, contactId: number, regeneration = "", seatId?: string) =>
  request<EmailPreview>(`/api/playbooks/${playbookId}/manual-email/preview`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant, contactId, regeneration, seatId }),
  });
export const sendManualEmailTest = (playbookId: number, preview: EmailPreview, accountId: number) =>
  request<{ success: boolean }>(`/api/playbooks/${playbookId}/manual-email/test`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: preview.subject, body: preview.body, accountId }),
  });