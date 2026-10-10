import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { AddStepMenu } from "./AddStepMenu";
import { getStepDefinition, type StepDefinition } from "./step-definitions";
import { ManualEmailStep } from "./manual-email/ManualEmailStep";
import { readManualEmailConfiguration, timingSummary, validateManualEmailConfiguration } from "./manual-email-model";
import type { ManualEmailConfiguration } from "./manual-email-model";
import { PhoneCallStep } from "./phone-call/PhoneCallStep";
import type { PhoneCallConfiguration } from "./phone-call-model";
import { LinkedInConnectionStep } from "./linkedin-connection/LinkedInConnectionStep";
import type { LinkedInConnectionConfiguration } from "./linkedin-connection-model";

export type ConfiguredStep = { id: string; data: Record<string, unknown> };
export type ConfiguredPlaybookStepsProps = {
  playbookId: number;
  steps: ConfiguredStep[];
  selectedStepId: string | null;
  onSelect: (id: string | null) => void;
  onConfigure: (id: string, config: ManualEmailConfiguration | PhoneCallConfiguration | LinkedInConnectionConfiguration) => void;
  onInsert: (afterId: string | null, definition: StepDefinition) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onSave: () => void;
  dirty: boolean;
  saving: boolean;
  saveStatus?: string;
  saveError?: boolean;
  readOnly?: boolean;
};

function StepSummary({ id, number, step, selected, onSelect, onDuplicate, onDelete, onMove, onInsert, canMoveUp, canMoveDown, readOnly }: {
  id: string; number: number; step: ConfiguredStep; selected: boolean; onSelect: () => void;
  onDuplicate: () => void; onDelete: () => void; onMove: (direction: -1 | 1) => void;
  onInsert: () => void; canMoveUp: boolean; canMoveDown: boolean; readOnly: boolean;
}) {
  const definition = getStepDefinition(String(step.data.blockType));
  const title = definition?.name ?? String(step.data.label || step.data.blockType || "Saved action").replaceAll("-", " ");
  const Icon = definition?.icon;
  const isManual = step.data.blockType === "manual-email";
  const config = isManual ? readManualEmailConfiguration(step.data.configuration) : null;
  const error = config ? validateManualEmailConfiguration(config) : null;
  const status = config?.enabled === false ? "Disabled" : error ? "Needs setup" : "Read-only";
  return <article className={`rounded-xl border bg-card ${selected ? "border-primary/40" : "border-border"}`}>
    <header className="flex flex-wrap items-center gap-3 p-4">
      <button type="button" draggable={!readOnly} aria-label={`Drag to reorder step ${number}`} data-testid={`handle-reorder-step-${id}-${number}`} className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg bg-muted text-muted-foreground active:cursor-grabbing" onClick={e => e.stopPropagation()} onDragStart={e => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; }}><GripVertical size={15} /></button>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{Icon ? <Icon size={16} /> : null}</span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left" data-testid={`button-expand-legacy-${id}`}>
        <span className="text-xs font-semibold text-muted-foreground">Step {number}</span>
        <span className="ml-2 text-sm font-semibold">{title}</span>
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{status}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{config ? `Manual Email · ${config.variants[0]?.emailType ?? "Outreach"} · executes ${timingSummary(config.createTiming)}` : "This step is preserved as a legacy, read-only action."}</span>
      </button>
      <button type="button" aria-label={`Move step ${number} up`} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40" disabled={readOnly || !canMoveUp} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
      <button type="button" aria-label={`Move step ${number} down`} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40" disabled={readOnly || !canMoveDown} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
      <button type="button" className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted" disabled={readOnly} onClick={onDuplicate}>Duplicate</button>
      <button type="button" className="rounded px-2 py-1 text-xs text-destructive hover:bg-muted" disabled={readOnly} onClick={onDelete}>Delete</button>
      <button type="button" aria-label={selected ? "Collapse step" : "Expand step"} className="rounded p-1.5 text-muted-foreground hover:bg-muted" onClick={onSelect}>{selected ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
    </header>
    {selected && <div className="border-t border-border/70 p-4 text-xs text-muted-foreground">
      <p>{title} is preserved as a legacy action. This editor configures Manual Email, Phone Call and LinkedIn connection-request steps.</p>
      <button type="button" className="mt-3 rounded-md border border-border px-2.5 py-1.5 hover:bg-muted" onClick={onInsert}>Insert a Manual Email before this step</button>
    </div>}
  </article>;
}

export function ConfiguredPlaybookSteps(props: ConfiguredPlaybookStepsProps) {
  const {
    playbookId, steps, selectedStepId, onSelect, onConfigure, onInsert, onDuplicate,
    onDelete, onReorder, onSave, dirty, saving, saveStatus, saveError = false, readOnly = false,
  } = props;
  const [collapseAll, setCollapseAll] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const stepIds = useMemo(() => steps.map(step => step.id), [steps]);
  useEffect(() => {
    if (selectedStepId) {
      setCollapseAll(false);
      requestAnimationFrame(() => document.getElementById(`configured-step-${selectedStepId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }, [selectedStepId]);
  const selected = (id: string) => selectedStepId === id && !collapseAll;
  const choose = (id: string) => onSelect(selectedStepId === id && !collapseAll ? null : id);
  const insertBefore = (index: number, type = "manual-email") => {
    const predecessor = index > 0 ? steps[index - 1].id : null;
    const definition = getStepDefinition(type);
    if (definition) onInsert(predecessor, definition);
  };
  const insertAfter = (id: string, type = "manual-email") => {
    const definition = getStepDefinition(type);
    if (definition) onInsert(id, definition);
  };
  const reorderBy = (id: string, direction: -1 | 1) => {
    const index = stepIds.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= stepIds.length) return;
    const ids = [...stepIds];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorder(ids);
  };
  const onDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = [...stepIds];
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    onReorder(ids);
    setDraggedId(null);
  };
  return <section data-testid="configured-playbook-steps" className="mx-auto w-full max-w-[1440px] px-3 pb-12 sm:px-6 lg:px-8">
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="mr-auto"><p className="text-sm font-semibold">{steps.length} {steps.length === 1 ? "step" : "steps"}</p><p role="status" className={`text-xs ${saveError ? "text-destructive" : "text-muted-foreground"}`}>{saveStatus ?? (dirty || saving ? "Saving changes…" : "All changes saved")}</p></div>
      <button type="button" data-testid="button-collapse-steps" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted" onClick={() => {
        const next = !collapseAll;
        setCollapseAll(next);
        if (next) onSelect(null);
        else if (steps[0]) onSelect(steps[0].id);
      }}>{collapseAll ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{collapseAll ? "Expand steps" : "Collapse steps"}</button>
      {saveError && <button type="button" data-testid="button-save-playbook-changes" className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || readOnly} onClick={onSave}>Retry auto-save</button>}
    </div>
    {steps.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <h2 className="text-base font-semibold">Start with the first step</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Build a clear path from first outreach to the next conversation.</p>
      <div className="mt-5 flex justify-center"><AddStepMenu onSelect={definition => onInsert(null, definition)} disabled={readOnly} testId="button-add-first-step" /></div>
    </div> : <div className="mx-auto max-w-[1360px]">
      <div className="flex flex-col items-center pb-2 pt-1"><span className="rounded-full border border-border bg-muted/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start</span><span className="h-6 w-px bg-border" /></div>
      {steps.map((step, index) => {
        const manual = step.data.blockType === "manual-email";
        const phone = step.data.blockType === "phone-call";
        const connection = step.data.blockType === "linkedin-connection-request";
        const Editor = connection ? LinkedInConnectionStep : phone ? PhoneCallStep : ManualEmailStep;
        return <div key={`${step.id}-${index}`} className="relative" onDragOver={e => { if (draggedId) e.preventDefault(); }} onDrop={e => { e.preventDefault(); onDrop(step.id); }}>
          <div className="mb-3 flex justify-center">
            {index > 0 && <span className="-mt-2 mb-1 h-5 w-px bg-border" />}
          </div>
          <div className={`${draggedId === step.id ? "opacity-60" : ""}`} onDragStart={() => setDraggedId(step.id)} onDragEnd={() => setDraggedId(null)}>
            {manual || phone || connection ? <Editor
              playbookId={playbookId}
              stepId={step.id}
              stepNumber={index + 1}
              config={step.data.configuration}
              selected={selected(step.id)}
              onSelect={() => choose(step.id)}
              onConfigure={(config: ManualEmailConfiguration | PhoneCallConfiguration | LinkedInConnectionConfiguration) => onConfigure(step.id, config)}
              readOnly={readOnly}
              onDuplicate={() => onDuplicate(step.id)}
              onDelete={() => onDelete(step.id)}
              onInsertBefore={() => insertBefore(index, String(step.data.blockType))}
              onInsertAfter={() => insertAfter(step.id, String(step.data.blockType))}
              onMoveUp={() => reorderBy(step.id, -1)}
              onMoveDown={() => reorderBy(step.id, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < steps.length - 1}
            /> : <StepSummary id={step.id} number={index + 1} step={step} selected={selected(step.id)} onSelect={() => choose(step.id)} onDuplicate={() => onDuplicate(step.id)} onDelete={() => onDelete(step.id)} onMove={direction => reorderBy(step.id, direction)} onInsert={() => insertBefore(index)} canMoveUp={index > 0} canMoveDown={index < steps.length - 1} readOnly={readOnly} />}
          </div>
          <div className="flex flex-col items-center py-2"><span className="h-4 w-px bg-border" /><AddStepMenu onSelect={definition => onInsert(step.id, definition)} disabled={readOnly} testId={`button-add-step-after-${step.id}-${index}`} /><span className="h-4 w-px bg-border" /></div>
        </div>;
      })}
      <div className="flex justify-center"><span className="h-4 w-px bg-border" /></div>
      <div className="flex justify-center"><span className="rounded-full border border-border bg-muted/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next</span></div>
    </div>}
    {steps.some(step => {
      const definition = getStepDefinition(String(step.data.blockType));
      return definition?.enabled && (step.data.configuration as { enabled?: boolean } | undefined)?.enabled !== false && definition.validation((step.data.configuration ?? {}) as Record<string, unknown>);
    }) && <p className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"><AlertCircle size={14} />Resolve enabled step validation issues before activating this Playbook.</p>}
  </section>;
}

export default ConfiguredPlaybookSteps;