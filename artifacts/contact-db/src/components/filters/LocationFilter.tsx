import { useState } from "react";
import { useDebounce } from "use-debounce";
import { Check, Loader2, Search as SearchIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import { useSearchLocations, getSearchLocationsQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export type LocationKey = "location" | "excludedLocation" | "headOfficeLocation" | "excludedHeadOfficeLocation";

export function locationLabel(value: string): string {
  if (!value.startsWith("geo:")) return value;
  return value.split(":").slice(2).map((p) => { try { return decodeURIComponent(p); } catch { return p; } })
    .filter(Boolean).join(", ");
}

type Values = Record<LocationKey, string[]>;
interface Props {
  mode: "contacts" | "companies";
  values: Values;
  onToggle: (key: LocationKey, value: string) => void;
  onClear: (keys: LocationKey[]) => void;
}

function Picker({ id, label, selected, onToggle, onClear }: {
  id: string; label: string; selected: string[]; onToggle: (v: string) => void; onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [dq] = useDebounce(q.trim(), 300);
  const hasSearch = q.trim().length > 0;
  const { data, isFetching, isError, refetch } = useSearchLocations({ q: dq }, {
    query: { queryKey: getSearchLocationsQueryKey({ q: dq }), enabled: hasSearch && dq.length > 0, staleTime: 60 * 60 * 1000, refetchOnWindowFocus: false },
  });
  const options = data ?? [];
  const busy = hasSearch && (isFetching || q.trim() !== dq);
  return (
    <div className="space-y-2" data-testid={`location-picker-${id}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {selected.length > 0 && (
          <button type="button" onClick={onClear} data-testid={`location-clear-${id}`}
            className="text-[11px] text-muted-foreground underline hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Clear
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={`${label} selected`}>
          {selected.map((v) => (
            <li key={v} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] text-foreground">
              <span className="truncate">{locationLabel(v)}</span>
              <button type="button" aria-label={`Remove ${locationLabel(v)}`} onClick={() => onToggle(v)}
                className="rounded-full p-0.5 hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
          aria-label={`Search ${label}`} placeholder="Type city, state or country"
          data-testid={`location-search-${id}`}
          className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-7 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
        {busy && <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      {hasSearch && <div aria-live="polite" className="max-h-52 overflow-y-auto rounded-md border border-border/60">
        {busy ? (
          <div className="space-y-1 p-2" aria-label="Loading locations">
            {[0, 1, 2].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}
          </div>
        ) : isError ? (
          <div className="p-2 text-xs text-muted-foreground">
            Couldn't load locations.{" "}
            <button type="button" onClick={() => refetch()} className="font-semibold text-primary underline">Retry</button>
          </div>
        ) : options.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">No locations found.</p>
        ) : (
          <ul role="listbox" aria-multiselectable="true" aria-label={`${label} options`}>
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <li key={o.value} role="option" aria-selected={on}>
                  <button type="button" onClick={() => onToggle(o.value)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      on ? "border-primary bg-primary text-white" : "border-input bg-background")}>
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1" title={o.label}>{o.label}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{o.kind}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>}
    </div>
  );
}

export function LocationFilter({ mode, values, onToggle, onClear }: Props) {
  const [tab, setTab] = useState<"contact" | "headOffice">(mode === "contacts" ? "contact" : "headOffice");
  const [showExcl, setShowExcl] = useState(false);
  const head = mode === "companies" || tab === "headOffice";
  const inc: LocationKey = mode === "companies" ? "location" : head ? "headOfficeLocation" : "location";
  const exc: LocationKey = mode === "companies" ? "excludedLocation" : head ? "excludedHeadOfficeLocation" : "excludedLocation";
  const tabs = [["contact", "Contact", "location", "excludedLocation"], ["headOffice", "Head Office", "headOfficeLocation", "excludedHeadOfficeLocation"]] as const;
  return (
    <div className="space-y-3">
      {mode === "contacts" && (
        <div role="tablist" aria-label="Location type" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
          {tabs.map(([id, text, a, b]) => {
            const n = values[a].length + values[b].length;
            return (
              <button key={id} type="button" role="tab" aria-selected={tab === id} data-testid={`location-tab-${id}`}
                onClick={() => setTab(id)}
                className={cn("rounded px-2 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                  tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {text}{n > 0 && <span className="ml-1 text-primary">({n})</span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {head ? "Head Office: the company's headquarters location." : "Contact: where the person is physically located."}
      </p>
      <Picker key={inc} id={inc} label="Include" selected={values[inc]}
        onToggle={(v) => onToggle(inc, v)} onClear={() => onClear([inc])} />
      <button type="button" aria-expanded={showExcl} onClick={() => setShowExcl((s) => !s)} data-testid="location-exclusions-toggle"
        className="flex w-full items-center justify-between text-xs font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span>Exclusions{values[exc].length > 0 && <span className="ml-1 text-primary">({values[exc].length})</span>}</span>
        {showExcl ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {showExcl && (
        <Picker key={exc} id={exc} label="Exclude" selected={values[exc]}
          onToggle={(v) => onToggle(exc, v)} onClear={() => onClear([exc])} />
      )}
    </div>
  );
}
