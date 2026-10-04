import { useEffect, useRef } from "react";
import { Archive, BarChart3, Check, Copy, MoreHorizontal, Pause, Pencil, Play, Trash2, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { COLUMNS, rowSummary, type ColumnKey, type PlaybookRecord, type ViewConfig } from "./list-model";

export function PlaybooksTable({ rows, config, selected, onSelect, onSelectVisible, onAction, busy, creator, initials }: {
  rows: PlaybookRecord[]; config: ViewConfig; selected: number[]; onSelect: (id: number) => void;
  onSelectVisible: (checked: boolean) => void; onAction: (action: string, row: PlaybookRecord) => void;
  busy: boolean; creator: string; initials: string;
}) {
  const check = useRef<HTMLInputElement>(null);
  const count = rows.filter(row => selected.includes(row.id)).length;
  useEffect(() => { if (check.current) check.current.indeterminate = count > 0 && count < rows.length; }, [count, rows.length]);
  const columns = config.order.map(key => COLUMNS.find(column => column.key === key)!).filter(column => config.columns.includes(column.key));
  const metrics: Partial<Record<ColumnKey, (row: PlaybookRecord) => number | undefined>> = {
    active: row => row.enrollmentCount, paused: row => row.pausedCount, finished: row => row.finishedCount,
  };
  return <div className="pb-table-scroll"><table className={`pb-table pb-density-${config.density.toLowerCase()}`} style={{ width: `max(100%, ${columns.reduce((total, column) => total + column.width, 0)}px)` }}>
    <caption className="sr-only">Playbooks. Unavailable delivery and reply metrics are shown as a dash.</caption>
    <colgroup>{columns.map(column => <col key={column.key} style={{ width: column.width }} />)}</colgroup>
    <thead><tr>{columns.map(column => <th className={`pb-col-${column.key} ${column.metric ? "pb-numeric" : ""}`} key={column.key} scope="col">
      {column.key === "select" ? <input ref={check} type="checkbox" aria-label="Select all visible playbooks" checked={rows.length > 0 && count === rows.length} disabled={busy || !rows.length} onChange={event => onSelectVisible(event.target.checked)} /> : <span title={column.label}>{column.label}</span>}
    </th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} className={selected.includes(row.id) ? "pb-selected" : ""}>
      {columns.map(column => <td key={column.key} className={`pb-col-${column.key} ${column.metric ? "pb-numeric" : ""}`}>
        {column.key === "select" && <input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.includes(row.id)} disabled={busy} onChange={() => onSelect(row.id)} />}
        {column.key === "activate" && <div className="pb-activate-cell">
          <button role="switch" aria-checked={row.status === "active"} aria-label={`Activate ${row.name}`} disabled={busy || row.status === "archived" || row.status === "completed"} className={`pb-toggle ${row.status === "active" ? "is-on" : ""}`} onClick={() => onAction(row.status === "active" ? "Pause" : "Activate", row)}>
            <span className="pb-toggle-mark">{row.status === "active" ? <Check size={12} /> : <X size={12} />}</span><span className="pb-toggle-thumb" />
          </button><span className="pb-status">{row.status === "active" ? "On" : row.status}</span>
        </div>}
        {column.key === "name" && <div className="pb-name-wrap"><button className="pb-name" onClick={() => onAction("Edit", row)} title={row.name}>{row.name}</button><span className="pb-row-description" title={rowSummary(row)}>{rowSummary(row)}</span></div>}
        {column.key === "optimization" && <span className="pb-muted" title="No playbook optimization settings are configured">—</span>}
        {column.key === "creator" && <span className="pb-creator" title={`Created by ${creator} (you)`}><span className="pb-avatar">{initials}</span>{creator}</span>}
        {column.metric && (metrics[column.key] ? <span>{metrics[column.key]!(row)?.toLocaleString() ?? "—"}</span> : <span className="pb-muted" title={`${column.label} is not recorded for playbooks yet`} aria-label={`${column.label}: unavailable`}>—</span>)}
        {column.key === "actions" && <DropdownMenu><DropdownMenuTrigger className="pb-icon-button" disabled={busy} aria-label={`Actions for ${row.name}`}><MoreHorizontal size={20} /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="pb-menu">
            <DropdownMenuItem onSelect={() => onAction("Edit", row)}><Pencil size={14} />Open builder</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("Rename", row)}><Pencil size={14} />Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("Duplicate", row)}><Copy size={14} />Duplicate</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("Analytics", row)}><BarChart3 size={14} />View analytics</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={row.status === "archived" || row.status === "completed"} onSelect={() => onAction(row.status === "active" ? "Pause" : "Activate", row)}>{row.status === "active" ? <Pause size={14} /> : <Play size={14} />}{row.status === "active" ? "Pause" : "Activate"}</DropdownMenuItem>
            <DropdownMenuItem disabled={row.status === "archived"} onSelect={() => onAction("Archive", row)}><Archive size={14} />Archive</DropdownMenuItem>
            <DropdownMenuSeparator /><DropdownMenuItem className="pb-danger-text" onSelect={() => onAction("Delete", row)}><Trash2 size={14} />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>}
      </td>)}
    </tr>)}</tbody>
  </table></div>;
}