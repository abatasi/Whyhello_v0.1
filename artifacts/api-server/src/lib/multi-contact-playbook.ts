export type StoredSeat = { id: string; name: string; contactId: number | null; workflow: { nodes: { id: string; data: Record<string, unknown> }[]; edges: unknown[]; prospects: unknown[] } };
export type MultiCanvas = { contactMode: "multi"; companyId: number | null; seatSequences: StoredSeat[]; buyingCenterId?: string;
  sampleView?: { companyId: number | null; contactIds: Record<string, number | null>; manualSeatIds: string[] } };
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
  if (value.sampleView !== undefined) {
    const sample = value.sampleView;
    if (!sample || (sample.companyId !== null && (!Number.isInteger(sample.companyId) || sample.companyId <= 0))
      || !sample.contactIds || typeof sample.contactIds !== "object" || Array.isArray(sample.contactIds)
      || !Array.isArray(sample.manualSeatIds) || sample.manualSeatIds.some((id: unknown) => typeof id !== "string" || !ids.has(id))) fail();
    for (const [id, contactId] of Object.entries(sample.contactIds)) {
      if (!ids.has(id) || (contactId !== null && (!Number.isInteger(contactId) || Number(contactId) <= 0 || !sample.companyId))) fail();
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
  const structural = new Set(["placeholder", "prospect-added", "trigger-detected", "added-to-playbook", "company-added", "list-entry", "manual-enrollment"]);
  for (const seat of canvas.seatSequences) {
    if (!seat.workflow.nodes.some(node => !structural.has(String(node.data.blockType)) && (node.data.configuration as { enabled?: boolean } | undefined)?.enabled !== false)) return `Add an enabled workflow step for ${seat.name} before activating.`;
  }
  return undefined;
}
export function multiRecipientContext(raw: string | null, contactId: number, companyId: number | null, seatId?: string): { seat?: string; error?: string } {
  const multi = multiContactCanvas(raw);
  if (!multi) return {};
  const matches = multi.seatSequences.filter(item => (multi.sampleView ? multi.sampleView.contactIds[item.id] : item.contactId) === contactId);
  const seat = seatId ? matches.find(item => item.id === seatId) : matches.length === 1 ? matches[0] : undefined;
  if (!seat || companyId !== (multi.sampleView ? multi.sampleView.companyId : multi.companyId)) return { error: "Choose this seat's sample contact from the selected sample company." };
  return { seat: seat.name };
}
export const BUYING_CENTER_MESSAGING_GUIDANCE = "When buyingCenterSeat is supplied, write for that seat's independent sequence perspective and priorities, not a shared message to the company. The selected person can be a preview-only fallback sample: neither the seat label nor selecting that sample proves the person actually holds that Buying Center seat. Do not invent authority, job responsibilities, interests, meetings or facts from a seat label. Use the sample contact's real company, known facts and evidence. Preserve the applicable message anatomy, sender voice and supplied additional context.";
