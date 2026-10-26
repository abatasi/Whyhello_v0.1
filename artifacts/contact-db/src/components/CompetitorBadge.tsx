import { apiFetch } from "@/lib/apiFetch";
import { useState, useEffect } from "react";
import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Module-level fetch cache ──────────────────────────────────────────────────
// One lightweight fetch per app session; cleared when the module re-initialises.
let _cache: Set<number> | null = null;
let _inflight: Promise<Set<number>> | null = null;
let _generation = 0;
const HQ_CONTEXT_CHANGED = "whyhello:hq-context-changed";

async function loadCompetitorIds(): Promise<Set<number>> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  const generation = _generation;
  _inflight = apiFetch("/api/hq/competitor-ids")
    .then(r => (r.ok ? r.json() : { ids: [] }))
    .then((data: { ids?: number[] }) => {
      const ids = new Set(data.ids ?? []);
      if (generation === _generation) {
        _cache = ids;
        _inflight = null;
      }
      return ids;
    })
    .catch(() => {
      if (generation === _generation) _inflight = null;
      return new Set<number>();
    });
  return _inflight;
}

/** Invalidate the cache (call after saving the HQ/DNA profile). */
export function invalidateCompetitorCache() {
  _cache = null;
  _inflight = null;
  _generation++;
  window.dispatchEvent(new Event(HQ_CONTEXT_CHANGED));
}

/** Returns the Set of company IDs that are tagged as competitors in the DNA profile. */
export function useCompetitorIds(): Set<number> {
  const [ids, setIds] = useState<Set<number>>(_cache ?? new Set());
  useEffect(() => {
    let request = 0;
    let mounted = true;
    const refresh = () => {
      const version = ++request;
      void loadCompetitorIds().then(ids => {
        if (mounted && version === request) setIds(ids);
      });
    };
    refresh();
    window.addEventListener(HQ_CONTEXT_CHANGED, refresh);
    return () => { mounted = false; window.removeEventListener(HQ_CONTEXT_CHANGED, refresh); };
  }, []);
  return ids;
}

// ── CompetitorBadge ───────────────────────────────────────────────────────────

interface CompetitorBadgeProps {
  /** Show only the icon without the label text (for tight spaces). */
  iconOnly?: boolean;
  className?: string;
}

/**
 * A pill badge that marks a company as a known competitor.
 * Drop it anywhere — it brings its own icon.
 */
export function CompetitorBadge({ iconOnly = false, className }: CompetitorBadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "bg-rose-50 border-rose-200 text-rose-700",
        "text-[11px] font-semibold leading-none select-none",
        className,
      )}
      title="Identified as a competitor in your HQ profile"
    >
      <Swords size={iconOnly ? 15 : 14} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
      {!iconOnly && <span>Competitor</span>}
    </span>
  );
}
