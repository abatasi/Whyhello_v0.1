import { useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import {
  Archive, ArrowDownUp, Check, ChevronDown, ClipboardList, Copy, Filter,
  MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Settings2, Trash2, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLUMNS, DATE_RANGES, DEFAULT_VIEW, PINNED, SORT_FIELDS, type ColumnKey, type ViewConfig } from "./list-model";
import type { SavedView } from "./use-playbook-views";

interface Props {
  config: ViewConfig; setConfig: Dispatch<SetStateAction<ViewConfig>>;
  views: SavedView[]; selectedView: string; selectedCount: number;
  filtersOpen: boolean; onFilters: () => void; busy: boolean;
  onSelectView: (id: string) => void; onSave: () => void; onRename: (view: SavedView) => void;
  onDuplicateView: (id: string) => void; onDeleteView: (id: string) => void;
  onBulk: (action: string) => void; onClearSelection: () => void;
}
export function PlaybooksToolbar(props: Props) {
  const { config, setConfig, busy } = props;
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !(event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true], [role=dialog]"))) {
        event.preventDefault(); search.current?.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);
  const viewName = props.views.find(view => view.id === props.selectedView)?.name ?? "All Playbooks";
  const activeCount = config.statuses.length + config.creators.length + config.dateRange.length;
  const toggle = (key: "statuses" | "creators" | "dateRange", value: string) => setConfig(old => ({
    ...old, [key]: old[key].includes(value) ? old[key].filter(item => item !== value) : [...old[key], value],
  }));
  const move = (key: ColumnKey, direction: number) => setConfig(old => {
    const next = [...old.order], index = next.indexOf(key);
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    return { ...old, order: next };
  });
  const options = config.order.map(key => COLUMNS.find(column => column.key === key)!)
    .filter(column => !PINNED.includes(column.key as typeof PINNED[number]));
  const sortMenu = <DropdownMenu>
    <DropdownMenuTrigger className="pb-control" aria-label="Sort playbooks"><ArrowDownUp size={15} />Sort<span className="pb-sort-current">{config.sort}</span><ChevronDown size={13} /></DropdownMenuTrigger>
    <DropdownMenuContent className="pb-menu" align="end">
      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
      {SORT_FIELDS.map(field => <DropdownMenuItem key={field} onSelect={() => setConfig(old => ({ ...old, sort: field }))}>{field}{field === config.sort && <Check size={14} className="ml-auto" />}</DropdownMenuItem>)}
      <DropdownMenuSeparator />
      {(["Ascending", "Descending"] as const).map(direction => <DropdownMenuItem key={direction} onSelect={() => setConfig(old => ({ ...old, direction }))}>{direction}{config.direction === direction && <Check size={14} className="ml-auto" />}</DropdownMenuItem>)}
      <DropdownMenuSeparator /><DropdownMenuItem disabled title="Delivery and reply tracking is not available">Delivery/reply rate unavailable</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
  const viewOptions = <Popover>
    <PopoverTrigger className="pb-control" aria-label="View options"><Settings2 size={15} />View options<ChevronDown size={13} /></PopoverTrigger>
    <PopoverContent className="pb-menu pb-view-options" align="end">
      <h3>Columns</h3>
      <p className="pb-helper">Selection, activation, name and actions stay fixed.</p>
      {options.map((column, index) => <div className="pb-column-option" key={column.key}>
        <label><input type="checkbox" checked={config.columns.includes(column.key)} onChange={() => setConfig(old => ({ ...old, columns: old.columns.includes(column.key) ? old.columns.filter(key => key !== column.key) : [...old.columns, column.key] }))} />{column.label}</label>
        <div><button aria-label={`Move ${column.label} left`} disabled={index === 0} onClick={() => move(column.key, -1)}>‹</button><button aria-label={`Move ${column.label} right`} disabled={index === options.length - 1} onClick={() => move(column.key, 1)}>›</button></div>
      </div>)}
      <h3>Row density</h3><div className="pb-density">{(["Compact", "Comfortable", "Spacious"] as const).map(density => <button key={density} aria-pressed={config.density === density} onClick={() => setConfig(old => ({ ...old, density }))}>{density}</button>)}</div>
      <button className="pb-reset" onClick={() => setConfig(old => ({ ...old, columns: [...DEFAULT_VIEW.columns], order: [...DEFAULT_VIEW.order], density: DEFAULT_VIEW.density }))}><RotateCcw size={14} />Reset view options</button>
    </PopoverContent>
  </Popover>;
  return <section className="pb-toolbar" aria-label="Playbook controls">
    {props.selectedCount > 0 ? <div className="pb-bulkbar" role="toolbar" aria-label="Selected playbooks">
      <strong>{props.selectedCount} selected</strong>
      {[["Pause", Pause], ["Activate", Play], ["Duplicate", Copy], ["Archive", Archive], ["Delete", Trash2]].map(([label, Icon]) => {
        const ActionIcon = Icon as typeof Pause;
        return <button key={label as string} disabled={busy} className={label === "Delete" ? "pb-danger-text" : ""} onClick={() => props.onBulk(label as string)}><ActionIcon size={14} />{label as string}</button>;
      })}
      <button className="pb-clear-selection" aria-label="Clear selection" onClick={props.onClearSelection}><X size={15} /></button>
    </div> : <div className="pb-toolbar-main">
      <div className="pb-toolbar-left">
        <DropdownMenu>
          <DropdownMenuTrigger className="pb-control pb-view-trigger"><ClipboardList size={15} /><span>{viewName}</span><ChevronDown size={14} /></DropdownMenuTrigger>
          <DropdownMenuContent className="pb-menu pb-views-menu" align="start">
            <DropdownMenuLabel>Default</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => props.onSelectView("all")}>All Playbooks{props.selectedView === "all" && <Check size={14} className="ml-auto" />}</DropdownMenuItem>
            <DropdownMenuSeparator /><DropdownMenuLabel>My views</DropdownMenuLabel>
            {props.views.length === 0 && <p className="pb-helper px-2 py-2">No saved views yet.</p>}
            {props.views.map(view => <div className="pb-saved-view" key={view.id}>
              <DropdownMenuItem onSelect={() => props.onSelectView(view.id)}>{view.name}{props.selectedView === view.id && <Check size={14} className="ml-auto" />}</DropdownMenuItem>
              <DropdownMenuSub><DropdownMenuSubTrigger aria-label={`Manage ${view.name}`}><MoreHorizontal size={15} /></DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="pb-menu">
                  <DropdownMenuItem onSelect={() => props.onRename(view)}>Rename</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => props.onDuplicateView(view.id)}>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem className="pb-danger-text" onSelect={() => props.onDeleteView(view.id)}>Delete view</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </div>)}
            <DropdownMenuSeparator /><DropdownMenuItem onSelect={props.onSave}><Plus size={14} />Save as new view</DropdownMenuItem>
            <p className="pb-helper px-2 py-1">Private to your account in this browser.</p>
          </DropdownMenuContent>
        </DropdownMenu>
        <button className="pb-control" aria-expanded={props.filtersOpen} onClick={props.onFilters}><Filter size={15} />Filters{activeCount > 0 && <span className="pb-filter-count">{activeCount}</span>}<ChevronDown size={14} /></button>
        <label className="pb-search"><Search size={15} /><input ref={search} aria-label="Search playbooks" placeholder="Search playbooks…" value={config.query} onChange={event => setConfig(old => ({ ...old, query: event.target.value }))} />{config.query ? <button aria-label="Clear search" onClick={() => setConfig(old => ({ ...old, query: "" }))}><X size={14} /></button> : <kbd>/</kbd>}</label>
      </div>
      <div className="pb-toolbar-right">
        <button className="pb-save-view pb-desktop-control" onClick={props.onSave}>Save as new view</button>
        <span className="pb-toolbar-divider pb-desktop-control" />
        <div className="pb-desktop-control">{sortMenu}</div><div className="pb-desktop-control">{viewOptions}</div>
        <Popover><PopoverTrigger className="pb-icon-button pb-overflow-control" aria-label="More table controls"><MoreHorizontal size={18} /></PopoverTrigger>
          <PopoverContent className="pb-menu pb-responsive-controls" align="end"><button className="pb-save-view" onClick={props.onSave}>Save as new view</button>{sortMenu}{viewOptions}</PopoverContent>
        </Popover>
      </div>
    </div>}
    {props.filtersOpen && <div className="pb-filter-panel">
      {([
        ["Status", "statuses", ["active", "paused", "draft", "completed", "archived"]],
        ["Creator", "creators", ["You"]], ["Created date", "dateRange", DATE_RANGES],
      ] as const).map(([label, field, values]) => <fieldset key={field}><legend>{label}</legend>{values.map(value => <label key={value}><input type="checkbox" checked={config[field].includes(value)} onChange={() => toggle(field, value)} /><span className={field === "statuses" ? "capitalize" : ""}>{value}</span></label>)}</fieldset>)}
      <fieldset disabled><legend>Delivery performance</legend><p className="pb-helper">Bounce, spam and reply tracking<br />is not recorded for playbooks yet.</p></fieldset>
      <button className="pb-reset" onClick={() => setConfig(old => ({ ...old, statuses: [], creators: [], dateRange: [] }))}>Clear all filters</button>
    </div>}
    {activeCount > 0 && props.selectedCount === 0 && <div className="pb-filter-chips">
      {(["statuses", "creators", "dateRange"] as const).flatMap(field => config[field].map(value => <button key={`${field}:${value}`} onClick={() => toggle(field, value)}>{field === "statuses" ? "Status" : field === "creators" ? "Creator" : "Created"}: <b>{value}</b><X size={12} /></button>))}
      <button className="pb-reset" onClick={() => setConfig(old => ({ ...old, statuses: [], creators: [], dateRange: [] }))}>Clear all</button>
    </div>}
  </section>;
}