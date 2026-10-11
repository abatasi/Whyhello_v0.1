import { clearRecipientPreviews, updateSeatWorkflow, type MultiContactDocument, type PlaybookSampleView } from "./contact-mode-model";
export type SampleCandidate = { id: number; companyId: number | null; matchingSeats: string[] };
export function sampleViewFor(document: MultiContactDocument): PlaybookSampleView {
  return document.sampleView ?? {
    companyId: document.companyId,
    contactIds: Object.fromEntries(document.seatSequences.map(seat => [seat.id, seat.contactId])),
    manualSeatIds: document.seatSequences.filter(seat => seat.contactId !== null).map(seat => seat.id),
  };
}
/** Samples never update actual company/contact assignments or enrollments. */
export function chooseSampleCompany(document: MultiContactDocument, companyId: number | null, contacts: SampleCandidate[]): MultiContactDocument {
  const next = structuredClone(document);
  next.sampleView = {
    companyId,
    contactIds: Object.fromEntries(next.seatSequences.map(seat => [
      seat.id, contacts.find(contact => contact.companyId === companyId && contact.matchingSeats.includes(seat.name))?.id ?? null,
    ])),
    manualSeatIds: [],
  };
  for (const seat of next.seatSequences) seat.workflow.nodes = seat.workflow.nodes.map(clearRecipientPreviews);
  return updateSeatWorkflow(next, next.seatSequences[0].id, next.seatSequences[0].workflow);
}
export function chooseSampleContact(document: MultiContactDocument, seatId: string, contactId: number | null): MultiContactDocument {
  const next = structuredClone(document);
  const seat = next.seatSequences.find(seat => seat.id === seatId);
  if (!seat) throw new Error("Choose a valid Buying Center seat.");
  next.sampleView = structuredClone(sampleViewFor(document));
  next.sampleView.contactIds[seatId] = contactId;
  next.sampleView.manualSeatIds = [...new Set([...next.sampleView.manualSeatIds, seatId])];
  seat.workflow.nodes = seat.workflow.nodes.map(clearRecipientPreviews);
  return updateSeatWorkflow(next, seat.id, seat.workflow);
}
export function populateAddedSamples(document: MultiContactDocument, contacts: SampleCandidate[]): MultiContactDocument {
  if (!document.sampleView) return document;
  const next = structuredClone(document), sample = next.sampleView!;
  for (const seat of next.seatSequences) {
    if (!(seat.id in sample.contactIds)) sample.contactIds[seat.id] = contacts.find(contact =>
      contact.companyId === sample.companyId && contact.matchingSeats.includes(seat.name))?.id ?? null;
  }
  return next;
}
