import { useEffect, useRef, useState } from "react";
import type { HqProductDraft, HqProductsWebsiteResult } from "@workspace/api-client-react";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function ProductsAiFill({ hasProducts, disabled, onApply, onBusyChange }: {
  hasProducts: boolean;
  disabled: boolean;
  onApply: (products: HqProductDraft[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [references, setReferences] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  useEffect(() => () => { request.current?.abort(); busyCallback.current(false); }, []);
  const urls = () => [...new Set(references.split(/\r?\n/).map(value => value.trim()).filter(Boolean))];
  function changeOpen(next: boolean) {
    if (!next) {
      request.current?.abort();
      request.current = null;
      setBusy(false);
      busyCallback.current(false);
    }
    setOpen(next); setConfirm(false); setError("");
  }
  async function generate() {
    if (request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); busyCallback.current(true); setError("");
    try {
      const response = await apiFetch("/api/hq/products-from-urls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urls() }), signal: controller.signal,
      });
      const result = await response.json() as HqProductsWebsiteResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Product generation failed. Your Products are unchanged.");
      if (controller.signal.aborted) return;
      if (!Array.isArray(result.products) || !result.products.length ||
          result.products.some(product => !product.name?.trim() ||
            ![product.tagline, product.features, product.outcomes, product.persona].every(value => typeof value === "string") ||
            !Array.isArray(product.economicBenefits)) || !Array.isArray(result.sourceUrls)) {
        throw new Error("AI returned incomplete Products. Your Products are unchanged.");
      }
      onApply(result.products); setSources(result.sourceUrls); setOpen(false); setConfirm(false);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Product generation failed. Your Products are unchanged.");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); busyCallback.current(false); }
    }
  }
  function submit() {
    setError("");
    try {
      const entries = urls();
      if (!entries.length || entries.length > 5) throw new Error();
      for (const value of entries) {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        if (value.length > 2048 || !["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) throw new Error();
      }
    } catch { setError("Enter one to five public website URLs, one per line."); return; }
    if (hasProducts && !confirm) setConfirm(true);
    else void generate();
  }
  const neutral = "rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary";
  const primary = "rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800";
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button type="button" data-testid="button-products-ai" disabled={disabled || busy} onClick={() => changeOpen(true)}
        className={`${primary} inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}>
        <Sparkles className="size-3.5" aria-hidden="true" />AI
      </button>
      {sources.length > 0 && <div role="status" className="max-w-40 text-right text-[10px] text-muted-foreground sm:max-w-56">
        Products generated. Review for accuracy.
        {sources.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">Source {i + 1}</a>)}
      </div>}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{busy ? "Drafting your Products" : confirm ? "Replace existing Products?" : "Fill Products with AI"}</DialogTitle>
          <DialogDescription>{confirm
            ? "Continuing replaces all existing products and their economic benefits with a new draft from these references."
            : "Add up to five public company or product page URLs, one per line. AI will combine them into distinct product cards with features, buyer outcomes and target personas."}</DialogDescription>
          {busy ? <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
            <ThinkingIndicator label="Reading references and drafting Products" /><p className="text-sm">Reading your references and drafting Products…</p>
          </div> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); submit(); }}>
            {confirm ? <div className="rounded-lg border border-amber-600/60 bg-background p-3 text-sm">
              <p className="font-semibold">All current Products will be overwritten.</p>
              <p className="mt-2 text-xs text-muted-foreground">Other HQ sections will not change. If any reference cannot be read, generation fails or you cancel, your existing Products stay unchanged.</p>
              <ul className="mt-2 space-y-1 text-xs break-all">{urls().map(url => <li key={url}>{url}</li>)}</ul>
            </div> : <div className="space-y-1.5">
              <label htmlFor="hq-products-urls" className="text-xs font-semibold">Reference URLs</label>
              <textarea id="hq-products-urls" data-testid="input-products-ai-urls" autoFocus required rows={5} value={references}
                onChange={event => setReferences(event.target.value)} placeholder={"https://yourcompany.com/products\nhttps://yourcompany.com/solutions"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <p className="text-xs text-muted-foreground">One URL per line. Repeated URLs are read only once.</p>
            </div>}
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <p className="text-xs text-muted-foreground">AI may make mistakes. Each product includes Gains and Pains; amounts stay blank unless supported by your references. Review all generated content. Changes autosave to this HQ; a draft is not made live.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={neutral} onClick={() => changeOpen(false)}>Cancel</button>
              {confirm && <button type="button" className={neutral} onClick={() => { setConfirm(false); setError(""); }}>Back</button>}
              <button type="submit" data-testid="button-products-ai-proceed" className={primary}>{confirm ? "Overwrite & generate" : hasProducts ? "Continue" : "Generate"}</button>
            </div>
          </form>}
          {busy && <button type="button" className={`${neutral} justify-self-end`} onClick={() => changeOpen(false)}>Cancel</button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
