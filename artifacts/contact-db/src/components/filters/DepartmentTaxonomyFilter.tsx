import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Minus, Check, Search as SearchIcon, X } from "lucide-react";
import { useGetDepartmentTaxonomy, getGetDepartmentTaxonomyQueryKey } from "@workspace/api-client-react";
import {
  pathFor, resolveAlias, compactSelection, searchNodes, selectionState, toggleSelection,
  type DepartmentNode,
} from "@workspace/department-taxonomy";
import { cn } from "@/lib/utils";

interface Props {
  /** Compact node IDs (plus any unknown legacy labels). */
  selected: string[];
  /** Toggles a single value in/out of the stored array (same contract as handleFilterChange). */
  onToggleValue: (value: string) => void;
}

function TriCheckbox({ state, label, onClick, testId }: {
  state: boolean | "indeterminate"; label: string; onClick: () => void; testId: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "indeterminate" ? "mixed" : state}
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        state ? "bg-primary border-primary text-white" : "border-input bg-background hover:border-primary/50",
      )}
    >
      {state === "indeterminate" ? <Minus className="h-3 w-3" strokeWidth={3} /> : state ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  );
}

export function DepartmentTaxonomyFilter({ selected, onToggleValue }: Props) {
  const { data, isLoading, isError, refetch } = useGetDepartmentTaxonomy(undefined, {
    query: { queryKey: getGetDepartmentTaxonomyQueryKey(), staleTime: 60 * 60 * 1000, refetchOnMount: false },
  });
  const nodes = useMemo<DepartmentNode[]>(
    () => (data ?? []).filter((n) => n.isActive).map((n) => ({ ...n, level: n.level as 1 | 2 | 3 })),
    [data],
  );
  const children = useMemo(() => {
    const map = new Map<string | null, DepartmentNode[]>();
    for (const n of nodes) {
      const list = map.get(n.parentId) ?? [];
      list.push(n);
      map.set(n.parentId, list);
    }
    map.forEach((l) => l.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    return map;
  }, [nodes]);
  const ids = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Convert known legacy labels to stable IDs; unknown ones are left untouched.
  const toggleRef = useRef(onToggleValue);
  toggleRef.current = onToggleValue;
  useEffect(() => {
    if (!nodes.length) return;
    const legacy = selected.filter((v) => !ids.has(v));
    let next = selected;
    for (const v of legacy) {
      const node = resolveAlias(nodes, v);
      if (node) {
        toggleRef.current(v);
        if (!next.includes(node.id)) { toggleRef.current(node.id); next = [...next, node.id]; }
      }
    }
  }, [nodes, ids, selected]);

  const apply = (next: string[]) => {
    next.filter((v) => !selected.includes(v)).forEach((v) => onToggleValue(v));
    selected.filter((v) => !next.includes(v)).forEach((v) => onToggleValue(v));
  };
  const toggle = (id: string) => apply(toggleSelection(nodes, selected, id));
  const flip = (id: string) => setOpen((p) => { const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const searching = query.trim().length > 0;
  const matchIds = useMemo(() => (searching ? new Set(searchNodes(nodes, query).map((n) => n.id)) : null), [nodes, query, searching]);
  const visible = useMemo(() => {
    if (!matchIds) return null;
    const keep = new Set<string>();
    const addDown = (id: string) => (children.get(id) ?? []).forEach((c) => { keep.add(c.id); addDown(c.id); });
    matchIds.forEach((id) => {
      pathFor(nodes, id).forEach((p) => keep.add(p.id));
      addDown(id);
    });
    return keep;
  }, [matchIds, nodes, children]);

  const label = (id: string) => pathFor(nodes, id).map((p) => p.name).join(" / ");

  const renderNode = (n: DepartmentNode): React.ReactNode => {
    if (visible && !visible.has(n.id)) return null;
    const kids = children.get(n.id) ?? [];
    const expanded = searching ? kids.some((k) => visible?.has(k.id)) : open.has(n.id);
    const state = selectionState(nodes, selected, n.id);
    const isMatch = !!matchIds?.has(n.id);
    const ctx = searching && n.level > 1 ? pathFor(nodes, n.id).slice(0, -1).map((p) => p.name).join(" / ") : "";
    return (
      <div key={n.id}>
        <div className={cn("flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/40 transition-colors", n.level > 1 && (n.level === 2 ? "ml-5" : "ml-10"))}>
          <TriCheckbox state={state} label={n.name} onClick={() => toggle(n.id)} testId={`checkbox-department-${n.id}`} />
          <button type="button" onClick={() => toggle(n.id)} tabIndex={-1} className="min-w-0 flex-1 text-left">
            <span title={n.name} className={cn("block truncate text-sm", state ? "text-foreground font-medium" : "text-muted-foreground", isMatch && "text-foreground")}>{n.name}</span>
            {ctx && <span className="block truncate text-[10px] text-muted-foreground">{ctx}</span>}
          </button>
          {kids.length > 0 && (
            <>
              <span className="text-[10px] text-muted-foreground">{kids.length}</span>
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${n.name}`}
                data-testid={`button-expand-department-${n.id}`}
                disabled={searching}
                onClick={() => flip(n.id)}
                className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
              </button>
            </>
          )}
        </div>
        {expanded && kids.map(renderNode)}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="department-loading" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="text-xs text-muted-foreground" data-testid="department-error">
        Couldn't load departments.{" "}
        <button type="button" data-testid="button-retry-departments" onClick={() => refetch()} className="font-medium text-primary hover:underline">Retry</button>
      </div>
    );
  }

  const roots = children.get(null) ?? [];
  const anyVisible = !visible || roots.some((r) => visible.has(r.id));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {compactSelection(nodes, selected).map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`remove-filter-department-${id}`}
              onClick={() => (ids.has(id) ? toggle(id) : onToggleValue(id))}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              aria-label={`Remove ${ids.has(id) ? label(id) : id}`}
            >
              <span className="max-w-[170px] truncate">{ids.has(id) ? label(id) : id}</span>
              <X className="h-3 w-3 flex-shrink-0" />
            </button>
          ))}
          <button
            type="button"
            data-testid="button-clear-departments"
            onClick={() => selected.forEach((v) => onToggleValue(v))}
            className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          data-testid="search-filter-departments-job-function"
          type="text"
          placeholder="Search departments…"
          aria-label="Search departments and job functions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-input bg-background outline-none focus:border-primary/60 placeholder:text-muted-foreground transition-colors"
        />
        {query && (
          <button type="button" aria-label="Clear search" data-testid="clear-filter-search-departments"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto pr-1 scroll-thin" role="group" aria-label="Departments">
        {roots.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center" data-testid="department-empty">No departments available.</p>
        ) : !anyVisible ? (
          <p className="text-xs text-muted-foreground py-2 text-center">No options found</p>
        ) : roots.map(renderNode)}
      </div>
    </div>
  );
}
