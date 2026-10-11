import { createContext, useContext, useEffect } from "react";
export const PlaybookSeatRecipient = createContext<number | null | undefined>(undefined);
export const PlaybookSeatBusy = createContext<(delta: number) => void>(() => {});
export function useSeatWorkInFlight(pending: boolean) {
  const report = useContext(PlaybookSeatBusy);
  useEffect(() => {
    if (!pending) return;
    report(1);
    return () => report(-1);
  }, [pending, report]);
}
export function useSeatScopedContext<T extends { contacts: { id: number }[] }>(context: T | undefined): T | undefined {
  const recipient = useContext(PlaybookSeatRecipient);
  if (recipient === undefined || !context) return context;
  return { ...context, contacts: context.contacts.filter(contact => contact.id === recipient) };
}
