import { useGetBulkUploadJobs, getGetBulkUploadJobsQueryKey } from "@workspace/api-client-react";
import type { ImportJob } from "@workspace/api-client-react";
import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Clock3, FileSpreadsheet, LoaderCircle, RefreshCw, Rows3, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function formatDate(value: string | null, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatusBadge({ status }: { status: ImportJob["status"] }) {
  const styles: Record<ImportJob["status"], string> = {
    running: "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200",
    completed: "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    partial: "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
    failed: "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
  };
  const labels: Record<ImportJob["status"], string> = {
    running: "In progress",
    completed: "Completed",
    partial: "Completed with issues",
    failed: "Failed",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", styles[status])} data-testid={`status-import-${status}`}>
      <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", status === "running" ? "animate-pulse bg-sky-600" : status === "completed" ? "bg-emerald-600" : status === "partial" ? "bg-amber-600" : "bg-rose-600")} />
      {labels[status]}
    </span>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "text-foreground",
    good: "text-emerald-700 dark:text-emerald-300",
    warn: "text-amber-700 dark:text-amber-300",
    bad: "text-rose-700 dark:text-rose-300",
  };
  return (
    <div className="min-w-0">
      <p className={cn("font-mono text-lg font-semibold tabular-nums leading-none", tones[tone])} data-testid={`count-${label.toLowerCase()}-${value}`}>{value.toLocaleString()}</p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.09em] text-muted-foreground">{label}</p>
    </div>
  );
}

function JobCard({ job }: { job: ImportJob }) {
  const [errorsOpen, setErrorsOpen] = useState(false);
  const hasErrors = job.errorCount > 0;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_24px_-22px_hsl(var(--foreground)/0.45)]" data-testid={`card-import-job-${job.id}`}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
              <FileSpreadsheet className="h-[18px] w-[18px]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground" title={job.tableLabel} data-testid={`text-dataset-${job.id}`}>{job.tableLabel}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={job.filename} data-testid={`text-filename-${job.id}`}>{job.filename}</p>
            </div>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 px-4 py-3 sm:grid-cols-4">
          <Count label="Total rows" value={job.totalRows} tone="neutral" />
          <Count label="Inserted" value={job.inserted} tone="good" />
          <Count label="Skipped" value={job.skipped} tone="warn" />
          <Count label="Errors" value={job.errorCount} tone="bad" />
        </div>

        <div className="flex flex-col gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5" data-testid={`text-created-${job.id}`}>
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-medium text-foreground/75">Started</span>
            <time dateTime={job.createdAt}>{formatDate(job.createdAt, "Time unavailable")}</time>
          </p>
          <p className="flex items-center gap-1.5 sm:justify-end" data-testid={`text-finished-${job.id}`}>
            {job.finishedAt ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> : <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-700 dark:text-sky-300" aria-hidden="true" />}
            <span className="font-medium text-foreground/75">Finished</span>
            <time dateTime={job.finishedAt ?? undefined}>{formatDate(job.finishedAt, "Still running")}</time>
          </p>
        </div>

        {hasErrors && (
          <div className="border-t border-border/70 pt-3">
            <button
              type="button"
              onClick={() => setErrorsOpen(open => !open)}
              aria-expanded={errorsOpen}
              aria-controls={`import-errors-${job.id}`}
              data-testid={`button-toggle-errors-${job.id}`}
              className="flex w-full items-center justify-between gap-3 rounded-md text-left text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden="true" />
                <span className="font-medium">{job.errorCount.toLocaleString()} row {job.errorCount === 1 ? "error" : "errors"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {job.errorsTruncated ? "Saved sample · list truncated" : "Saved details"}
                </span>
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", errorsOpen && "rotate-180")} aria-hidden="true" />
            </button>
            {errorsOpen && (
              <div id={`import-errors-${job.id}`} className="mt-3 space-y-2" data-testid={`list-import-errors-${job.id}`}>
                {job.errors.length > 0 ? (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {job.errors.map((error, index) => (
                      <div key={`${error.row}-${index}`} className="flex gap-3 rounded-md border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs dark:border-rose-900/60 dark:bg-rose-950/25">
                        <span className="shrink-0 font-mono font-semibold text-rose-800 dark:text-rose-200">{error.row === 0 ? "File" : `Row ${error.row}`}</span>
                        <span className="min-w-0 break-words text-rose-900/90 dark:text-rose-100/90">{error.reason}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Error details were not included in the saved job record.</p>
                )}
                {job.errorsTruncated && (
                  <p className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" data-testid={`notice-truncated-errors-${job.id}`}>
                    Only the saved sample of row errors is shown. The full list was truncated when this job was stored; {job.errorCount.toLocaleString()} total errors were recorded.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {!hasErrors && job.errorsTruncated && (
          <p className="border-t border-border/70 pt-3 text-xs text-amber-800 dark:text-amber-200" data-testid={`notice-truncated-errors-${job.id}`}>
            Saved error details were truncated when this job was stored.
          </p>
        )}
      </div>
    </article>
  );
}

function JobSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading import history" data-testid="loading-import-jobs">
      {[0, 1, 2].map(item => (
        <div key={item} className="animate-pulse rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 rounded bg-muted" />
              <div className="h-3 w-52 max-w-full rounded bg-muted" />
            </div>
            <div className="h-6 w-24 rounded-full bg-muted" />
          </div>
          <div className="mt-5 grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(cell => <div key={cell} className="h-10 rounded bg-muted/70" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ImportJobsPanelProps {
  /** Optional class for embedding the history panel in a parent layout. */
  className?: string;
}

export default function ImportJobsPanel({ className }: ImportJobsPanelProps) {
  const { data: jobs, isLoading, isFetching, isError, refetch } = useGetBulkUploadJobs({
    query: {
      enabled: true,
      queryKey: getGetBulkUploadJobsQueryKey(),
    },
  });

  const refresh = () => { void refetch(); };

  return (
    <section className={cn("space-y-5", className)} aria-labelledby="import-jobs-heading" data-testid="panel-import-jobs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
            Import activity
          </div>
          <h2 id="import-jobs-heading" className="text-xl font-semibold tracking-tight">Recent jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">A reliable record of what each CSV added, skipped, or could not import.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={isFetching}
          className="h-9 shrink-0 gap-2 self-start sm:self-auto"
          data-testid="button-refresh-import-jobs"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <JobSkeleton />
      ) : isError ? (
        <div className="rounded-xl border border-rose-300/70 bg-rose-50/70 p-6 dark:border-rose-900/60 dark:bg-rose-950/20" role="alert" data-testid="error-import-jobs">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
              <X className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-rose-950 dark:text-rose-100">Import history could not be loaded</h3>
              <p className="mt-1 text-sm text-rose-900/80 dark:text-rose-200/80">Your saved jobs are unchanged. Check your connection and try again.</p>
              <Button type="button" variant="outline" onClick={refresh} disabled={isFetching} className="mt-4 h-9 gap-2 border-rose-300 bg-transparent text-rose-900 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-100 dark:hover:bg-rose-950" data-testid="button-retry-import-jobs">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
                Try again
              </Button>
            </div>
          </div>
        </div>
      ) : jobs?.length ? (
        <div className="space-y-3" data-testid="list-import-jobs">
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-card/70 px-6 py-10 text-center" data-testid="empty-import-jobs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No imports saved yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">When a CSV import is recorded, its dataset, results, and any row-level errors will appear here.</p>
        </div>
      )}
    </section>
  );
}
