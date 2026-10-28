import { useEffect, useRef, useState } from "react";
import type { HqCompanyFields, HqCompanyWebsiteResult } from "@workspace/api-client-react";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function CompanyAiFill({ company, disabled, onApply, onBusyChange }: {
  company: HqCompanyFields;
  disabled: boolean;
  onApply: (company: HqCompanyFields) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"url" | "confirm">("url");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const hasContent = [company.name, company.valueWedge, company.positioning, company.differentiators, ...company.pillars]
    .some(value => value.trim().length > 0);

  useEffect(() => () => {
    request.current?.abort();
    busyCallback.current(false);
  }, []);

  function changeOpen(next: boolean) {
    if (!next) {
      request.current?.abort();
      request.current = null;
      setBusy(false);
      busyCallback.current(false);
    }
    setError("");
    setStep("url");
    setOpen(next);
  }

  async function generate() {
    if (request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    busyCallback.current(true);
    setError("");
    try {
      const response = await apiFetch("/api/hq/company-from-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }), signal: controller.signal,
      });
      const result = await response.json() as HqCompanyWebsiteResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Company generation failed. Your existing fields have not been changed.");
      if (controller.signal.aborted) return;
      if (!result.company || !Array.isArray(result.company.pillars) || result.company.pillars.length !== 3 ||
          ![result.company.name, result.company.valueWedge, result.company.positioning, result.company.differentiators, ...result.company.pillars].every(v => typeof v === "string")) {
        throw new Error("AI returned incomplete Company fields. Your existing fields have not been changed.");
      }
      onApply(result.company);
      setSourceUrls(result.sourceUrls);
      setOpen(false);
      setStep("url");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Company generation failed. Your fields are unchanged.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
        busyCallback.current(false);
      }
    }
  }

  function submitUrl() {
    setError("");
    try {
      const parsed = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
      if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname.includes(".") || parsed.username || parsed.password) throw new Error();
    } catch { setError("Enter a valid public company website, such as https://yourcompany.com."); return; }
    if (hasContent) setStep("confirm");
    else void generate();
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button type="button" disabled={disabled || busy} onClick={() => changeOpen(true)}
        data-testid="button-company-ai"
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
        <Sparkles className="size-3.5" aria-hidden="true" /> AI
      </button>
      {sourceUrls.length > 0 && <p role="status" className="max-w-32 sm:max-w-56 text-right text-[10px] text-muted-foreground">
        Company fields generated. Review for accuracy.{" "}
        <a href={sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Website source</a>
      </p>}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{busy ? "Building your Company profile" : step === "confirm" ? "Replace existing Company fields?" : "Fill Your Company with AI"}</DialogTitle>
          <DialogDescription>
            {step === "confirm"
              ? "Your Company already contains information. Continuing will overwrite every field in this section with a new website-based draft."
              : "Enter your company’s website. AI will use its public pages to draft your company name, value wedge, positioning, differentiators and three messaging pillars."}
          </DialogDescription>
          {busy ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
              <ThinkingIndicator label="Reading company website and drafting Company fields" />
              <p className="text-sm text-foreground">Reading the website and drafting your Company fields…</p>
            </div>
          ) : (
            <form onSubmit={event => { event.preventDefault(); if (step === "confirm") void generate(); else submitUrl(); }} className="space-y-4">
              {step === "url" ? <div className="space-y-1.5">
                <label htmlFor="hq-company-ai-url" className="text-xs font-semibold text-foreground">Company website URL</label>
                <input id="hq-company-ai-url" data-testid="input-company-ai-url" autoFocus value={url} onChange={event => setUrl(event.target.value)}
                  placeholder="https://yourcompany.com" inputMode="url" autoComplete="url" maxLength={2048} required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div> : <div className="rounded-lg border border-amber-600/60 bg-background p-3 text-sm text-foreground">
                <p className="font-semibold">This replaces Company name, Value wedge, Positioning statement, Key differentiators and all Messaging pillars.</p>
                <p className="mt-2 text-xs text-muted-foreground">Other HQ sections will not change. Unsupported details may be left blank rather than invented. Nothing changes if generation fails or you cancel.</p>
                <p className="mt-2 break-all text-xs text-foreground">{url.trim()}</p>
              </div>}
              {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
              <p className="text-xs text-muted-foreground">AI may make mistakes. Review the generated fields before using them. Changes use your existing HQ autosave and do not activate a draft HQ.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => changeOpen(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">Cancel</button>
                {step === "confirm" && <button type="button" onClick={() => { setStep("url"); setError(""); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">Back</button>}
                <button type="submit" data-testid="button-company-ai-proceed"
                  className="rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
                  {step === "confirm" ? "Overwrite & generate" : hasContent ? "Continue" : "Generate"}
                </button>
              </div>
            </form>
          )}
          {busy && <button type="button" onClick={() => changeOpen(false)} className="justify-self-end rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">Cancel</button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
