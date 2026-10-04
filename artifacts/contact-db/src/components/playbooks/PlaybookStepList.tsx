export function PlaybookStepList({ steps }: {
  steps: { id: string; data: Record<string, unknown> }[];
}) {
  return <div className="h-full overflow-y-auto px-5 py-6">
    <ol className="mx-auto max-w-3xl divide-y divide-border">
      {steps.map((step, index) => <li key={step.id} className="flex items-start gap-4 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-sm font-medium text-muted-foreground">{index + 1}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{String(step.data.label || step.data.blockType || "Step").replaceAll("-", " ")}</p>
          {!!step.data.description && <p className="mt-1 text-sm text-muted-foreground">{String(step.data.description)}</p>}
        </div>
      </li>)}
    </ol>
  </div>;
}