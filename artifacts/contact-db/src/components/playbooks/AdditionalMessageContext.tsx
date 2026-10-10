import * as React from "react";

export function AdditionalMessageContext({ value, onChange, disabled, template = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; template?: boolean;
}) {
  return <section className="space-y-2">
    <label className="block text-xs font-semibold text-foreground">
      Additional context
      <textarea data-testid="input-message-context" aria-label="Additional message context" maxLength={6000}
        className="mt-1.5 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
        value={value} disabled={disabled || template} onChange={event => onChange(event.target.value)}
        placeholder="I just met these contacts at the ABC Tradeshow and they all came to our booth." />
    </label>
    <p className="text-xs leading-5 text-muted-foreground">{template
      ? "Templates are used as written. Choose Assisted or Prompt to weave this context into a generated message."
      : "Add conversations, events or other facts that apply to every contact receiving this variant. We'll weave them into the message while keeping its anatomy, tone and factual safeguards. Changing context requires a new preview."}</p>
  </section>;
}
