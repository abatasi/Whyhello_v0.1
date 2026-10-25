import { useRef } from "react";
import { Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STEP_CATEGORIES, STEP_DEFINITIONS, type StepDefinition } from "./step-definitions";

export function AddStepMenu({ onSelect, disabled = false, testId = "button-add-step" }: {
  onSelect: (definition: StepDefinition) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const selected = useRef(false);
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" data-testid={testId} disabled={disabled} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground dark:bg-indigo-700 dark:border-indigo-700 dark:text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
        <Plus size={16} />Add a step
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      data-testid="add-step-menu"
      align="start"
      sideOffset={6}
      className="w-64"
      onCloseAutoFocus={event => {
        // A selection opens the setup panel, which takes focus instead.
        if (selected.current) { event.preventDefault(); selected.current = false; }
      }}
    >
      {STEP_CATEGORIES.map((category, index) => <DropdownMenuGroup key={category.id}>
        {index > 0 && <DropdownMenuSeparator />}
        <DropdownMenuLabel className="text-xs text-muted-foreground">{category.name}</DropdownMenuLabel>
        {STEP_DEFINITIONS.filter(step => step.type === "action" && step.category === category.id).map(step => {
          const Icon = step.icon;
          return <DropdownMenuItem
            key={step.id}
            data-testid={`add-step-${step.id}`}
            disabled={!step.enabled}
            onSelect={() => {
              if (!step.enabled) return;
              selected.current = true;
              onSelect(step);
            }}
          >
            <Icon size={16} /><span>{step.name}</span>
          </DropdownMenuItem>;
        })}
      </DropdownMenuGroup>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}