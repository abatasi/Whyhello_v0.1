import { apiFetch } from "@/lib/apiFetch";
import { duplicateDescription, type PlaybookRecord } from "./list-model";

export async function playbookRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result as T;
}

export async function createPlaybookRecord(name: string, description?: string): Promise<PlaybookRecord> {
  return playbookRequest("/api/playbooks", "POST", { name: name.trim(), description, status: "draft" });
}

interface Step { position: number; delayDays: number; subject: string; body: string }
export async function duplicatePlaybookRecord(original: PlaybookRecord): Promise<PlaybookRecord> {
  const description = duplicateDescription(original);
  const steps = await playbookRequest<Step[]>(`/api/playbooks/${original.id}/steps`);
  if (!Array.isArray(steps)) throw new Error("The source playbook's steps could not be read.");
  const copy = await createPlaybookRecord(`${original.name.slice(0, 249)} copy`, description ?? undefined);
  try {
    for (const step of steps) {
      await playbookRequest(`/api/playbooks/${copy.id}/steps`, "POST", {
        position: step.position, delayDays: step.delayDays, subject: step.subject, body: step.body,
      });
    }
    return copy;
  } catch (error) {
    try { await playbookRequest(`/api/playbooks/${copy.id}`, "DELETE"); }
    catch { throw new Error(`The copy "${copy.name}" (ID ${copy.id}) is incomplete and could not be removed. Review it before using it.`); }
    throw error;
  }
}