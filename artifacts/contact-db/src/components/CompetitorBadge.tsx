import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// ── Module-level fetch cache ──────────────────────────────────────────────────
// One lightweight fetch per app session; cleared when the module re-initialises.
let _cache: Set<number> | null = null;
let _inflight: Promise<Set<number>> | null = null;

async function loadCompetitorIds(): Promise<Set<number>> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch("/api/dna/competitor-ids")
    .then(r => (r.ok ? r.json() : { ids: [] }))
    .then((data: { ids?: number[] }) => {
      _cache = new Set(data.ids ?? []);
      _inflight = null;
      return _cache;
    })
    .catch(() => {
      _inflight = null;
      return new Set<number>();
    });
  return _inflight;
}

/** Invalidate the cache (call after saving the HQ/DNA profile). */
export function invalidateCompetitorCache() {
  _cache = null;
}

/** Returns the Set of company IDs that are tagged as competitors in the DNA profile. */
export function useCompetitorIds(): Set<number> {
  const [ids, setIds] = useState<Set<number>>(_cache ?? new Set());
  useEffect(() => { loadCompetitorIds().then(setIds); }, []);
  return ids;
}

// ── Villain SVG ───────────────────────────────────────────────────────────────

export function VillainIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* ── Cape / collar ──────────────────────────────────────────────── */}
      <path
        d="M7 38 L10 29 Q16 33 20 31 Q24 33 30 29 L33 38 Q27 41 20 41 Q13 41 7 38 Z"
        fill="#dc2626"
      />

      {/* ── Head ───────────────────────────────────────────────────────── */}
      <circle cx="20" cy="19" r="13" fill="#1e293b" />

      {/* ── Hair with widow's peak ─────────────────────────────────────── */}
      <path
        d="M7 16 Q8 7 14.5 5 L20 2 L25.5 5 Q32 7 33 16"
        fill="#0f172a"
      />
      {/* Widow's peak triangle */}
      <path d="M20 2 L23 9 L20 7.5 L17 9 Z" fill="#0f172a" />

      {/* ── Domino mask ────────────────────────────────────────────────── */}
      {/* Left lens */}
      <rect x="6" y="15" width="11" height="6" rx="3" fill="#dc2626" />
      {/* Right lens */}
      <rect x="23" y="15" width="11" height="6" rx="3" fill="#dc2626" />
      {/* Bridge */}
      <rect x="16" y="16" width="8" height="4" fill="#dc2626" />

      {/* ── Eyes (glowing whites under mask) ──────────────────────────── */}
      <ellipse cx="11.5" cy="17.5" rx="2.5" ry="1.8" fill="white" opacity="0.92" />
      <ellipse cx="28.5" cy="17.5" rx="2.5" ry="1.8" fill="white" opacity="0.92" />
      {/* Pupils — glancing slightly left, sinister */}
      <circle cx="10.8" cy="17.5" r="1.1" fill="#0f172a" />
      <circle cx="27.8" cy="17.5" r="1.1" fill="#0f172a" />

      {/* ── Smirk ─────────────────────────────────────────────────────── */}
      <path
        d="M13 26 Q17 30 23 27"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Tiny moustache ────────────────────────────────────────────── */}
      <path
        d="M16 23.5 Q18 22 20 23 Q22 22 24 23.5"
        stroke="#64748b"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "bg-rose-50 border-rose-200 text-rose-700",
        "text-[11px] font-semibold leading-none select-none",
        className,
      )}
      title="Identified as a competitor in your HQ profile"
    >
      <VillainIcon size={iconOnly ? 15 : 14} />
      {!iconOnly && <span>Competitor</span>}
    </span>
  );
}
