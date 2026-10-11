import type { Node, Edge } from "@xyflow/react";

/** HQ highlights a seat when at least one seniority or department criterion is set. */
export function configuredBuyingCenterSeats(values: unknown[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const selected = values.flatMap(value => {
    if (typeof value === "string") return [value];
    if (!value || typeof value !== "object") return [];
    const seat = value as { seat?: unknown; name?: unknown; seniorities?: unknown; departments?: unknown };
    const highlighted = (Array.isArray(seat.seniorities) && seat.seniorities.length > 0)
      || (Array.isArray(seat.departments) && seat.departments.length > 0);
    return highlighted && typeof (seat.seat ?? seat.name) === "string" ? [String(seat.seat ?? seat.name)] : [];
  });
  return [...new Set(selected)].filter(name => BUYING_CENTER_SEATS.includes(name as typeof BUYING_CENTER_SEATS[number]));
}
export const BUYING_CENTER_SEATS = ["Business Champion", "Economic Buyer", "Decision Maker", "Executive Sponsor", "Business Owner", "Technical Buyer", "Security or Compliance Reviewer", "Procurement", "Legal", "Finance", "End User", "Implementer", "Influencer", "Blocker", "Coach"] as const;
export type ContactModeChoice = { mode: "single" | "multi"; seats: string[]; buyingCenterId?: string };
export const SINGLE_CONTACT: ContactModeChoice = { mode: "single", seats: [] };
export type SeatWorkflow = { nodes: Node[]; edges: Edge[]; prospects: unknown[] };
export type MultiContactDocument = SeatWorkflow & {
  contactMode: "multi"; buyingCenterId?: string; companyId: number | null;
  seatSequences: { id: string; name: string; contactId: number | null; workflow: SeatWorkflow }[];
};

export function appendBuyingCenterSeat(document: MultiContactDocument, name: string): MultiContactDocument {
  if (!BUYING_CENTER_SEATS.includes(name as typeof BUYING_CENTER_SEATS[number])) throw new Error("Choose a valid Buying Center seat.");
  if (document.seatSequences.some(seat => seat.name === name)) throw new Error("This Buying Center seat is already included.");
  let index = document.seatSequences.length;
  while (document.seatSequences.some(seat => seat.id === `seat-${index}`)) index++;
  return { ...document, seatSequences: [...document.seatSequences, {
    id: `seat-${index}`, name, contactId: null, workflow: { nodes: [], edges: [], prospects: [] },
  }] };
}

export function singleToMultiContact(workflow: SeatWorkflow, name: string, lead?: { id: number; companyId: number }): MultiContactDocument {
  const original = structuredClone(workflow);
  return appendBuyingCenterSeat({ ...original, contactMode: "multi", companyId: lead?.companyId ?? null,
    seatSequences: [{ id: "seat-0", name: "Business Champion", contactId: lead?.id ?? null, workflow: original }],
  }, name);
}

export function createContactModeDocument(workflow: SeatWorkflow, choice: ContactModeChoice): SeatWorkflow | MultiContactDocument {
  if (choice.mode === "single") return workflow;
  const seats = [...new Set(["Business Champion", ...choice.seats])];
  if (seats.length < 2) throw new Error("Choose at least one additional Buying Center seat.");
  const sequences = seats.map((name, index) => {
    const copy = JSON.parse(JSON.stringify(workflow)) as SeatWorkflow;
    const prefix = `bc-${index}-`;
    const ids = new Map(copy.nodes.map(node => [node.id, prefix + node.id]));
    copy.nodes = copy.nodes.map(node => ({ ...node, id: ids.get(node.id)!, data: { ...node.data, ...(typeof node.data.primaryNodeId === "string" ? { primaryNodeId: ids.get(node.data.primaryNodeId) } : {}) } }));
    copy.edges = copy.edges.map(edge => ({ ...edge, id: prefix + edge.id, source: ids.get(edge.source) ?? edge.source, target: ids.get(edge.target) ?? edge.target }));
    return { id: `seat-${index}`, name, contactId: null, workflow: copy };
  });
  return { ...sequences[0].workflow, contactMode: "multi", buyingCenterId: choice.buyingCenterId, companyId: null, seatSequences: sequences };
}

export function readMultiContactDocument(raw?: string | null): MultiContactDocument | null {
  if (!raw?.trim().startsWith("{")) return null;
  const value = JSON.parse(raw);
  if (value.contactMode !== "multi") return null;
  if (!Array.isArray(value.seatSequences) || value.seatSequences.length < 2 || value.seatSequences[0].name !== "Business Champion") throw new Error("Multi-Contact Playbook has an invalid Buying Center.");
  const ids = new Set<string>();
  for (const seat of value.seatSequences) {
    if (!seat.id || ids.has(seat.id) || !seat.name || !Array.isArray(seat.workflow?.nodes) || !Array.isArray(seat.workflow?.edges) || !Array.isArray(seat.workflow?.prospects)) throw new Error("A Buying Center sequence could not be read.");
    ids.add(seat.id);
  }
  return value;
}

export function updateSeatWorkflow(document: MultiContactDocument, seatId: string, workflow: SeatWorkflow): MultiContactDocument {
  if (!document.seatSequences.some(seat => seat.id === seatId)) throw new Error("Buying Center seat not found.");
  const seatSequences = document.seatSequences.map(seat => seat.id === seatId ? { ...seat, workflow } : seat);
  return { ...document, ...seatSequences[0].workflow, seatSequences };
}
export function clearRecipientPreviews(node: Node): Node {
  const configuration = node.data.configuration;
  if (!configuration || typeof configuration !== "object" || !("variants" in configuration) || !Array.isArray(configuration.variants)) return node;
  return { ...node, data: { ...node.data, configuration: { ...configuration, variants: configuration.variants.map(variant => variant && typeof variant === "object" ? { ...variant, preview: undefined } : variant) } } };
}
