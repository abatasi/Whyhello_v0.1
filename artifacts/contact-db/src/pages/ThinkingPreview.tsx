import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";

/** A visual-only example using the actual indicator used by AI surfaces. */
export default function ThinkingPreview() {
  const [thinking, setThinking] = useState(true);

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />Back to Home
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Live animation preview</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Whyhello is thinking</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          The same breathing-pulse indicator used throughout the app, shown at three sizes.
          This is a visual demo: it does not run AI or send anything.
        </p>
        <button
          type="button"
          onClick={() => setThinking(value => !value)}
          className="mt-5 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {thinking ? "Show finished state" : "Replay thinking state"}
        </button>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-border bg-background p-5 sm:col-span-2">
            <h2 className="text-sm font-semibold">Preview panel</h2>
            <div className="flex min-h-48 flex-col items-center justify-center gap-4 text-center">
              {thinking ? (
                <ThinkingIndicator className="h-14 w-20" label="Preparing a preview" />
              ) : (
                <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden="true" />
              )}
              <p className="text-sm text-muted-foreground">{thinking ? "Preparing a preview…" : "Finished-state example"}</p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-background p-5">
            <h2 className="mb-4 text-sm font-semibold">Generation button</h2>
            <button type="button" disabled className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground dark:bg-indigo-700 dark:border-indigo-700 dark:text-white disabled:cursor-not-allowed">
              {thinking ? <ThinkingIndicator decorative className="h-3.5 w-5" /> : <Sparkles size={14} />}
              {thinking ? "Generating…" : "Generate preview"}
            </button>
          </section>

          <section className="rounded-xl border border-border bg-background p-5">
            <h2 className="mb-4 text-sm font-semibold">Chat reply</h2>
            <div className="inline-flex min-h-11 items-center rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm">
              {thinking ? (
                <ThinkingIndicator label="Preparing a reply" />
              ) : (
                <span>The indicator disappears when a reply arrives.</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
