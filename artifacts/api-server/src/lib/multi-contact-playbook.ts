export type StoredSeat = { id: string; name: string; contactId: number | null; workflow: { nodes: { id: string; data: Record<string, unknown> }[]; edges: unknown[]; prospects: unknown[] } };
export type MultiCanvas = { contactMode: "multi"; companyId: number | null; seatSequences: StoredSeat[] };
export function multiContactCanvas(raw?: string | null): MultiCanvas | null {
  if (!raw?.trim().startsWith("{")) return null;
  const value = JSON.parse(raw);
  if (value.contactMode !== "multi") return null;
  const fail = () => { throw new Error("Multi-Contact Playbook requires valid independent Buying Center sequences, led by Business Champion."); };
  if (!Array.isArray(value.seatSequences) || value.seatSequences.length < 2 || value.seatSequences.length > 30 || value.seatSequences[0]?.name !== "Business Champion") fail();
  if (value.companyId !== null && (!Number.isInteger(value.companyId) || value.companyId <= 0)) fail();
  const ids = new Set<string>(), names = new Set<string>(), contacts = new Set<number>(), nodes = new Set<string>();
  for (const seat of value.seatSequences) {
    if (typeof seat.id !== "string" || !seat.id || ids.has(seat.id) || typeof seat.name !== "string" || !seat.name.trim() || names.has(seat.name) || !Array.isArray(seat.workflow?.nodes) || !Array.isArray(seat.workflow?.edges) || !Array.isArray(seat.workflow?.prospects)) fail();
    ids.add(seat.id); names.add(seat.name);
    if (seat.contactId !== null) {
      if (!Number.isInteger(seat.contactId) || seat.contactId <= 0 || contacts.has(seat.contactId) || !value.companyId) fail();
      contacts.add(seat.contactId);
    }
    for (const node of seat.workflow.nodes) {
      if (typeof node.id !== "string" || nodes.has(node.id) || !node.data || typeof node.data !== "object") fail();
      nodes.add(node.id);
    }
  }
  return value;
}
export function storedPlaybookNodes(raw: string): { id: string; data: Record<string, unknown> }[] {
  const multi = multiContactCanvas(raw);
  if (multi) return multi.seatSequences.flatMap(seat => seat.workflow.nodes);
  const value = JSON.parse(raw);
  return Array.isArray(value.nodes) ? value.nodes : [];
}
export function multiContactActivationError(canvas: MultiCanvas): string | undefined {
  if (!canvas.companyId || canvas.seatSequences.some(seat => !seat.contactId)) return "Assign one company contact to every Buying Center seat before activating.";
  const structural = new Set(["placeholder", "prospect-added", "trigger-detected", "added-to-playbook", "company-added", "list-entry", "manual-enrollment"]);
  for (const seat of canvas.seatSequences) {
    if (!seat.workflow.nodes.some(node => !structural.has(String(node.data.blockType)) && (node.data.configuration as { enabled?: boolean } | undefined)?.enabled !== false)) return `Add an enabled workflow step for ${seat.name} before activating.`;
  }
  return undefined;
}
export function multiRecipientContext(raw: string | null, contactId: number, companyId: number | null): { seat?: string; error?: string } {
  const multi = multiContactCanvas(raw);
  if (!multi) return {};
  const seat = multi.seatSequences.find(item => item.contactId === contactId);
  if (!seat || companyId !== multi.companyId) return { error: "Multi-Contact previews must use the company contact assigned to a Buying Center seat." };
  return { seat: seat.name };
}
export const BUYING_CENTER_MESSAGING_GUIDANCE = "When buyingCenterSeat is supplied, address that recipient's explicitly assigned Buying Center perspective and priorities. This is a separate sequence for that seat, not a shared message to the company. Do not invent authority, interests, meetings or facts from a seat label. Preserve the applicable message anatomy, evidence, sender voice and supplied additional context.";
