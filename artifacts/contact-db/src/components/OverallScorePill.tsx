import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function scoreCategory(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Potential";
  return "Low Fit";
}

export function OverallScorePill({
  score,
  category,
  loading = false,
  className,
}: {
  score: number | null | undefined;
  category?: string;
  loading?: boolean;
  className?: string;
}) {
  const colorClass = score == null
    ? "border-border bg-muted text-muted-foreground"
    : score >= 90
      ? "border-green-500 bg-green-500 text-white dark:border-green-600 dark:bg-green-600"
      : score >= 75
        ? "border-blue-500 bg-blue-500 text-white dark:border-blue-600 dark:bg-blue-600"
        : score >= 50
          ? "border-amber-500 bg-amber-500 text-white dark:border-amber-600 dark:bg-amber-600"
          : "border-red-500 bg-red-500 text-white dark:border-red-600 dark:bg-red-600";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold",
        colorClass,
        className,
      )}
      aria-label={score == null ? "Overall score unavailable" : `Overall score ${score}, ${category || scoreCategory(score)}`}
    >
      <Activity className="h-3 w-3" />
      {loading ? "…" : score == null ? "—" : `${score} · ${category || scoreCategory(score)}`}
    </span>
  );
}