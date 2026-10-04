import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function PlaybookDialog({ title, description, children, onClose, busy = false }: {
  title: string; description: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="pb-dialog-overlay" />
      <Dialog.Content className="pb-dialog">
        <div className="pb-dialog-header">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close className="pb-icon-button" disabled={busy} aria-label="Close dialog"><X size={18} /></Dialog.Close>
        </div>
        <Dialog.Description className="pb-dialog-description">{description}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}