import { useEffect, useRef } from "react";
import { Mail } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function ManualEmailSetup({ stepId, stepNumber, onClose }: {
  stepId: string | null;
  stepNumber: number;
  onClose: () => void;
}) {
  const lastStepId = useRef(stepId);
  useEffect(() => { if (stepId) lastStepId.current = stepId; }, [stepId]);
  return <Sheet open={!!stepId} onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent
      data-testid="manual-email-setup"
      className="z-[230] w-full sm:max-w-md"
      onCloseAutoFocus={event => {
        event.preventDefault();
        const target = lastStepId.current && document.getElementById(`playbook-step-${lastStepId.current}`);
        if (target) target.focus();
        else document.querySelector<HTMLButtonElement>('[data-testid="button-empty-add-step"]')?.focus();
      }}
    >
      <SheetHeader className="pr-6">
        <p className="text-xs text-muted-foreground">Step {stepNumber}</p>
        <SheetTitle className="flex items-center gap-2"><Mail size={18} />Manual Email</SheetTitle>
        <SheetDescription>A seller-reviewed email task. This step does not send automatically.</SheetDescription>
      </SheetHeader>
      <div className="mt-8 border-t border-border pt-6">
        <h3 className="text-sm font-semibold">Email setup</h3>
        <p className="mt-2 text-sm text-muted-foreground">The email configuration form is not available yet. This step remains an unconfigured draft.</p>
      </div>
    </SheetContent>
  </Sheet>;
}