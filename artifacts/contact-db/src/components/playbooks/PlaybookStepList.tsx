import { AddStepMenu } from "./AddStepMenu";
import { getStepDefinition, type StepDefinition } from "./step-definitions";

export function PlaybookStepList({ steps, onConfigure, onAddStep, addingDisabled }: {
  steps: { id: string; data: Record<string, unknown> }[];
  onConfigure: (id: string) => void;
  onAddStep: (definition: StepDefinition) => void;
  addingDisabled: boolean;
}) {
  return <div className="h-full overflow-y-auto px-5 py-6">
    <ol className="mx-auto max-w-3xl divide-y divide-border">
      {steps.map((step, index) => <li key={step.id} className="flex items-start gap-4 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-sm font-medium text-muted-foreground">{index + 1}</span>
        <div className="min-w-0">
          {getStepDefinition(String(step.data.blockType))?.enabled
            ? <button id={`playbook-step-${step.id}`} type="button" data-testid={`configure-step-${step.id}`} onClick={() => onConfigure(step.id)} className="rounded-md text-left text-sm font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Step {index + 1}: {String(step.data.label)}</button>
            : <p className="text-sm font-semibold text-foreground">{String(step.data.label || step.data.blockType || "Step").replaceAll("-", " ")}</p>}
          {step.data.blockType === "manual-email" && <p className="mt-1 text-xs text-muted-foreground">Needs configuration · Seller-reviewed email task</p>}
          {!!step.data.description && <p className="mt-1 text-sm text-muted-foreground">{String(step.data.description)}</p>}
        </div>
      </li>)}
    </ol>
    <div className="mx-auto mt-5 max-w-3xl"><AddStepMenu onSelect={onAddStep} disabled={addingDisabled} /></div>
  </div>;
}