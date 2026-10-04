import { apiFetch } from "@/lib/apiFetch";
import type { ConnectionPreview, ConnectionVariant } from "./linkedin-connection-model";

export async function generateLinkedInConnectionPreview(playbookId: number, variant: ConnectionVariant, contactId: number, regeneration = ""): Promise<ConnectionPreview> {
  const response = await apiFetch(`/api/playbooks/${playbookId}/linkedin-connection/preview`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant, contactId, regeneration }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}