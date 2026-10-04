export interface PlaybookRecord {
  id: number;
  name: string;
  description: string | null;
  status: string;
  stepCount: number;
  enrollmentCount: number;
  dueCount: number;
  pausedCount?: number;
  finishedCount?: number;
  sentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type ColumnKey = "select" | "activate" | "name" | "optimization" | "creator" |
  "active" | "paused" | "notSent" | "bounced" | "spam" | "finished" | "scheduled" |
  "delivered" | "replies" | "actions";
export const COLUMNS: { key: ColumnKey; label: string; width: number; metric?: boolean }[] = [
  { key: "select", label: "", width: 46 }, { key: "activate", label: "Activate", width: 120 },
  { key: "name", label: "Name", width: 270 }, { key: "optimization", label: "Optimizations", width: 140 },
  { key: "creator", label: "Created by", width: 155 }, { key: "active", label: "Active", width: 110, metric: true },
  { key: "paused", label: "Paused", width: 110, metric: true }, { key: "notSent", label: "Not sent", width: 110, metric: true },
  { key: "bounced", label: "Bounced", width: 110, metric: true }, { key: "spam", label: "Spam blocked", width: 118, metric: true },
  { key: "finished", label: "Finished", width: 110, metric: true }, { key: "scheduled", label: "Scheduled", width: 110, metric: true },
  { key: "delivered", label: "Delivered", width: 110, metric: true }, { key: "replies", label: "Replies", width: 110, metric: true },
  { key: "actions", label: "", width: 64 },
];
export const PINNED = ["select", "activate", "name", "actions"] as const;
export const SORT_FIELDS = ["Created date", "Name", "Updated date", "Active contacts", "Finished", "Sent"] as const;
export type SortField = typeof SORT_FIELDS[number];
export interface ViewConfig {
  query: string;
  statuses: string[];
  creators: string[];
  dateRange: string[];
  sort: SortField;
  direction: "Ascending" | "Descending";
  columns: ColumnKey[];
  order: ColumnKey[];
  density: "Compact" | "Comfortable" | "Spacious";
}
export const DEFAULT_VIEW: ViewConfig = {
  query: "", statuses: [], creators: [], dateRange: [], sort: "Created date", direction: "Descending",
  columns: COLUMNS.map(c => c.key), order: COLUMNS.map(c => c.key), density: "Comfortable",
};
export function copyConfig(value: ViewConfig): ViewConfig {
  return { ...value, statuses: [...value.statuses], creators: [...value.creators], dateRange: [...value.dateRange], columns: [...value.columns], order: [...value.order] };
}
export function validateConfig(value: unknown): ViewConfig {
  const candidate = value && typeof value === "object" ? value as Partial<ViewConfig> : {};
  const strings = (items: unknown): string[] => Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [];
  const known = COLUMNS.map(c => c.key);
  const order = strings(candidate.order).filter((key): key is ColumnKey => known.includes(key as ColumnKey) && !PINNED.includes(key as typeof PINNED[number]));
  const middle = [...new Set([...order, ...known.filter(key => !PINNED.includes(key as typeof PINNED[number]))])];
  return {
    query: typeof candidate.query === "string" ? candidate.query : "",
    statuses: strings(candidate.statuses).filter(status => ["active", "paused", "draft", "completed", "archived"].includes(status)),
    creators: strings(candidate.creators).filter(creator => creator === "You"),
    dateRange: strings(candidate.dateRange).filter(range => DATE_RANGES.includes(range)),
    sort: SORT_FIELDS.includes(candidate.sort as SortField) ? candidate.sort! : DEFAULT_VIEW.sort,
    direction: candidate.direction === "Ascending" ? "Ascending" : "Descending",
    columns: [...new Set([...PINNED, ...(Array.isArray(candidate.columns) ? strings(candidate.columns).filter((key): key is ColumnKey => known.includes(key as ColumnKey)) : known)])],
    order: ["select", "activate", "name", ...middle, "actions"],
    density: candidate.density === "Compact" || candidate.density === "Spacious" ? candidate.density : "Comfortable",
  };
}
export const DATE_RANGES = ["Last 7 days", "Last 30 days", "Last 90 days", "Older than 90 days"];
export function filterPlaybooks(records: PlaybookRecord[], config: ViewConfig, creator: string): PlaybookRecord[] {
  return records.filter(row => {
    if (row.status === "archived" && !config.statuses.includes("archived")) return false;
    if (config.statuses.length && !config.statuses.includes(row.status)) return false;
    const age = (Date.now() - Date.parse(row.createdAt)) / 86400000;
    if (config.dateRange.length && !config.dateRange.some(range => range === "Older than 90 days" ? age > 90 : age <= (range === "Last 7 days" ? 7 : range === "Last 30 days" ? 30 : 90))) return false;
    return `${row.name} ${row.status} You ${creator}`.toLowerCase().includes(config.query.trim().toLowerCase());
  }).sort((a, b) => {
    const value = (r: PlaybookRecord): number | string => ({
      Name: r.name.toLowerCase(), "Created date": r.createdAt, "Updated date": r.updatedAt,
      "Active contacts": r.enrollmentCount, Finished: r.finishedCount ?? -1, Sent: r.sentCount ?? -1,
    })[config.sort];
    const av = value(a), bv = value(b);
    const difference = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return config.direction === "Ascending" ? difference : -difference;
  });
}

// The builder uses description for serialized canvas data. Never overwrite it
// with a human-readable table summary or treat it as a plain editable note.
export function canvasDescription(row: PlaybookRecord): string | null {
  try { return localStorage.getItem(`playbook_canvas_v3_${row.id}`) ?? row.description; }
  catch { return row.description; }
}
export function rowSummary(row: PlaybookRecord): string {
  const description = canvasDescription(row);
  if (description?.trim().startsWith("{")) {
    try {
      const canvas = JSON.parse(description);
      if (Array.isArray(canvas.nodes)) {
        const blocks = canvas.nodes.filter((node: { data?: { blockType?: string } }) => node.data?.blockType !== "placeholder").length;
        const threads = Array.isArray(canvas.prospects) ? canvas.prospects.filter((p: { contactId?: number }) => p.contactId).length : 0;
        return `${blocks} block${blocks === 1 ? "" : "s"}${threads ? ` · ${threads} thread${threads === 1 ? "" : "s"}` : ""}`;
      }
    } catch { return "Canvas data could not be read"; }
  }
  return description || `${row.stepCount} step${row.stepCount === 1 ? "" : "s"} · Updated ${new Date(row.updatedAt).toLocaleDateString()}`;
}
export function duplicateDescription(row: PlaybookRecord): string | null {
  const description = canvasDescription(row);
  if (!description?.trim().startsWith("{")) return description;
  const canvas = JSON.parse(description);
  if (!Array.isArray(canvas.nodes)) return description;
  canvas.nodes = canvas.nodes.map((node: { data?: Record<string, unknown> }) => {
    const data = { ...node.data };
    delete data.contactId;
    delete data.contactName;
    return { ...node, data };
  });
  if (Array.isArray(canvas.prospects)) canvas.prospects = canvas.prospects.map((p: Record<string, unknown>) => {
    const copy = { ...p };
    delete copy.contactId;
    delete copy.contactName;
    return copy;
  });
  return JSON.stringify(canvas);
}