import './_group.css';
import './_operational.css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, BarChart3, BookOpen, Check,
  CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardList, Copy, Filter, Gauge, Info, ListFilter, Mail, MoreHorizontal,
  Pencil, Plus, Search, Settings2, ShieldAlert, Sparkles, Trash2,
  X, Zap, Pause, Archive, RotateCcw,
} from 'lucide-react';

type Status = 'Active' | 'Paused' | 'Draft' | 'Completed' | 'Archived';
type Creator = { name: string; initials: string };
type Playbook = {
  id: number; name: string; description: string; status: Status; creator: Creator;
  createdAt: string; active: number; paused: number; notSent: number; bounced: number;
  spam: number; finished: number; scheduled: number; delivered: number; replies: number;
  optimization: string;
};
type SavedViewConfig = {
  query: string; filters: Record<string, string[]>; sortField: string;
  sortDirection: 'Descending' | 'Ascending'; visibleCols: ColumnKey[]; columnOrder: ColumnKey[];
  density: 'Compact' | 'Comfortable' | 'Spacious';
};
type SavedView = { id: string; name: string; visibility: 'Private' | 'Team'; preset?: string; config: SavedViewConfig };
type Column = { key: keyof Playbook | 'activate' | 'actions' | 'select'; label: string; width: number; metric?: boolean };
type ColumnKey = Column['key'];
const PEOPLE: Creator[] = [
  { name: 'Laura Chen', initials: 'LC' }, { name: 'Marcus Reed', initials: 'MR' },
  { name: 'Priya Nair', initials: 'PN' }, { name: 'Owen Blake', initials: 'OB' },
  { name: 'Elena Torres', initials: 'ET' },
];
const dateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};
const INITIAL: Playbook[] = [
  { id: 101, name: 'Enterprise Prospecting', description: 'Personalized outreach for tier-one accounts.', status: 'Active', creator: PEOPLE[0], createdAt: dateDaysAgo(2), active: 184, paused: 12, notSent: 46, bounced: 8, spam: 2, finished: 324, scheduled: 78, delivered: 2416, replies: 183, optimization: 'Reply guard' },
  { id: 102, name: 'At-Risk Customers', description: 'Re-engage accounts showing signs of churn.', status: 'Paused', creator: PEOPLE[2], createdAt: dateDaysAgo(4), active: 0, paused: 76, notSent: 18, bounced: 5, spam: 1, finished: 109, scheduled: 0, delivered: 684, replies: 42, optimization: '—' },
  { id: 103, name: 'Product Demo Follow-Up', description: 'A thoughtful follow-up after a product walkthrough.', status: 'Active', creator: PEOPLE[1], createdAt: dateDaysAgo(8), active: 92, paused: 4, notSent: 21, bounced: 3, spam: 0, finished: 156, scheduled: 53, delivered: 1094, replies: 126, optimization: 'Send window' },
  { id: 104, name: 'Inbound Leads', description: 'Fast first response for high-intent inbound requests.', status: 'Active', creator: PEOPLE[0], createdAt: dateDaysAgo(12), active: 231, paused: 9, notSent: 11, bounced: 6, spam: 1, finished: 412, scheduled: 108, delivered: 2897, replies: 291, optimization: 'Reply guard' },
  { id: 105, name: 'Conference Outreach', description: 'Warm introductions before and after industry events.', status: 'Draft', creator: PEOPLE[4], createdAt: dateDaysAgo(19), active: 0, paused: 0, notSent: 0, bounced: 0, spam: 0, finished: 0, scheduled: 0, delivered: 0, replies: 0, optimization: '—' },
  { id: 106, name: 'Strategic Accounts', description: 'Multi-threaded account development for named accounts.', status: 'Active', creator: PEOPLE[3], createdAt: dateDaysAgo(27), active: 67, paused: 14, notSent: 32, bounced: 4, spam: 0, finished: 89, scheduled: 24, delivered: 837, replies: 94, optimization: 'Send window' },
  { id: 107, name: 'Q4 Re-Engagement', description: 'Bring dormant opportunities back into conversation.', status: 'Paused', creator: PEOPLE[1], createdAt: dateDaysAgo(36), active: 0, paused: 143, notSent: 37, bounced: 14, spam: 3, finished: 208, scheduled: 0, delivered: 1538, replies: 72, optimization: '—' },
  { id: 108, name: 'Partner Recruitment', description: 'Start relevant conversations with potential partners.', status: 'Active', creator: PEOPLE[2], createdAt: dateDaysAgo(42), active: 54, paused: 3, notSent: 8, bounced: 2, spam: 0, finished: 71, scheduled: 19, delivered: 586, replies: 68, optimization: 'Reply guard' },
  { id: 109, name: 'High Intent Prospects', description: 'Coordinate timely outreach around buying signals.', status: 'Active', creator: PEOPLE[0], createdAt: dateDaysAgo(54), active: 308, paused: 11, notSent: 19, bounced: 9, spam: 1, finished: 531, scheduled: 142, delivered: 3781, replies: 347, optimization: 'Send window' },
  { id: 110, name: 'Trial Conversion', description: 'Help trial users reach their first meaningful outcome.', status: 'Completed', creator: PEOPLE[4], createdAt: dateDaysAgo(65), active: 0, paused: 0, notSent: 6, bounced: 7, spam: 1, finished: 624, scheduled: 0, delivered: 3421, replies: 284, optimization: '—' },
  { id: 111, name: 'Closed Lost Revival', description: 'Revisit closed-lost opportunities with a new point of view.', status: 'Draft', creator: PEOPLE[3], createdAt: dateDaysAgo(78), active: 0, paused: 0, notSent: 0, bounced: 0, spam: 0, finished: 0, scheduled: 0, delivered: 0, replies: 0, optimization: '—' },
  { id: 112, name: 'Executive Outreach', description: 'Concise, executive-level messaging for strategic deals.', status: 'Active', creator: PEOPLE[1], createdAt: dateDaysAgo(93), active: 38, paused: 2, notSent: 12, bounced: 1, spam: 0, finished: 47, scheduled: 16, delivered: 426, replies: 57, optimization: 'Reply guard' },
];
const COLS: Column[] = [
  { key: 'select', label: '', width: 46 }, { key: 'activate', label: 'Activate', width: 120 },
  { key: 'name', label: 'Name', width: 270 }, { key: 'optimization', label: 'Optimizations', width: 140 },
  { key: 'creator', label: 'Created by', width: 155 }, { key: 'active', label: 'Active', width: 110, metric: true },
  { key: 'paused', label: 'Paused', width: 110, metric: true }, { key: 'notSent', label: 'Not sent', width: 110, metric: true },
  { key: 'bounced', label: 'Bounced', width: 110, metric: true }, { key: 'spam', label: 'Spam blocked', width: 118, metric: true },
  { key: 'finished', label: 'Finished', width: 110, metric: true }, { key: 'scheduled', label: 'Scheduled', width: 110, metric: true },
  { key: 'delivered', label: 'Delivered', width: 110, metric: true }, { key: 'replies', label: 'Replies', width: 110, metric: true },
  { key: 'actions', label: '', width: 64 },
];
const DEFAULT_CONFIG: SavedViewConfig = {
  query: '', filters: {}, sortField: 'Created date', sortDirection: 'Descending',
  visibleCols: COLS.map(c => c.key), columnOrder: COLS.map(c => c.key), density: 'Comfortable',
};
const cloneConfig = (config: SavedViewConfig): SavedViewConfig => ({
  ...config, filters: Object.fromEntries(Object.entries(config.filters).map(([key, values]) => [key, [...values]])),
  visibleCols: [...config.visibleCols], columnOrder: [...config.columnOrder],
});
const FILTER_FIELDS: [string, string[]][] = [
  ['Status', ['Active', 'Paused', 'Draft', 'Completed', 'Archived']],
  ['Creator', ['Laura Chen', 'Marcus Reed', 'Priya Nair', 'Owen Blake', 'Elena Torres']],
  ['Created date', ['Last 7 days', 'Last 30 days', 'Last 90 days', 'Older than 90 days']],
  ['Sequence state', ['Activated', 'Off', 'Archived']],
  ['Performance', ['Strong (≥ 8% reply)', 'Standard (< 8% reply)']],
  ['Reply rate', ['High (≥ 8%)', 'Moderate (3–7.9%)', 'Low (< 3%)', 'No deliveries']],
  ['Bounce rate', ['Healthy (< 1.2%)', 'Elevated (≥ 1.2%)']],
];
const templates = ['Blank playbook', 'Outbound prospecting', 'Follow-up', 'Event outreach', 'Re-engagement'];
const num = (value: number) => value.toLocaleString('en-US');

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange} className={`op-toggle ${checked ? 'is-on' : ''}`}><span className="op-toggle-mark">{checked ? <Check size={11} /> : <X size={10} />}</span><span className="op-toggle-thumb" /></button>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const first = focusable()?.[0];
    (first ?? dialogRef.current)?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = Array.from(focusable() ?? []);
      if (!items.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const firstItem = items[0], lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('keydown', keyboard);
      if (previousFocus?.isConnected) previousFocus.focus();
      else document.querySelector<HTMLElement>('.op-view-trigger')?.focus();
    };
  }, []);
  return <div className="op-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className={`op-modal ${wide ? 'op-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="op-dialog-title"><div className="op-modal-head"><h2 id="op-dialog-title">{title}</h2><button className="op-icon-btn" aria-label="Close dialog" onClick={onClose}><X size={16} /></button></div>{children}</section></div>;
}

function SkeletonTable() {
  return <div className="op-skeleton-wrap" aria-label="Loading playbooks"><div className="op-skeleton-head" />{Array.from({ length: 5 }, (_, i) => <div className="op-skeleton-row" key={i}><span /><span /><span /><span /><span /><span /></div>)}</div>;
}

export function Operational() {
  const [rows, setRows] = useState<Playbook[]>(INITIAL);
  const [activeIds, setActiveIds] = useState<number[]>(INITIAL.filter(r => r.status === 'Active').map(r => r.id));
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'analytics' | 'diagnostics'>('all');
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const [sortField, setSortField] = useState('Created date');
  const [sortDirection, setSortDirection] = useState<'Descending' | 'Ascending'>('Descending');
  const [openMenu, setOpenMenu] = useState('');
  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;
  const [density, setDensity] = useState<'Compact' | 'Comfortable' | 'Spacious'>('Comfortable');
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(COLS.map(c => c.key));
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(COLS.map(c => c.key));
  const [savedViews, setSavedViews] = useState<SavedView[]>([
    { id: 'preset-active', name: 'Active Campaigns', visibility: 'Team', preset: 'active', config: cloneConfig(DEFAULT_CONFIG) },
    { id: 'preset-replies', name: 'High Reply Rate', visibility: 'Private', preset: 'replies', config: cloneConfig(DEFAULT_CONFIG) },
    { id: 'preset-attention', name: 'Needs Attention', visibility: 'Team', preset: 'attention', config: cloneConfig(DEFAULT_CONFIG) },
    { id: 'preset-recent', name: 'Recently Created', visibility: 'Private', preset: 'recent', config: cloneConfig(DEFAULT_CONFIG) },
  ]);
  const [currentViewId, setCurrentViewId] = useState('all');
  const [renameViewId, setRenameViewId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'create' | 'saveView' | 'renameView' | 'confirm' | ''>('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTemplate, setFormTemplate] = useState(templates[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewVisibility, setViewVisibility] = useState<'Private' | 'Team'>('Private');
  const [pending, setPending] = useState<{ action: string; ids: number[] } | null>(null);
  const [notice, setNotice] = useState('');
  const [analyticsTargetId, setAnalyticsTargetId] = useState<number | null>(null);
  const [rowMenuPosition, setRowMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const tableCheck = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') { setOpenMenu(''); setRowMenuPosition(null); setFiltersOpen(false); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const menu = (event.target as HTMLElement).closest('[role="menu"]');
        if (menu) {
          const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"], button:not([disabled]), input:not([disabled])'));
          const index = items.indexOf(document.activeElement as HTMLElement);
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          const nextIndex = index < 0 ? 0 : (index + offset + items.length) % items.length;
          items[nextIndex]?.focus();
          event.preventDefault();
        }
      }
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('.op-pop-wrap, .op-row-actions, .op-row-menu, .op-saved-submenu, .op-filter-panel')) {
        setOpenMenu('');
        setRowMenuPosition(null);
        if (!event.target.closest('.op-filter-trigger')) setFiltersOpen(false);
      }
    };
    const closeRowMenuOnScroll = () => {
      if (openMenuRef.current.startsWith('row:')) { setOpenMenu(''); setRowMenuPosition(null); }
    };
    window.addEventListener('keydown', keyboard);
    window.addEventListener('scroll', closeRowMenuOnScroll, true);
    document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', keyboard); window.removeEventListener('scroll', closeRowMenuOnScroll, true); document.removeEventListener('pointerdown', outside); };
  }, []);
  useEffect(() => {
    if (tableCheck.current) {
      const selectedVisible = visibleRows.filter(row => selected.includes(row.id)).length;
      tableCheck.current.indeterminate = selectedVisible > 0 && selectedVisible < visibleRows.length;
    }
  });

  const activeFilters = Object.entries(filterValues).flatMap(([field, values]) => values.map(value => ({ field, value })));
  const filtered = useMemo(() => {
    let result = rows.filter(row => {
      const isActive = activeIds.includes(row.id);
      const status: Status = row.status === 'Draft' || row.status === 'Completed' || row.status === 'Archived' ? row.status : isActive ? 'Active' : 'Paused';
      if (row.status === 'Archived' && !(filterValues.Status ?? []).includes('Archived') && !(filterValues['Sequence state'] ?? []).includes('Archived')) return false;
      const textMatch = `${row.name} ${row.creator.name} ${status}`.toLowerCase().includes(query.toLowerCase());
      if (!textMatch) return false;
      for (const [field, values] of Object.entries(filterValues)) {
        if (!values.length) continue;
        const replyRate = row.delivered ? row.replies / row.delivered * 100 : null;
        const bounceRate = row.delivered ? row.bounced / row.delivered * 100 : 0;
        const createdDaysAgo = (Date.now() - new Date(`${row.createdAt}T00:00:00`).getTime()) / 86_400_000;
        const val = field === 'Status' ? status
          : field === 'Creator' ? row.creator.name
          : field === 'Performance' ? (replyRate !== null && replyRate >= 8 ? 'Strong (≥ 8% reply)' : 'Standard (< 8% reply)')
          : field === 'Reply rate' ? replyRate === null ? 'No deliveries' : replyRate >= 8 ? 'High (≥ 8%)' : replyRate >= 3 ? 'Moderate (3–7.9%)' : 'Low (< 3%)'
          : field === 'Bounce rate' ? (bounceRate >= 1.2 ? 'Elevated (≥ 1.2%)' : 'Healthy (< 1.2%)')
          : field === 'Created date' ? createdDaysAgo <= 7 ? 'Last 7 days' : createdDaysAgo <= 30 ? 'Last 30 days' : createdDaysAgo <= 90 ? 'Last 90 days' : 'Older than 90 days'
          : field === 'Sequence state' ? row.status === 'Archived' ? 'Archived' : isActive ? 'Activated' : 'Off'
          : isActive ? 'Activated' : 'Off';
        const matches = field === 'Created date'
          ? values.some(value => value === 'Last 7 days' ? createdDaysAgo <= 7 : value === 'Last 30 days' ? createdDaysAgo <= 30 : value === 'Last 90 days' ? createdDaysAgo <= 90 : createdDaysAgo > 90)
          : values.includes(val);
        if (!matches) return false;
      }
      return true;
    });
    const saved = savedViews.find(v => v.id === currentViewId);
    if (saved?.preset === 'active') result = result.filter(r => activeIds.includes(r.id));
    if (saved?.preset === 'replies') result = result.filter(r => r.delivered > 0 && r.replies / r.delivered >= .08);
    if (saved?.preset === 'attention') result = result.filter(r => r.bounced >= 7 || r.spam > 1);
    if (saved?.preset === 'recent') result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    const fields: Record<string, (r: Playbook) => string | number> = {
      Name: r => r.name, 'Created date': r => r.createdAt, 'Active contacts': r => r.active, Delivered: r => r.delivered,
      Replies: r => r.replies, 'Bounce rate': r => r.bounced / Math.max(r.delivered, 1),
      Performance: r => r.replies / Math.max(r.delivered, 1),
    };
    const get = fields[sortField];
    if (get) result = [...result].sort((a, b) => {
      const av = get(a), bv = get(b);
      const compare = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDirection === 'Ascending' ? compare : -compare;
    });
    return result;
  }, [rows, activeIds, query, filterValues, currentViewId, savedViews, sortField, sortDirection]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageStart = filtered.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, filtered.length);
  useEffect(() => { setPage(1); }, [query, filterValues, currentViewId, sortField, sortDirection, pageSize]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const activeCount = activeIds.length;
  const analyticsRows = analyticsTargetId === null ? rows : rows.filter(row => row.id === analyticsTargetId);
  const analyticsTarget = analyticsTargetId === null ? null : rows.find(row => row.id === analyticsTargetId) ?? null;
  const analyticsActiveCount = analyticsRows.filter(row => activeIds.includes(row.id)).length;
  const totalDelivered = analyticsRows.reduce((a, r) => a + r.delivered, 0);
  const totalReplies = analyticsRows.reduce((a, r) => a + r.replies, 0);
  const replyRate = ((totalReplies / Math.max(totalDelivered, 1)) * 100).toFixed(1);
  const analyticsRanked = analyticsTarget ? analyticsRows : [...analyticsRows].filter(r => r.delivered).sort((a, b) => b.replies / b.delivered - a.replies / a.delivered).slice(0, 7);
  const analyticsLeader = [...analyticsRows].filter(r => r.delivered).sort((a, b) => b.replies / b.delivered - a.replies / a.delivered)[0];
  const analyticsBounceCount = analyticsRows.filter(r => r.bounced >= 7).length;
  const orderedColumns = columnOrder.map(key => COLS.find(c => c.key === key)).filter((c): c is Column => !!c && visibleCols.includes(c.key));
  const optionColumns = columnOrder.map(key => COLS.find(c => c.key === key)).filter((c): c is Column => !!c && !['select', 'activate', 'name', 'actions'].includes(c.key));
  const currentView = currentViewId === 'all' ? 'All Playbooks' : savedViews.find(view => view.id === currentViewId)?.name ?? 'All Playbooks';
  const openRow = openMenu.startsWith('row:') ? rows.find(row => String(row.id) === openMenu.slice(4)) : undefined;
  const showRowMenu = (event: { currentTarget: HTMLButtonElement }, row: Playbook) => {
    const key = `row:${row.id}`;
    if (openMenu === key) { setOpenMenu(''); setRowMenuPosition(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    setRowMenuPosition({
      x: Math.max(12, Math.min(rect.right - 208, window.innerWidth - 220)),
      y: rect.bottom + 6 + 250 > window.innerHeight ? Math.max(12, rect.top - 252) : rect.bottom + 6,
    });
    setOpenMenu(key);
    window.requestAnimationFrame(() => document.getElementById(`row-menu-${row.id}`)?.focus());
  };
  const openMenuFromKeyboard = (event: { key: string; preventDefault: () => void }, menu: string, selector: string) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpenMenu(menu);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
  };

  const toggleActive = (id: number) => {
    const row = rows.find(item => item.id === id);
    if (!row || row.status === 'Completed' || row.status === 'Archived') return;
    const wasActive = activeIds.includes(id);
    setActiveIds(old => wasActive ? old.filter(i => i !== id) : [...old, id]);
    setRows(old => old.map(item => item.id === id ? { ...item, status: wasActive ? 'Paused' : 'Active' } : item));
  };
  const toggleSelect = (id: number) => setSelected(old => old.includes(id) ? old.filter(i => i !== id) : [...old, id]);
  const toggleFilter = (field: string, value: string) => setFilterValues(old => {
    const values = old[field] ?? [];
    const next = values.includes(value) ? values.filter(v => v !== value) : [...values, value];
    return { ...old, [field]: next };
  });
  const removeFilter = (field: string, value: string) => setFilterValues(old => ({ ...old, [field]: (old[field] ?? []).filter(v => v !== value) }));
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600); };
  const openConfirm = (action: string, ids: number[]) => { setPending({ action, ids }); setDialog('confirm'); setOpenMenu(''); };
  const perform = (action: string, ids: number[]) => {
    if (action === 'Delete') {
      setRows(old => old.filter(r => !ids.includes(r.id)));
      setActiveIds(old => old.filter(id => !ids.includes(id)));
      setSelected(old => old.filter(id => !ids.includes(id)));
      if (analyticsTargetId !== null && ids.includes(analyticsTargetId)) { setAnalyticsTargetId(null); setTab('all'); }
    }
    if (action === 'Archive') {
      setRows(old => old.map(r => ids.includes(r.id) ? { ...r, status: 'Archived' } : r));
      setActiveIds(old => old.filter(id => !ids.includes(id)));
    }
    if (action === 'Pause') {
      setRows(old => old.map(r => ids.includes(r.id) && r.status !== 'Draft' && r.status !== 'Completed' && r.status !== 'Archived' ? { ...r, status: 'Paused' } : r));
      setActiveIds(old => old.filter(id => !ids.includes(id)));
    }
    if (action === 'Activate') {
      const eligible = rows.filter(r => ids.includes(r.id) && r.status !== 'Completed' && r.status !== 'Archived').map(r => r.id);
      setRows(old => old.map(r => eligible.includes(r.id) ? { ...r, status: 'Active' } : r));
      setActiveIds(old => [...new Set([...old, ...eligible])]);
    }
    if (action === 'Duplicate') {
      const copies = rows.filter(r => ids.includes(r.id)).map((r, i) => ({
        ...r, id: Date.now() + i, name: `${r.name} copy`, status: 'Draft' as Status,
        creator: PEOPLE[0], createdAt: new Date().toISOString().slice(0, 10),
        active: 0, paused: 0, notSent: 0, bounced: 0, spam: 0, finished: 0, scheduled: 0, delivered: 0, replies: 0, optimization: '—',
      }));
      setRows(old => [...copies, ...old]);
    }
    if (action !== 'Delete') setSelected(old => old.filter(id => !ids.includes(id)));
    setDialog('');
    setPending(null);
    notify(`${ids.length === 1 ? 'Playbook' : `${ids.length} playbooks`} ${action === 'Pause' ? 'paused' : action === 'Delete' ? 'deleted' : `${action.toLowerCase()}d`} in this demo.`);
  };
  const runRowAction = (action: string, row: Playbook) => {
    setOpenMenu('');
    setRowMenuPosition(null);
    if (action === 'Edit') { setEditingId(row.id); setFormName(row.name); setFormDescription(row.description); setFormTemplate('Blank playbook'); setDialog('create'); return; }
    if (action === 'Analytics') { setAnalyticsTargetId(row.id); setTab('analytics'); notify(`Showing sample analytics for ${row.name}.`); return; }
    if (action === 'Pause') { perform(activeIds.includes(row.id) ? 'Pause' : 'Activate', [row.id]); return; }
    if (action === 'Duplicate') { perform('Duplicate', [row.id]); return; }
    openConfirm(action, [row.id]);
  };
  const createPlaybook = () => {
    const name = formName.trim();
    if (!name) return;
    if (editingId !== null) {
      setRows(old => old.map(r => r.id === editingId ? { ...r, name, description: formDescription.trim() } : r));
      setEditingId(null); setFormName(''); setFormDescription(''); setDialog(''); notify('Playbook details updated in the local demo.'); return;
    }
    const row: Playbook = { id: Date.now(), name, description: formDescription.trim(), status: 'Draft', creator: PEOPLE[0], createdAt: new Date().toISOString().slice(0, 10), active: 0, paused: 0, notSent: 0, bounced: 0, spam: 0, finished: 0, scheduled: 0, delivered: 0, replies: 0, optimization: '—' };
    setRows(old => [row, ...old]); setFormName(''); setFormDescription(''); setFormTemplate(templates[0]); setDialog(''); setTab('all'); selectView('all'); notify('Playbook created as a local draft.');
  };
  const snapshotView = (): SavedViewConfig => ({
    query, filters: Object.fromEntries(Object.entries(filterValues).map(([key, values]) => [key, [...values]])),
    sortField, sortDirection, visibleCols: [...visibleCols], columnOrder: [...columnOrder], density,
  });
  const saveView = () => {
    if (!formName.trim()) return;
    const item: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: formName.trim(), visibility: viewVisibility,
      preset: savedViews.find(view => view.id === currentViewId)?.preset, config: snapshotView(),
    };
    setSavedViews(old => [...old, item]); setCurrentViewId(item.id); setFormName(''); setDialog(''); notify(`${item.visibility} view label saved locally; it is not shared.`);
  };
  const resetViewOptions = () => { setVisibleCols([...DEFAULT_CONFIG.visibleCols]); setColumnOrder([...DEFAULT_CONFIG.columnOrder]); setDensity('Comfortable'); };
  const selectView = (id: string) => {
    if (id === 'all') {
      setCurrentViewId('all'); setQuery(''); setFilterValues({}); setSortField(DEFAULT_CONFIG.sortField);
      setSortDirection(DEFAULT_CONFIG.sortDirection); setVisibleCols([...DEFAULT_CONFIG.visibleCols]);
      setColumnOrder([...DEFAULT_CONFIG.columnOrder]); setDensity('Comfortable');
    } else {
      const view = savedViews.find(item => item.id === id);
      if (!view) return;
      const config = cloneConfig(view.config);
      setCurrentViewId(view.id); setQuery(config.query); setFilterValues(config.filters); setSortField(config.sortField);
      setSortDirection(config.sortDirection); setVisibleCols(config.visibleCols); setColumnOrder(config.columnOrder); setDensity(config.density);
    }
    setFiltersOpen(false); setSelected([]); setPage(1); setOpenMenu('');
  };

  return (
    <main className="playbooks-operational op-shell">
      <header className="op-header">
        <div className="op-heading"><div className="op-brandline"><span className="op-brandmark">whyhello</span></div><div className="op-title-line"><h1>Playbooks</h1><span className="op-demo-badge"><span />Demo workspace</span></div><p>Build and manage insight-led, multi-touch outreach.</p></div>
        <div className="op-header-actions"><button className="op-secondary-btn" onClick={() => { setEditingId(null); setFormTemplate('Outbound prospecting'); setFormName(''); setFormDescription(''); setDialog('create'); }}><BookOpen size={15} /> Templates</button><button className="op-primary-btn" onClick={() => { setEditingId(null); setFormName(''); setFormDescription(''); setFormTemplate(templates[0]); setDialog('create'); }}><Plus size={16} /> Create playbook</button></div>
      </header>
      <nav className="op-tabs" aria-label="Playbook sections">
        {[['all', 'All Playbooks', ClipboardList], ['analytics', 'Analytics', BarChart3], ['diagnostics', 'Diagnostics', ShieldAlert]].map(([id, label, Icon]) => <button key={id as string} className={`op-tab ${tab === id ? 'selected' : ''}`} onClick={() => { if (id === 'analytics') setAnalyticsTargetId(null); setTab(id as 'all' | 'analytics' | 'diagnostics'); }}><Icon size={15} />{label as string}{id === 'all' && <span className="op-tab-count">{rows.filter(row => row.status !== 'Archived').length}</span>}</button>)}
        <div className="op-demo-note"><Info size={13} /> Demo data only · no email is sent or live records changed</div>
      </nav>
      {(showInfo || showWarning) && <section className="op-banners">
        {showInfo && <div className="op-banner op-banner-info"><Info size={17} /><div><strong>Playbook health checks are available</strong><span>Review delivery and reply patterns in Diagnostics. All figures here are illustrative workspace data.</span></div><button aria-label="Dismiss information" onClick={() => setShowInfo(false)}><X size={15} /></button></div>}
        {showWarning && <div className="op-banner op-banner-warn"><AlertTriangle size={17} /><span><strong>No mailbox is linked in this demo.</strong> Sending and mailbox setup are not available here.</span><button className="op-text-link" onClick={() => setTab('diagnostics')}>View diagnostics <ChevronRight size={14} /></button><button aria-label="Dismiss mailbox notice" onClick={() => setShowWarning(false)}><X size={15} /></button></div>}
      </section>}
      {tab === 'all' && <>
        <section className="op-toolbar">
          {loading ? <div className="op-loading-toolbar" aria-label="Loading table controls"><div><span className="skeleton-view" /><span className="skeleton-filter" /><span className="skeleton-search" /></div><div><span className="skeleton-save" /><span className="skeleton-sort" /><span className="skeleton-options" /></div><div className="op-loading-metrics"><span /><span /><span /><span /></div></div> : selected.length > 0 ? <div className="op-bulkbar"><span className="op-selected-count"><CheckCheck size={15} />{selected.length} selected</span><button onClick={() => perform('Pause', selected)}>Pause</button><button onClick={() => perform('Activate', selected)}>Activate</button><button onClick={() => perform('Duplicate', selected)}>Duplicate</button><button onClick={() => openConfirm('Archive', selected)}>Archive</button><button className="op-danger-action" onClick={() => openConfirm('Delete', selected)}><Trash2 size={14} />Delete</button><button className="op-clear-selection" onClick={() => setSelected([])}>Clear selection <X size={13} /></button></div> : <div className="op-toolbar-main">
            <div className="op-toolbar-left">
              <div className="op-pop-wrap"><button className={`op-control-btn op-view-trigger ${openMenu === 'views' || openMenu.startsWith('saved:') ? 'open' : ''}`} onClick={() => setOpenMenu(openMenu === 'views' || openMenu.startsWith('saved:') ? '' : 'views')} onKeyDown={event => openMenuFromKeyboard(event, 'views', '.op-view-menu [role="menuitem"]')} aria-haspopup="menu" aria-expanded={openMenu === 'views' || openMenu.startsWith('saved:')} aria-label={`Saved views. Current view: ${currentView}`}><ClipboardList size={15} /><span>{currentView}</span><ChevronDown size={14} /></button>{(openMenu === 'views' || openMenu.startsWith('saved:')) && <div className="op-popover op-view-menu" role="menu" aria-label="Playbook views"><div className="op-popover-label">DEFAULT</div><button role="menuitem" onClick={() => selectView('all')}><span>All Playbooks</span>{currentViewId === 'all' && <Check size={14} />}</button><div className="op-popover-label op-mine-label">MY VIEWS <button aria-label="Save current filters as a view" onClick={() => { setFormName(''); setDialog('saveView'); setOpenMenu(''); }}><Plus size={13} /></button></div>{savedViews.length === 0 && <div className="op-empty-views">No saved views yet. Save this list setup to find it here.</div>}{savedViews.map(view => <div className="op-view-item" key={view.id}><button role="menuitem" className="op-view-select" onClick={() => selectView(view.id)}><span>{view.name}<small>{view.visibility} · demo label only</small></span>{currentViewId === view.id && <Check size={14} />}</button><button className="op-row-menu-trigger" aria-label={`Manage ${view.name}`} aria-haspopup="menu" aria-expanded={openMenu === `saved:${view.id}`} onClick={() => setOpenMenu(openMenu === `saved:${view.id}` ? 'views' : `saved:${view.id}`)}><MoreHorizontal size={15} /></button>{openMenu === `saved:${view.id}` && <div className="op-saved-submenu" role="menu" aria-label={`Manage ${view.name}`}><button role="menuitem" onClick={() => { setFormName(view.name); setRenameViewId(view.id); setDialog('renameView'); setOpenMenu(''); }}>Rename</button><button role="menuitem" onClick={() => { const copy = { ...view, id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: `${view.name} copy`, config: cloneConfig(view.config) }; setSavedViews(old => [...old, copy]); setOpenMenu('views'); notify('View duplicated with its own filters and columns.'); }}>Duplicate</button><button role="menuitem" className="danger" onClick={() => { setSavedViews(old => old.filter(v => v.id !== view.id)); if (currentViewId === view.id) selectView('all'); setOpenMenu('views'); notify('Saved view deleted.'); }}>Delete</button></div>}</div>)}<div className="op-view-footer"><span>Private/team labels are local only</span><button onClick={() => { setFormName(''); setDialog('saveView'); setOpenMenu(''); }}>Save as new view</button></div></div>}</div>
              <button className={`op-control-btn op-filter-trigger ${filtersOpen ? 'open' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-haspopup="true" aria-label={`Filters${activeFilters.length ? `, ${activeFilters.length} active` : ''}`}><Filter size={15} />Filters{activeFilters.length > 0 && <span className="op-filter-count">{activeFilters.length}</span>}<ChevronDown size={13} /></button>
              <label className="op-search"><Search size={15} /><input ref={searchRef} aria-label="Search playbooks" placeholder="Search playbooks…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}<kbd>⌘ K</kbd></label>
            </div>
            <div className="op-toolbar-right"><button className="op-save-view-btn" onClick={() => { setFormName(''); setDialog('saveView'); }}>Save as new view</button><span className="op-toolbar-divider" />
              <div className="op-pop-wrap"><button className="op-control-btn" onClick={() => setOpenMenu(openMenu === 'sort' ? '' : 'sort')} onKeyDown={event => openMenuFromKeyboard(event, 'sort', '.op-sort-menu [role="menuitem"]')} aria-haspopup="menu" aria-expanded={openMenu === 'sort'} aria-label={`Sort playbooks, currently ${sortField} ${sortDirection.toLowerCase()}`}><ArrowDownUp size={15} />Sort <span className="op-sort-current">{sortField}</span><ChevronDown size={13} /></button>{openMenu === 'sort' && <div className="op-popover op-sort-menu" role="menu" aria-label="Sort playbooks"><div className="op-popover-label">SORT BY</div>{['Name', 'Created date', 'Active contacts', 'Delivered', 'Replies', 'Bounce rate', 'Performance'].map(field => <button role="menuitem" key={field} className={sortField === field ? 'chosen' : ''} onClick={() => { setSortField(field); setOpenMenu(''); }}><span>{field}</span>{sortField === field && <Check size={14} />}</button>)}<div className="op-sort-direction"><button aria-pressed={sortDirection === 'Ascending'} className={sortDirection === 'Ascending' ? 'chosen' : ''} onClick={() => setSortDirection('Ascending')}><ArrowUp size={14} />Ascending</button><button aria-pressed={sortDirection === 'Descending'} className={sortDirection === 'Descending' ? 'chosen' : ''} onClick={() => setSortDirection('Descending')}><ArrowDown size={14} />Descending</button></div></div>}</div>
              <div className="op-pop-wrap"><button className="op-control-btn" onClick={() => setOpenMenu(openMenu === 'options' ? '' : 'options')} onKeyDown={event => openMenuFromKeyboard(event, 'options', '.op-options-menu input:not([disabled])')} aria-haspopup="menu" aria-expanded={openMenu === 'options'} aria-label="View options"><Settings2 size={15} />View options<ChevronDown size={13} /></button>{openMenu === 'options' && <div className="op-popover op-options-menu" role="menu" aria-label="Table view options"><div className="op-popover-label">COLUMNS</div>{optionColumns.map((col, i, arr) => <div className="op-column-option" key={col.key}><label><input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => setVisibleCols(old => old.includes(col.key) ? old.filter(k => k !== col.key) : [...old, col.key])} />{col.label}</label><div className="op-reorder"><button className="op-reorder-left" aria-label={`Move ${col.label} left`} disabled={i === 0} onClick={() => { const next = [...columnOrder]; const idx = next.indexOf(col.key); [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setColumnOrder(next); }}>‹</button><button className="op-reorder-right" aria-label={`Move ${col.label} right`} disabled={i === arr.length - 1} onClick={() => { const next = [...columnOrder]; const idx = next.indexOf(col.key); [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]; setColumnOrder(next); }}>›</button></div></div>)}<div className="op-popover-label op-density-label">ROW DENSITY</div><div className="op-density">{(['Compact', 'Comfortable', 'Spacious'] as const).map(d => <button key={d} aria-pressed={density === d} className={density === d ? 'chosen' : ''} onClick={() => setDensity(d)}>{d}</button>)}</div><button className="op-reset" onClick={resetViewOptions}><RotateCcw size={13} />Reset to defaults</button></div>}</div>
              <div className="op-pop-wrap op-overflow-wrap"><button className="op-icon-btn op-overflow-trigger" aria-label="More table controls" aria-haspopup="menu" aria-expanded={openMenu === 'overflow'} onClick={() => setOpenMenu(openMenu === 'overflow' ? '' : 'overflow')} onKeyDown={event => openMenuFromKeyboard(event, 'overflow', '.op-overflow-menu button')}><MoreHorizontal size={18} /></button>{openMenu === 'overflow' && <div className="op-popover op-overflow-menu" role="menu" aria-label="More table controls"><button role="menuitem" onClick={() => { setFiltersOpen(!filtersOpen); setOpenMenu(''); }}><Filter size={14} />Filters</button><button role="menuitem" onClick={() => { setFormName(''); setDialog('saveView'); setOpenMenu(''); }}><Plus size={14} />Save as new view</button><button role="menuitem" onClick={() => setOpenMenu('sort')}><ArrowDownUp size={14} />Sort</button><button role="menuitem" onClick={() => setOpenMenu('options')}><Settings2 size={14} />View options</button></div>}</div>
            </div>
          </div>}
          {filtersOpen && selected.length === 0 && <div className="op-filter-panel" role="group" aria-label="Filter playbooks">{FILTER_FIELDS.map(([field, options]) => <fieldset key={field}><legend>{field}</legend>{options.map(option => <label key={option}><input type="checkbox" checked={(filterValues[field] ?? []).includes(option)} onChange={() => toggleFilter(field, option)} />{option}</label>)}</fieldset>)}<button className="op-clear-filters" onClick={() => setFilterValues({})}>Clear all filters</button></div>}
          {activeFilters.length > 0 && selected.length === 0 && <div className="op-filter-chips">{activeFilters.map(({ field, value }) => <button key={`${field}-${value}`} onClick={() => removeFilter(field, value)}>{field}: <b>{value}</b><X size={12} /></button>)}<button className="op-clear-all" onClick={() => setFilterValues({})}>Clear all</button></div>}
        </section>
        <section className="op-table-area" aria-label="Playbook list">
          {loading ? <SkeletonTable /> : <div className="op-table-scroll"><table className={`op-table density-${density.toLowerCase()}`}><colgroup>{orderedColumns.map(c => <col key={c.key} style={{ width: c.width }} />)}</colgroup><thead><tr>{orderedColumns.map(col => <th key={col.key} className={`${col.metric ? 'metric-head' : ''} op-col-${col.key}`} scope="col">{col.key === 'select' ? <input ref={tableCheck} type="checkbox" aria-label="Select all visible playbooks" checked={visibleRows.length > 0 && visibleRows.every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? Array.from(new Set([...selected, ...visibleRows.map(r => r.id)])) : selected.filter(id => !visibleRows.some(r => r.id === id)))} /> : col.key === 'activate' ? <span>ACTIVATE</span> : col.key === 'actions' ? null : <span title={col.label}>{col.label.toUpperCase()}</span>}</th>)}</tr></thead>
            <tbody>{visibleRows.map(row => <tr key={row.id} className={selected.includes(row.id) ? 'row-selected' : ''}>
              {orderedColumns.map(col => <td key={col.key} className={`${col.metric ? 'metric-cell' : ''} ${col.key === 'name' ? 'name-cell' : ''} op-col-${col.key}`}>
                {col.key === 'select' && <input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} />}
                {col.key === 'activate' && <div className="op-activate-cell"><Toggle checked={activeIds.includes(row.id)} label={`Activate ${row.name}`} disabled={row.status === 'Completed' || row.status === 'Archived'} onChange={() => toggleActive(row.id)} /><span className={`op-status status-${row.status.toLowerCase()}`}>{activeIds.includes(row.id) ? 'On' : row.status === 'Active' ? 'Off' : row.status}</span></div>}
                {col.key === 'name' && <div className="op-name-wrap"><button className="op-name" onClick={() => { setEditingId(row.id); setFormName(row.name); setFormDescription(row.description); setDialog('create'); }}>{row.name}</button><span className="op-row-description">{row.description}</span></div>}
                {col.key === 'optimization' && <span className={row.optimization === '—' ? 'op-muted' : 'op-optimization'}>{row.optimization === '—' ? '—' : <><Zap size={12} />{row.optimization}</>}</span>}
                {col.key === 'creator' && <span className="op-creator" title={`Created by ${row.creator.name}`}><span className="op-avatar">{row.creator.initials}</span>{row.creator.name}</span>}
                {(['active', 'paused', 'notSent', 'bounced', 'spam', 'finished', 'scheduled', 'delivered', 'replies'] as const).includes(col.key as 'active' | 'paused' | 'notSent' | 'bounced' | 'spam' | 'finished' | 'scheduled' | 'delivered' | 'replies') && <span className={['bounced', 'spam'].includes(col.key as string) && Number(row[col.key as 'bounced' | 'spam']) > 5 ? 'op-metric-warning' : ''}>{num(Number(row[col.key as 'active' | 'paused' | 'notSent' | 'bounced' | 'spam' | 'finished' | 'scheduled' | 'delivered' | 'replies']))}</span>}
                {col.key === 'actions' && <div className="op-row-actions"><button className="op-row-menu-trigger" aria-label={`Actions for ${row.name}`} aria-haspopup="menu" aria-expanded={openMenu === `row:${row.id}`} onClick={event => showRowMenu(event, row)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); showRowMenu(event, row); } }}><MoreHorizontal size={17} /></button></div>}
              </td>)}
            </tr>)}</tbody></table>
            {!visibleRows.length && <div className="op-empty"><div className="op-empty-icon">{rows.length === 0 ? <BookOpen size={19} /> : <Search size={19} />}</div><strong>{rows.length === 0 ? 'No playbooks yet' : query ? 'No playbooks match your search.' : 'No playbooks match these filters.'}</strong><span>{rows.length === 0 ? 'Create a playbook to organize your insight-led outreach.' : 'Try changing your search or filters.'}</span>{rows.length === 0 && <button className="op-primary-btn" onClick={() => setDialog('create')}><Plus size={15} />Create playbook</button>}{(query || activeFilters.length > 0) && <button className="op-clear-filters" onClick={() => { setQuery(''); setFilterValues({}); }}>Clear search and filters</button>}</div>}
          </div>}
           <div className="op-table-foot"><span>Showing <b>{pageStart}–{pageEnd}</b> of <b>{filtered.length}</b> playbooks</span><div><button disabled={page <= 1} aria-label="Previous page" onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={15} /></button><span className="op-page-current" aria-live="polite">{page} / {pageCount}</span><button disabled={page >= pageCount} aria-label="Next page" onClick={() => setPage(current => Math.min(pageCount, current + 1))}><ChevronRight size={15} /></button><span className="op-page-size">Rows per page <select aria-label="Rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></span></div></div>
        </section>
      </>}
      {tab === 'analytics' && <section className="op-tab-content">
        <div className="op-section-heading">
          <div><span className="op-eyebrow">{analyticsTarget ? 'PLAYBOOK SAMPLE · DEMO DATA' : 'WORKSPACE OVERVIEW · DEMO DATA'}</span><h2>{analyticsTarget ? `Analytics · ${analyticsTarget.name}` : 'Playbook analytics'}</h2><p>{analyticsTarget ? 'Illustrative metrics for this playbook only. No live sending data.' : 'Illustrative roll-up from local demo playbooks. No live sending data.'}</p></div>
          <div className="op-analytics-heading-actions">{analyticsTarget && <button className="op-secondary-btn" onClick={() => { setAnalyticsTargetId(null); setTab('all'); }}><ChevronLeft size={15} />Back to playbooks</button>}<span className="op-period"><Activity size={14} /> Sample period · demo records</span></div>
        </div>
        <div className="op-metric-grid">
          <article><span>Total delivered</span><strong>{num(totalDelivered)}</strong><small>{analyticsTarget ? analyticsTarget.name : 'Across demo playbooks'}</small><Mail size={17} /></article>
          <article><span>Replies received</span><strong>{num(totalReplies)}</strong><small>Recorded in sample rows</small><Activity size={17} /></article>
          <article><span>Reply rate</span><strong>{replyRate}<i>%</i></strong><small>Replies ÷ delivered</small><Gauge size={17} /></article>
          <article><span>{analyticsTarget ? 'Activation' : 'Active playbooks'}</span><strong>{analyticsTarget ? (activeIds.includes(analyticsTarget.id) ? 'On' : 'Off') : activeCount}</strong><small>{analyticsTarget ? 'Local activation state only' : 'Activation switches enabled'}</small><Zap size={17} /></article>
        </div>
        <div className="op-analytics-lower">
          <section className="op-data-panel"><div className="op-panel-title"><div><h3>{analyticsTarget ? analyticsTarget.name : 'Performance by playbook'}</h3><span>{analyticsTarget ? 'Single-record demo view' : 'Ranked by reply rate · demo sample'}</span></div><button onClick={() => { setAnalyticsTargetId(null); setTab('all'); }}>Open list <ChevronRight size={14} /></button></div>
            <div className="op-analytics-table"><div className="op-analytics-th"><span>PLAYBOOK</span><span>DELIVERED</span><span>REPLIES</span><span>REPLY RATE</span></div>
              {analyticsRanked.filter(r => r.delivered).map(r => <div className="op-analytics-tr" key={r.id}><span>{r.name}</span><span>{num(r.delivered)}</span><span>{num(r.replies)}</span><span className="op-rate">{(r.replies / r.delivered * 100).toFixed(1)}%</span></div>)}
              {!analyticsRanked.some(r => r.delivered) && <div className="op-analytics-empty">No delivered activity in this demo record.</div>}
            </div>
          </section>
          <aside className="op-insight-panel"><div className="op-panel-title"><div><h3>{analyticsTarget ? 'Record notes' : 'Readout'}</h3><span>Derived from sample rows only</span></div><Sparkles size={16} /></div>
            <div className="op-insight-item"><span className="op-insight-number">01</span><p><b>{analyticsTarget ? 'Reply rate' : 'Highest reply rate'}</b><span>{analyticsTarget ? `${replyRate}% from this playbook's sample deliveries.` : analyticsLeader ? `${analyticsLeader.name} leads this sample.` : 'No delivered activity to compare.'}</span></p></div>
            <div className="op-insight-item"><span className="op-insight-number">02</span><p><b>Delivery health</b><span>{analyticsBounceCount} {analyticsTarget ? 'sample record' : 'playbooks'} with 7+ bounces in this view.</span></p></div>
            <div className="op-demo-disclaimer"><Info size={14} />These are static demo metrics, not connected account analytics.</div>
          </aside>
        </div>
      </section>}
      {tab === 'diagnostics' && <section className="op-tab-content"><div className="op-section-heading"><div><span className="op-eyebrow">SYSTEM STATUS · DEMO WORKSPACE</span><h2>Diagnostics</h2><p>Operational checks for this prototype. Nothing here connects to a mailbox.</p></div><span className="op-period"><CircleHelp size={14} /> Local-only checks</span></div><div className="op-diagnostics-grid"><article className="op-diagnostic-card op-diag-warning"><div className="op-diag-icon"><Mail size={17} /></div><div><span className="op-diag-label">Mailbox connection</span><h3>Not connected</h3><p>A mailbox setup flow is outside this prototype. No messages can be sent.</p></div><span className="op-diag-status">Demo limitation</span></article><article className="op-diagnostic-card"><div className="op-diag-icon"><ShieldAlert size={17} /></div><div><span className="op-diag-label">Bounce guard</span><h3>Sample-only checks</h3><p>{rows.filter(r => r.bounced >= 7).length} sample playbooks have 7 or more bounced contacts.</p></div><span className="op-diag-status op-status-neutral">Illustrative</span></article><article className="op-diagnostic-card"><div className="op-diag-icon"><Zap size={17} /></div><div><span className="op-diag-label">Activation state</span><h3>{activeCount} enabled playbooks</h3><p>Activation switches only change local display state; they do not start sending.</p></div><span className="op-diag-status op-status-neutral">Local state</span></article><article className="op-diagnostic-card"><div className="op-diag-icon"><ListFilter size={17} /></div><div><span className="op-diag-label">Data source</span><h3>12 seeded demo records</h3><p>Changes made to this list live in this screen and are not synchronized.</p></div><span className="op-diag-status op-status-neutral">No network</span></article></div><div className="op-diagnostics-note"><Info size={15} /><span><b>Prototype boundary</b> — linking email, live deliverability checks, and sending policy configuration are intentionally not available.</span></div></section>}
      {openRow && rowMenuPosition && createPortal(
        <div id={`row-menu-${openRow.id}`} className="op-row-menu op-portal-menu" role="menu" aria-label={`Actions for ${openRow.name}`} style={{ left: rowMenuPosition.x, top: rowMenuPosition.y }}>
          <button role="menuitem" onClick={() => runRowAction('Edit', openRow)}><Pencil size={16} />Edit playbook</button>
          <button role="menuitem" onClick={() => runRowAction('Duplicate', openRow)}><Copy size={16} />Duplicate</button>
          <button role="menuitem" onClick={() => runRowAction('Analytics', openRow)}><BarChart3 size={16} />View analytics</button>
          <button role="menuitem" disabled={openRow.status === 'Completed' || openRow.status === 'Archived'} onClick={() => runRowAction('Pause', openRow)}><Pause size={16} />{activeIds.includes(openRow.id) ? 'Pause activation' : 'Activate'}</button>
          <div className="op-menu-separator" />
          <button role="menuitem" onClick={() => runRowAction('Archive', openRow)}><Archive size={16} />Archive</button>
          <button role="menuitem" className="danger" onClick={() => runRowAction('Delete', openRow)}><Trash2 size={16} />Delete</button>
        </div>,
        document.body,
      )}
      {notice && <div className="op-toast" role="status"><Check size={15} />{notice}</div>}
      {dialog === 'create' && <Modal title={editingId === null ? 'Create playbook' : 'Edit playbook'} onClose={() => { setDialog(''); setEditingId(null); }}><div className="op-form"><label>Playbook name <span>Required</span><input autoFocus value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Enterprise Prospecting" onKeyDown={e => { if (e.key === 'Enter') createPlaybook(); }} /></label><label>Description <span>Optional</span><textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="What outcome should this playbook support?" rows={3} /></label>{editingId === null && <><label>Starting template<select value={formTemplate} onChange={e => setFormTemplate(e.target.value)}>{templates.map(t => <option key={t}>{t}</option>)}</select></label><div className="op-template-note"><BookOpen size={15} /><span><b>{formTemplate}</b><small>{formTemplate === 'Blank playbook' ? 'Start with a clean playbook draft.' : 'Adds a suggested structure to your local draft.'} Builder workflows are not part of this prototype.</small></span></div></>}<div className="op-modal-actions"><button className="op-secondary-btn" onClick={() => { setDialog(''); setEditingId(null); }}>Cancel</button><button className="op-primary-btn" disabled={!formName.trim()} onClick={createPlaybook}>{editingId === null && <Plus size={15} />}{editingId === null ? 'Create playbook' : 'Save changes'}</button></div></div></Modal>}
      {dialog === 'saveView' && <Modal title="Save as new view" onClose={() => setDialog('')}><div className="op-form"><p className="op-modal-copy">Save the current search, filters, sorting, columns and row density in this local demo.</p><label>View name<input autoFocus value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Enterprise accounts" onKeyDown={e => { if (e.key === 'Enter') saveView(); }} /></label><fieldset className="op-visibility"><legend>Visibility label</legend>{(['Private', 'Team'] as const).map(v => <label key={v}><input type="radio" name="visibility" checked={viewVisibility === v} onChange={() => setViewVisibility(v)} /><span><b>{v}</b><small>{v === 'Private' ? 'Private label in this demo' : 'Team label only; not actually shared'}</small></span></label>)}</fieldset><div className="op-modal-actions"><button className="op-secondary-btn" onClick={() => setDialog('')}>Cancel</button><button className="op-primary-btn" disabled={!formName.trim()} onClick={saveView}>Save view</button></div></div></Modal>}
      {dialog === 'renameView' && <Modal title="Rename saved view" onClose={() => { setDialog(''); setRenameViewId(null); }}><div className="op-form"><label>View name<input autoFocus value={formName} onChange={e => setFormName(e.target.value)} /></label><div className="op-modal-actions"><button className="op-secondary-btn" onClick={() => { setDialog(''); setRenameViewId(null); }}>Cancel</button><button className="op-primary-btn" disabled={!formName.trim()} onClick={() => { if (!renameViewId) return; setSavedViews(old => old.map(v => v.id === renameViewId ? { ...v, name: formName.trim() } : v)); setDialog(''); setRenameViewId(null); notify('Saved view renamed.'); }}>Save changes</button></div></div></Modal>}
      {dialog === 'confirm' && pending && <Modal title={`Confirm ${pending.action.toLowerCase()}`} onClose={() => { setDialog(''); setPending(null); }}><div className="op-confirm"><div className="op-confirm-icon"><AlertTriangle size={18} /></div><p>{pending.action === 'Delete' ? `Delete ${pending.ids.length === 1 ? 'this playbook' : `${pending.ids.length} playbooks`}? This removes ${pending.ids.length === 1 ? 'it' : 'them'} from the local demo list.` : `Archive ${pending.ids.length === 1 ? 'this playbook' : `${pending.ids.length} playbooks`}? The records remain available in the demo list.`}</p><span>This action does not affect live workspace records.</span><div className="op-modal-actions"><button className="op-secondary-btn" onClick={() => { setDialog(''); setPending(null); }}>Cancel</button><button className={pending.action === 'Delete' ? 'op-danger-btn' : 'op-primary-btn'} onClick={() => perform(pending.action, pending.ids)}>{pending.action} {pending.ids.length > 1 ? `${pending.ids.length} playbooks` : 'playbook'}</button></div></div></Modal>}
    </main>
  );
}