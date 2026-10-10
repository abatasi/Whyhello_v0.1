import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Confirmation = { title: string; description: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type Request = Confirmation & { resolve: (accepted: boolean) => void };
const Context = React.createContext<((options: Confirmation) => Promise<boolean>) | null>(null);

export function usePlaybookConfirm() {
  const confirm = React.useContext(Context);
  if (!confirm) throw new Error("Playbook confirmations require PlaybookConfirmProvider.");
  return confirm;
}

export function PlaybookConfirmProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = React.useState<Request | null>(null);
  const active = React.useRef<Request | null>(null);
  const waiting = React.useRef<Request[]>([]);
  const finish = React.useCallback((accepted: boolean) => {
    active.current?.resolve(accepted);
    active.current = waiting.current.shift() ?? null;
    setCurrent(active.current);
  }, []);
  const confirm = React.useCallback((options: Confirmation) => new Promise<boolean>(resolve => {
    const request = { ...options, resolve };
    if (active.current) waiting.current.push(request);
    else { active.current = request; setCurrent(request); }
  }), []);
  React.useEffect(() => () => {
    active.current?.resolve(false);
    waiting.current.forEach(request => request.resolve(false));
    active.current = null;
    waiting.current = [];
  }, []);
  return <Context.Provider value={confirm}>
    {children}
    <Dialog open={!!current} onOpenChange={open => { if (!open) finish(false); }}>
      <DialogContent role="alertdialog" data-testid="playbook-confirm-dialog"
        className="z-[250] max-w-md border-border bg-background text-foreground"
        overlayClassName="z-[240] bg-black/50 backdrop-blur-sm">
        <DialogTitle>{current?.title}</DialogTitle>
        <DialogDescription className="leading-6">{current?.description}</DialogDescription>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent" onClick={() => finish(false)}>{current?.cancelLabel ?? "Cancel"}</button>
          <button type="button" data-testid="button-confirm-playbook-action" className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${current?.destructive ? "bg-destructive" : "bg-primary"}`} onClick={() => finish(true)}>{current?.confirmLabel ?? "Continue"}</button>
        </div>
      </DialogContent>
    </Dialog>
  </Context.Provider>;
}
