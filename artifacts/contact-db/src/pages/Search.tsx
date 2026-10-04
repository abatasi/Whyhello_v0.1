import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2, Users, Search as SearchIcon, Filter,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ExternalLink, Bookmark, Trash2, BookmarkPlus, Check, LayoutList, X,
  Mail, Phone, Clock, Factory, BriefcaseBusiness, TrendingUp, MapPin,
  Sparkles, ClipboardList, Download, type LucideIcon,
} from "lucide-react";
import {
  getRecentContactVisits,
  getRecentCompanyVisits,
  type RecentContactVisit,
  type RecentCompanyVisit,
} from "@/lib/recentVisits";
import {
  useListContacts,
  getListContactsQueryKey,
  useListCompanies,
  useGetFilterOptions,
  useListSavedSearches,
  useCreateSavedSearch,
  useDeleteSavedSearch,
  useListLists,
  useBatchRevealStatuses,
  useRevealContact,
  usePreviewEnrichment,
  useEnrichRecords,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { CompetitorBadge, useCompetitorIds } from "@/components/CompetitorBadge";
import { OverallScorePill } from "@/components/OverallScorePill";
import { ResizableColumnHandle } from "@/components/ResizableColumnHandle";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getInitials, formatNumber, cn } from "@/lib/utils";

type Tab = "contacts" | "companies";
type DirectorySegment = "all" | "netNew" | "enriched";

function parseSegment(value: unknown): DirectorySegment {
  return value === "netNew" || value === "enriched" ? value : "all";
}

type Filters = {
  industry: string[];
  department: string[];
  seniority: string[];
  companySize: string[];
  location: string[];
};

const EMPTY_FILTERS: Filters = {
  industry: [],
  department: [],
  seniority: [],
  companySize: [],
  location: [],
};

function savedFilterValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

type SortConfig = {
  column: string;
  direction: "asc" | "desc";
};

type ContactColumn = "name" | "email" | "mobile" | "jobTitle" | "companyName" | "location" | "department" | "seniority" | "insightCount" | "relevanceScore";
type CompanyColumn = "name" | "industry" | "website" | "location" | "size" | "insightCount";

const CONTACT_COLUMN_LABELS: Record<ContactColumn, string> = {
  name: "Name",
  email: "Email",
  mobile: "Mobile",
  jobTitle: "Title",
  companyName: "Company",
  location: "Location",
  department: "Department",
  seniority: "Seniority",
  insightCount: "Insights",
  relevanceScore: "Relevance",
};

const COMPANY_COLUMN_LABELS: Record<CompanyColumn, string> = {
  name: "Company Name",
  industry: "Industry",
  website: "Website",
  location: "Location",
  size: "Employee Size",
  insightCount: "Insights",
};

const DEFAULT_CONTACT_WIDTHS: Record<ContactColumn, number> = {
  name: 230,
  email: 260,
  mobile: 190,
  jobTitle: 220,
  companyName: 230,
  location: 200,
  department: 180,
  seniority: 155,
  insightCount: 125,
  relevanceScore: 155,
};

const DEFAULT_COMPANY_WIDTHS: Record<CompanyColumn, number> = {
  name: 253,
  industry: 200,
  website: 260,
  location: 200,
  size: 160,
  insightCount: 125,
};

const PREVIOUS_CONTACT_WIDTHS: Record<ContactColumn, number> = {
  name: 200, email: 200, mobile: 160, jobTitle: 160, companyName: 140,
  location: 140, department: 130, seniority: 120, insightCount: 100,
  relevanceScore: 155,
};
const PREVIOUS_COMPANY_WIDTHS: Record<CompanyColumn, number> = {
  name: 220, industry: 140, website: 180, location: 140, size: 130, insightCount: 100,
};

function loadColumnWidths<T extends string>(
  key: string,
  defaults: Record<T, number>,
  previousDefaults: Record<T, number>,
): Record<T, number> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(defaults).map(([column, width]) => [
        column,
        stored[column] === previousDefaults[column as T] ? width
        : typeof stored[column] === "number" && Number.isFinite(stored[column])
          ? Math.max(column === "name" ? 150 : 90, Math.min(720, stored[column]))
          : width,
      ]),
    ) as Record<T, number>;
  } catch {
    return { ...defaults };
  }
}

function DraggableTh<T extends string>({
  column,
  label,
  sortConfig,
  onSort,
  onMove,
  onStartDrag,
  onPreviewMove,
  onCommitDrop,
  onCancelDrag,
  order,
  dragging,
  movable,
  previewOffset,
  width,
  onResize,
  className,
}: {
  column: T;
  label: string;
  sortConfig: SortConfig | null;
  onSort: (column: string, direction: "asc" | "desc") => void;
  onMove: (from: T, to: T) => void;
  onStartDrag: () => void;
  onPreviewMove: (from: T, to: T) => void;
  onCommitDrop: (from: T, to: T) => void;
  onCancelDrag: () => void;
  order: T[];
  dragging: { current: T | null };
  movable: boolean;
  previewOffset: number;
  width: number;
  onResize: (width: number) => void;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hideDraggedLabel, setHideDraggedLabel] = useState(false);
  const suppressClick = useRef(false);
  const hideLabelFrame = useRef<number | null>(null);
  const index = order.indexOf(column);

  return (
    <th
      draggable={movable}
      data-directory-drop-target={movable ? column : undefined}
      style={previewOffset ? { transform: `translateX(${previewOffset}px)`, transition: "transform 140ms ease-out", zIndex: 25 } : undefined}
      aria-sort={sortConfig?.column === column ? (sortConfig.direction === "asc" ? "ascending" : "descending") : undefined}
      onDragStart={(event) => {
        if (!movable || (event.target as HTMLElement).closest("[role='separator']")) {
          event.preventDefault();
          return;
        }
        dragging.current = column;
        onStartDrag();
        suppressClick.current = true;
        setMenuOpen(false);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", column);
        // Let the browser capture the floating drag image before hiding its source label.
        hideLabelFrame.current = window.requestAnimationFrame(() => {
          hideLabelFrame.current = null;
          setHideDraggedLabel(true);
        });
      }}
      onDragEnd={(event) => {
        if (hideLabelFrame.current !== null) window.cancelAnimationFrame(hideLabelFrame.current);
        hideLabelFrame.current = null;
        setHideDraggedLabel(false);
        // A transformed source header can be the drop target itself. If the
        // browser skips its drop event, still commit when released over a
        // movable header in this table; releases elsewhere remain cancellations.
        if (dragging.current === column && event.clientX > 0 && event.clientY > 0) {
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-directory-drop-target]");
          if (target && event.currentTarget.closest("table")?.contains(target)) {
            onCommitDrop(column, target.dataset.directoryDropTarget as T);
          }
        }
        dragging.current = null;
        onCancelDrag();
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }}
      onDragOver={(event) => {
        const from = dragging.current;
        if (!movable || !from) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (from === column) return;
        const fromIndex = order.indexOf(from);
        if (fromIndex < 0) return;
        const center = event.currentTarget.getBoundingClientRect();
        const pastMidpoint = fromIndex < index
          ? event.clientX > center.left + center.width / 2
          : event.clientX < center.left + center.width / 2;
        if (pastMidpoint) onPreviewMove(from, column);
      }}
      onDrop={(event) => {
        if (!movable || !dragging.current) return;
        event.preventDefault();
        onCommitDrop(dragging.current, column);
        dragging.current = null;
      }}
      onClick={() => {
        if (!suppressClick.current) setMenuOpen(true);
      }}
      className={cn(
        "relative px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap select-none",
        movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        sortConfig?.column === column ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn("pointer-events-none flex w-full min-w-0 items-center overflow-hidden pr-1 text-left uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", hideDraggedLabel && "opacity-0")} title={`${label} options`}>
            <span className="truncate">{label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[190px]">
          <DropdownMenuItem onSelect={() => onSort(column, "asc")}>
            <ChevronUp /> Sort ascending
            {sortConfig?.column === column && sortConfig.direction === "asc" && <Check className="ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSort(column, "desc")}>
            <ChevronDown /> Sort descending
            {sortConfig?.column === column && sortConfig.direction === "desc" && <Check className="ml-auto" />}
          </DropdownMenuItem>
          {movable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={index <= 1} onSelect={() => onMove(column, order[index - 1])}>
                <ChevronLeft /> Move Left
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === order.length - 1} onSelect={() => onMove(column, order[index + 1])}>
                <ChevronRight /> Move Right
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResizableColumnHandle label={label} width={width} minWidth={column === "name" ? 150 : 90} onResize={onResize} />
    </th>
  );
}

function reorderColumns<T extends string>(columns: T[], from: T, to: T): T[] {
  const fromIndex = columns.indexOf(from);
  const toIndex = columns.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return columns;
  const next = [...columns];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, from);
  return next;
}

function previewOffset<T extends string>(
  column: T,
  order: T[],
  preview: T[],
  widths: Record<T, number>,
): number {
  const from = order.indexOf(column);
  const to = preview.indexOf(column);
  if (from < 0 || to < 0 || from === to) return 0;
  const crossed = from < to ? order.slice(from + 1, to + 1) : order.slice(to, from);
  const distance = crossed.reduce((sum, item) => sum + widths[item], 0);
  return from < to ? distance : -distance;
}

function useDirectoryColumnOrder<T extends string>(initialOrder: T[]) {
  const [order, setOrder] = useState(initialOrder);
  const [preview, setPreview] = useState<T[] | null>(null);
  const previewRef = useRef<T[] | null>(null);
  const dragging = useRef<T | null>(null);
  const fixed = initialOrder[0];

  const start = () => {
    previewRef.current = [...order];
    setPreview(previewRef.current);
  };
  const previewMove = (from: T, to: T) => {
    if (from === fixed || to === fixed) return;
    const current = previewRef.current ?? order;
    const next = reorderColumns(current, from, to);
    if (next === current) return;
    previewRef.current = next;
    setPreview(next);
  };
  const commit = (from: T, to: T) => {
    if (from !== fixed && to !== fixed) {
      setOrder(previewRef.current ?? order);
    }
    previewRef.current = null;
    setPreview(null);
  };
  const cancel = () => {
    if (previewRef.current) {
      previewRef.current = null;
      setPreview(null);
    }
  };
  const move = (from: T, to: T) => {
    if (from !== fixed && to !== fixed) setOrder((current) => reorderColumns(current, from, to));
  };

  return { order, preview, dragging, start, previewMove, commit, cancel, move };
}

function parseArrayParam(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function joinParam(arr: string[]): string | undefined {
  return arr.length > 0 ? arr.join(",") : undefined;
}

function getInsightLevel(count: number): { label: string; className: string } | null {
  if (count >= 7) return { label: "High", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (count >= 4) return { label: "Medium", className: "bg-amber-100 text-amber-700 border-amber-200" };
  if (count >= 1) return { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20" };
  return null;
}

export default function Search({ directory }: { directory: Tab }) {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const activeTab = directory;
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [segment, setSegment] = useState<DirectorySegment>(() => parseSegment(searchParams.get("segment")));

  const [filters, setFilters] = useState<Filters>({
    industry: parseArrayParam(searchParams.get("industry")),
    department: directory === "contacts" ? parseArrayParam(searchParams.get("department")) : [],
    seniority: directory === "contacts" ? parseArrayParam(searchParams.get("seniority")) : [],
    companySize: parseArrayParam(searchParams.get("companySize")),
    location: parseArrayParam(searchParams.get("location")),
  });

  const competitorIds = useCompetitorIds();

  const [contactSort, setContactSort] = useState<SortConfig | null>(null);
  const [companySort, setCompanySort] = useState<SortConfig | null>(null);
  const {
    order: contactColumnOrder,
    preview: contactPreviewOrder,
    dragging: draggingContactColumn,
    start: beginContactDrag,
    previewMove: previewContactMove,
    commit: commitContactDrop,
    cancel: cancelContactDrag,
    move: moveContactColumn,
  } = useDirectoryColumnOrder<ContactColumn>([
    "name", "relevanceScore", "email", "mobile", "jobTitle", "companyName", "location", "department", "seniority", "insightCount",
  ]);
  const {
    order: companyColumnOrder,
    preview: companyPreviewOrder,
    dragging: draggingCompanyColumn,
    start: beginCompanyDrag,
    previewMove: previewCompanyMove,
    commit: commitCompanyDrop,
    cancel: cancelCompanyDrag,
    move: moveCompanyColumn,
  } = useDirectoryColumnOrder<CompanyColumn>([
    "name", "industry", "website", "location", "size", "insightCount",
  ]);
  const [contactColumnWidths, setContactColumnWidths] = useState(() =>
    loadColumnWidths("directory:people:column-widths", DEFAULT_CONTACT_WIDTHS, PREVIOUS_CONTACT_WIDTHS),
  );
  const [companyColumnWidths, setCompanyColumnWidths] = useState(() =>
    loadColumnWidths("directory:companies:column-widths", DEFAULT_COMPANY_WIDTHS, PREVIOUS_COMPANY_WIDTHS),
  );

  useEffect(() => {
    try { window.localStorage.setItem("directory:people:column-widths", JSON.stringify(contactColumnWidths)); } catch { /* Storage may be unavailable. */ }
  }, [contactColumnWidths]);
  useEffect(() => {
    try { window.localStorage.setItem("directory:companies:column-widths", JSON.stringify(companyColumnWidths)); } catch { /* Storage may be unavailable. */ }
  }, [companyColumnWidths]);

  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [enrichSelection, setEnrichSelection] = useState<{ type: Tab; ids: number[] } | null>(null);
  const enrichmentPreview = usePreviewEnrichment();
  const confirmEnrichment = useEnrichRecords();
  const queryClient = useQueryClient();

  const closeEnrichment = () => {
    if (confirmEnrichment.isPending) return;
    setEnrichOpen(false);
    setEnrichSelection(null);
    enrichmentPreview.reset();
    confirmEnrichment.reset();
  };

  const handleConfirmEnrichment = () => {
    if (!enrichSelection || !enrichmentPreview.data || confirmEnrichment.isPending ||
        (enrichmentPreview.data.creditsRemaining !== null &&
          enrichmentPreview.data.creditsRequired > enrichmentPreview.data.creditsRemaining)) return;
    confirmEnrichment.mutate({ data: enrichSelection }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["credits", "status"] });
        queryClient.invalidateQueries({ queryKey: ["credits", "reveal-statuses-batch"] });
        queryClient.invalidateQueries({ queryKey: ["credits", "reveal-status"] });
        queryClient.invalidateQueries({ queryKey: ["credits", "company-reveal-status"] });
        queryClient.invalidateQueries({ queryKey: ["credits", "revealed-contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["home", "top-leads"] });
        queryClient.invalidateQueries({ queryKey: ["home", "activity"] });
        setSelectedIds(new Set());
      },
      onError: () => {
        // A lost response can follow a successful commit; reload server state
        // rather than assuming no credits were used.
        queryClient.invalidateQueries({ queryKey: ["credits", "status"] });
        queryClient.invalidateQueries({ queryKey: ["credits", "reveal-statuses-batch"] });
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      },
    });
  };

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");

  const [recentContacts, setRecentContacts] = useState<RecentContactVisit[]>([]);
  const [recentCompanies, setRecentCompanies] = useState<RecentCompanyVisit[]>([]);

  // Refresh recent visits whenever the tab switches or the pane opens
  useEffect(() => {
    setRecentContacts(getRecentContactVisits());
    setRecentCompanies(getRecentCompanyVisits());
  }, [activeTab, sidebarOpen]);

  const { data: savedSearches = [] } = useListSavedSearches();
  const createSearch = useCreateSavedSearch();
  const deleteSearch = useDeleteSavedSearch();

  const { data: allLists = [] } = useListLists();

  const handleSaveSearch = () => {
    if (!saveName.trim()) { setSaveError("Please enter a name."); return; }
    createSearch.mutate(
      {
        name: saveName.trim(),
        tab: activeTab,
        search: debouncedSearch || null,
        filters: {
          industry: filters.industry,
          department: filters.department,
          seniority: filters.seniority,
          companySize: filters.companySize,
          location: filters.location,
          segment,
        },
      },
      {
        onSuccess: () => { setSaveDialogOpen(false); setSaveName(""); setSaveError(""); },
        onError: (err: any) => {
          setSaveError(err?.message?.includes("409") ? "A saved search with that name already exists." : "Failed to save. Try again.");
        },
      },
    );
  };

  const toggleId = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllContacts = () => {
    const ids = contacts.map((c) => c.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSelectAllCompanies = () => {
    const ids = companies.map((c) => c.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleLoadSearch = (s: (typeof savedSearches)[number]) => {
    const targetTab: Tab = s.tab === "companies" ? "companies" : "contacts";
    const nextFilters: Filters = {
      industry: savedFilterValues(s.filters.industry),
      department: targetTab === "contacts" ? savedFilterValues(s.filters.department) : [],
      seniority: targetTab === "contacts" ? savedFilterValues(s.filters.seniority) : [],
      companySize: savedFilterValues(s.filters.companySize),
      location: savedFilterValues(s.filters.location),
    };
    if (targetTab !== activeTab) {
      const params = new URLSearchParams();
      if (s.search) params.set("search", s.search);
      const savedSegment = parseSegment(s.filters.segment);
      if (savedSegment !== "all") params.set("segment", savedSegment);
      Object.entries(nextFilters).forEach(([key, values]) => {
        if (values.length) params.set(key, values.join(","));
      });
      const query = params.toString();
      setLocation(`/directory/${targetTab === "contacts" ? "people" : "companies"}${query ? `?${query}` : ""}`);
      return;
    }
    setSearchTerm(s.search ?? "");
    setFilters(nextFilters);
    setSegment(parseSegment(s.filters.segment));
    setPage(1);
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedListId(null);
  }, [activeTab]);

  useEffect(() => {
    setPage(1);
  }, [contactSort, companySort]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", page.toString());
    if (segment !== "all") params.set("segment", segment);
    Object.entries(filters).forEach(([key, arr]) => {
      if (arr.length > 0) params.set(key, arr.join(","));
    });
    const newSearch = params.toString();
    const nextQuery = newSearch ? `?${newSearch}` : "";
    if (window.location.search !== nextQuery) {
      window.history.replaceState(null, "", `${window.location.pathname}${nextQuery}`);
    }
  }, [activeTab, debouncedSearch, page, filters, segment]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, activeTab, selectedListId, segment]);

  const { data: filterOptions } = useGetFilterOptions();

  const contactParams = {
    search: debouncedSearch || undefined,
    segment,
    page,
    limit: 20,
    industry: joinParam(filters.industry),
    department: joinParam(filters.department),
    seniority: joinParam(filters.seniority),
    companySize: joinParam(filters.companySize),
    location: joinParam(filters.location),
    listId: selectedListId ?? undefined,
    sortBy: contactSort?.column,
    sortOrder: contactSort?.direction,
  };
  const { data: contactsData, isLoading: isContactsLoading } = useListContacts(
    contactParams,
    { query: {
      queryKey: getListContactsQueryKey(contactParams),
      enabled: activeTab === "contacts",
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    } },
  );

  const { data: companiesData, isLoading: isCompaniesLoading } = useListCompanies(
    {
      search: debouncedSearch || undefined,
      segment,
      page,
      limit: 20,
      industry: joinParam(filters.industry),
      size: joinParam(filters.companySize),
      location: joinParam(filters.location),
      listId: selectedListId ?? undefined,
      sortBy: companySort?.column,
      sortOrder: companySort?.direction,
    },
    { query: { enabled: activeTab === "companies" } },
  );

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchTerm("");
    setSelectedListId(null);
    setSegment("all");
  };

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => acc + arr.length, 0) + (selectedListId ? 1 : 0) + (segment !== "all" ? 1 : 0);

  const handleContactSort = (column: string, direction: "asc" | "desc") => setContactSort({ column, direction });
  const handleCompanySort = (column: string, direction: "asc" | "desc") => setCompanySort({ column, direction });

  const contacts = contactsData?.data ?? [];
  const companies = companiesData?.data ?? [];

  const contactIds = contacts.map((c) => c.id);
  const { data: revealStatusData } = useBatchRevealStatuses(contactIds);
  const revealedSet = new Set(revealStatusData?.revealedIds ?? []);
  const revealMutation = useRevealContact();

  const filteredLists = allLists.filter((l) => l.type === activeTab);
  const allContactsSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const someContactsSelected = contacts.some((c) => selectedIds.has(c.id));
  const allCompaniesSelected = companies.length > 0 && companies.every((c) => selectedIds.has(c.id));
  const someCompaniesSelected = companies.some((c) => selectedIds.has(c.id));
  const contactTableWidth = 40 + Object.values(contactColumnWidths).reduce((total, width) => total + width, 0);
  const companyTableWidth = 40 + Object.values(companyColumnWidths).reduce((total, width) => total + width, 0);

  return (
    <Shell>
      <div className="flex h-full min-h-0 flex-col">
        {/* Space for the directory title and future page-level content */}
        <header className="flex shrink-0 items-center border-b border-border px-8 py-6">
          <h1 className="text-[1.40625rem] leading-tight font-display font-bold">
            {activeTab === "contacts" ? "Find People" : "Find Companies"}
          </h1>
        </header>
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-8 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            aria-controls="directory-filters"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {sidebarOpen ? "Hide filters" : "Show filters"}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="px-1.5 text-xs">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              Clear All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSaveName(""); setSaveError(""); setSaveDialogOpen(true); }}
            className="gap-2"
          >
            <BookmarkPlus className="h-4 w-4" />
            Save Search
          </Button>
          <div className="w-full min-w-[220px] flex-1 sm:max-w-md">
            <Input
              placeholder={activeTab === "contacts" ? "Search people, titles, companies..." : "Search companies..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<SearchIcon className="h-4 w-4" />}
              aria-label={activeTab === "contacts" ? "Search people" : "Search companies"}
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Selected records actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="gap-1.5 whitespace-nowrap"
              >
                <X className="h-4 w-4" />
                Clear {selectedIds.size} selected
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  enrichmentPreview.reset();
                  confirmEnrichment.reset();
                  const selection = { type: activeTab, ids: Array.from(selectedIds) };
                  setEnrichSelection(selection);
                  setEnrichOpen(true);
                  enrichmentPreview.mutate({ data: selection });
                }}
              >
                <Sparkles className="h-4 w-4" /> Enrich
              </Button>
              <Button variant="outline" size="sm" disabled title="Coming soon" className="gap-1.5">
                <ClipboardList className="h-4 w-4" /> Playbook
              </Button>
              <Button variant="outline" size="sm" disabled title="Coming soon" className="gap-1.5">
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-1 min-h-0">
        {/* Left Sidebar Filters */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="sidebar"
              id="directory-filters"
              initial={{ width: 0 }}
              animate={{ width: 320 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="border-r border-border bg-card flex-shrink-0 overflow-hidden"
            >
        <div className="w-80 h-full overflow-y-auto flex flex-col">
          <div className="sticky top-0 bg-card z-10">
            <div className="grid grid-cols-3 border-b border-border py-4">
              {([
                ["all", "Total", activeTab === "contacts" ? contactsData?.counts.total : companiesData?.counts.total],
                ["netNew", "Net New", activeTab === "contacts" ? contactsData?.counts.netNew : companiesData?.counts.netNew],
                ["enriched", "Enriched", activeTab === "contacts" ? contactsData?.counts.enriched : companiesData?.counts.enriched],
              ] as const).map(([key, label, value], index) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={segment === key}
                  onClick={() => { setSegment(key); setPage(1); }}
                  className={cn(
                    "min-w-0 text-center transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                    index > 0 && "border-l border-border",
                    segment === key && "bg-primary/10 text-primary",
                  )}
                >
                  <div className="text-lg font-semibold tabular-nums">{value === undefined ? "—" : formatNumber(value)}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <div className="px-5 pt-5 pb-2 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5" /> Saved Searches
              </h3>
              <ul className="space-y-1">
                {savedSearches.map((s) => (
                  <li key={s.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => handleLoadSearch(s)}
                      className="flex-1 text-left text-sm py-1.5 px-2 rounded-md hover:bg-primary/10 hover:text-primary transition-colors truncate"
                    >
                      {s.name}
                      <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                        {s.tab === "companies" ? "Companies" : "People"}
                      </span>
                    </button>
                    <button
                      onClick={() => deleteSearch.mutate(s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                      title="Delete saved search"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pb-5">
            <FilterCategory title="Lists" icon={LayoutList} activeCount={selectedListId ? 1 : 0}>
              {filteredLists.length > 0 ? (
                <ul className="space-y-1">
                  {filteredLists.map((list) => {
                    const isActive = selectedListId === list.id;
                    return (
                      <li key={list.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedListId(isActive ? null : list.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{list.name}</span>
                          <span className={cn(
                            "text-xs ml-2 flex-shrink-0 tabular-nums",
                            isActive ? "text-primary/70" : "text-muted-foreground/70",
                          )}>
                            {list.memberCount}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-xs text-muted-foreground">No lists available.</p>}
            </FilterCategory>
            <MultiSelectFilter
              title="Industry"
              icon={Factory}
              options={filterOptions?.industries || []}
              selected={filters.industry}
              onChange={(v) => handleFilterChange("industry", v)}
            />
            {activeTab === "contacts" && (
              <>
                <MultiSelectFilter
                  title="Department"
                  icon={BriefcaseBusiness}
                  options={filterOptions?.departments || []}
                  selected={filters.department}
                  onChange={(v) => handleFilterChange("department", v)}
                />
                <FilterSection
                  title="Seniority"
                  icon={TrendingUp}
                  options={filterOptions?.seniorities || []}
                  selected={filters.seniority}
                  onChange={(v) => handleFilterChange("seniority", v)}
                />
              </>
            )}
            <FilterSection
              title="Company Size"
              icon={Users}
              options={filterOptions?.companySizes || []}
              selected={filters.companySize}
              onChange={(v) => handleFilterChange("companySize", v)}
            />
            <MultiSelectFilter
              title="Location"
              icon={MapPin}
              options={filterOptions?.locations || []}
              selected={filters.location}
              onChange={(v) => handleFilterChange("location", v)}
            />

            {/* Recent Visits */}
            {activeTab === "contacts" && recentContacts.length > 0 && (
              <div className="px-5 pt-6">
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Recent Visits</span>
                </div>
                <ul className="space-y-0.5">
                  {recentContacts.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/contacts/${c.id}`}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors group"
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate leading-tight">{c.name}</p>
                          {(c.title || c.companyName) && (
                            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                              {[c.title, c.companyName].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === "companies" && recentCompanies.length > 0 && (
              <div className="px-5 pt-6">
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Recent Visits</span>
                </div>
                <ul className="space-y-0.5">
                  {recentCompanies.map((co) => (
                    <li key={co.id}>
                      <Link
                        href={`/companies/${co.id}`}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors group"
                      >
                        <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                          {getInitials(co.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate leading-tight">{co.name}</p>
                          {co.industry && (
                            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">{co.industry}</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Results Area */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-8 pt-6 pb-4">
            <AnimatePresence mode="wait">
              {activeTab === "contacts" ? (
                <motion.div
                  key="contacts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-1 min-h-0 flex-col"
                >
                  {isContactsLoading ? (
                    <TableSkeleton cols={8} rows={8} />
                  ) : !contactsData?.data.length ? (
                    <EmptyState />
                  ) : (
                    <div className="isolate flex flex-1 min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      {/* Keep frozen-column z-indices below the global search overlay. */}
                      <div className="min-h-0 flex-1 overflow-auto">
                         <table className="directory-table table-fixed min-w-full border-separate border-spacing-0 text-[13px] [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap" style={{ width: contactTableWidth }}>
                          <colgroup>
                            <col style={{ width: 40 }} />
                            {contactColumnOrder.map((column) => <col key={column} style={{ width: contactColumnWidths[column] }} />)}
                            <col />
                          </colgroup>
                           <thead>
                            <tr className="border-b border-border bg-muted">
                               <th className="px-3 py-2 sticky top-0 left-0 z-50 bg-muted border-b border-border">
                                <input
                                  type="checkbox"
                                  checked={allContactsSelected}
                                  ref={(el) => { if (el) el.indeterminate = someContactsSelected && !allContactsSelected; }}
                                  onChange={toggleSelectAllContacts}
                                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </th>
                              {contactColumnOrder.map((column) => (
                                <DraggableTh
                                  key={column}
                                  column={column}
                                  label={CONTACT_COLUMN_LABELS[column]}
                                  sortConfig={contactSort}
                                  onSort={handleContactSort}
                                  onMove={moveContactColumn}
                                  onStartDrag={beginContactDrag}
                                  onPreviewMove={previewContactMove}
                                  onCommitDrop={commitContactDrop}
                                  onCancelDrag={cancelContactDrag}
                                  order={contactPreviewOrder ?? contactColumnOrder}
                                  dragging={draggingContactColumn}
                                  movable={column !== "name"}
                                  previewOffset={contactPreviewOrder ? previewOffset(column, contactColumnOrder, contactPreviewOrder, contactColumnWidths) : 0}
                                  width={contactColumnWidths[column]}
                                  onResize={(width) => setContactColumnWidths((current) => ({ ...current, [column]: width }))}
                                   className={column === "name" ? "sticky top-0 left-10 z-40 bg-muted border-b border-border" : "sticky top-0 z-30 bg-muted border-b border-border"}
                                />
                              ))}
                              <th
                                aria-hidden="true"
                                data-directory-drop-target={contactColumnOrder[contactColumnOrder.length - 1]}
                                 className="sticky top-0 z-30 bg-muted border-b border-border"
                                onDragOver={(event) => {
                                  if (!draggingContactColumn.current) return;
                                  event.preventDefault();
                                  previewContactMove(draggingContactColumn.current, contactColumnOrder[contactColumnOrder.length - 1]);
                                }}
                                onDrop={(event) => {
                                  if (!draggingContactColumn.current) return;
                                  event.preventDefault();
                                  commitContactDrop(draggingContactColumn.current, contactColumnOrder[contactColumnOrder.length - 1]);
                                  draggingContactColumn.current = null;
                                }}
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {contacts.map((contact, idx) => {
                              const insightCount = contact.insightCount ?? 0;
                              const insightLevel = getInsightLevel(insightCount);
                              const isSelected = selectedIds.has(contact.id);
                              return (
                                <tr
                                  key={contact.id}
                                  className={cn(
                                    "border-b border-border/50 hover:bg-primary/5 transition-colors group cursor-pointer",
                                    isSelected ? "bg-primary/5" : idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                                  )}
                                  onClick={() => setLocation(`/contacts/${contact.id}`)}
                                >
                                   <td className={cn("px-3 py-2 sticky left-0 z-20 directory-frozen-cell", isSelected && "directory-frozen-cell--selected")} onClick={(e) => toggleId(contact.id, e)}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                    />
                                  </td>
                                  {contactColumnOrder.map((column) => {
                                    if (column === "name") {
                                      return (
                                        <td key={column} className={cn(
                                          "px-4 py-2",
                                           contactColumnOrder[0] === "name" && "sticky left-10 z-20 directory-frozen-cell border-r border-border/60 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]",
                                           isSelected && "directory-frozen-cell--selected",
                                        )}>
                                          <div className="flex items-center gap-3">
                                            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                              {getInitials(`${contact.firstName} ${contact.lastName}`)}
                                            </div>
                                            <span className="min-w-0 truncate font-normal text-foreground underline decoration-foreground/40 underline-offset-2 transition-colors group-hover:text-primary">
                                              {contact.firstName} {contact.lastName}
                                            </span>
                                          </div>
                                        </td>
                                      );
                                    }
                                    if (column === "email") {
                                      return (
                                        <td key={column} className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                          {revealedSet.has(contact.id) ? (
                                            contact.email ? (
                                              <a href={`mailto:${contact.email}`} className="block w-full truncate text-primary hover:underline">
                                                {contact.email}
                                              </a>
                                            ) : <span className="text-muted-foreground">—</span>
                                          ) : (
                                            <button
                                              onClick={() => revealMutation.mutate(contact.id)}
                                              disabled={revealMutation.isPending && revealMutation.variables === contact.id}
                                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                                            >
                                              {revealMutation.isPending && revealMutation.variables === contact.id
                                                ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                                                : <Mail className="h-3 w-3" />}
                                              Get Email
                                            </button>
                                          )}
                                        </td>
                                      );
                                    }
                                    if (column === "mobile") {
                                      return (
                                        <td key={column} className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                          {revealedSet.has(contact.id) ? (
                                            contact.phone ? (
                                              <a href={`tel:${contact.phone}`} className="whitespace-nowrap text-foreground transition-colors hover:text-primary">
                                                {contact.phone}
                                              </a>
                                            ) : <span className="text-muted-foreground">—</span>
                                          ) : (
                                            <button
                                              onClick={() => revealMutation.mutate(contact.id)}
                                              disabled={revealMutation.isPending && revealMutation.variables === contact.id}
                                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                                            >
                                              {revealMutation.isPending && revealMutation.variables === contact.id
                                                ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                                                : <Phone className="h-3 w-3" />}
                                              Get Mobile
                                            </button>
                                          )}
                                        </td>
                                      );
                                    }
                                    if (column === "jobTitle") return <td key={column} className="px-4 py-2 text-muted-foreground">{contact.jobTitle ?? "—"}</td>;
                                    if (column === "companyName") {
                                      return (
                                        <td key={column} className="px-4 py-2">
                                          {contact.companyName
                                            ? <span className="font-medium text-primary">{contact.companyName}</span>
                                            : <span className="text-muted-foreground">—</span>}
                                        </td>
                                      );
                                    }
                                    if (column === "location") return <td key={column} className="px-4 py-2 text-muted-foreground">{contact.location ?? "—"}</td>;
                                    if (column === "department") return <td key={column} className="px-4 py-2 text-muted-foreground">{contact.department ?? "—"}</td>;
                                    if (column === "seniority") {
                                      return (
                                        <td key={column} className="px-4 py-2">
                                          {contact.seniority
                                            ? <span className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium text-foreground/80">{contact.seniority}</span>
                                            : <span className="text-muted-foreground">—</span>}
                                        </td>
                                      );
                                    }
                                     if (column === "relevanceScore") {
                                       return (
                                         <td key={column} className="px-4 py-2">
                                           <OverallScorePill
                                             score={contact.relevanceScore}
                                             className="py-0.5 dark:bg-background dark:text-foreground"
                                           />
                                         </td>
                                       );
                                     }
                                    return (
                                      <td key={column} className="px-4 py-2">
                                        {insightLevel
                                          ? <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", insightLevel.className)}>{insightLevel.label}</span>
                                          : <span className="text-xs text-muted-foreground">—</span>}
                                      </td>
                                    );
                                  })}
                                  <td aria-hidden="true" />
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {contactsData && contactsData.totalPages > 1 && (
                    <Pagination
                      currentPage={page}
                      totalPages={contactsData.totalPages}
                      onPageChange={setPage}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="companies"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-1 min-h-0 flex-col"
                >
                  {isCompaniesLoading ? (
                    <TableSkeleton cols={6} rows={8} />
                  ) : !companiesData?.data.length ? (
                    <EmptyState />
                  ) : (
                    <div className="isolate flex flex-1 min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      {/* Keep frozen-column z-indices below the global search overlay. */}
                      <div className="min-h-0 flex-1 overflow-auto">
                         <table className="directory-table table-fixed min-w-full border-separate border-spacing-0 text-[13px] [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap" style={{ width: companyTableWidth }}>
                          <colgroup>
                            <col style={{ width: 40 }} />
                            {companyColumnOrder.map((column) => <col key={column} style={{ width: companyColumnWidths[column] }} />)}
                            <col />
                          </colgroup>
                           <thead>
                            <tr className="border-b border-border bg-muted">
                               <th className="px-3 py-2 sticky top-0 left-0 z-50 bg-muted border-b border-border">
                                <input
                                  type="checkbox"
                                  checked={allCompaniesSelected}
                                  ref={(el) => { if (el) el.indeterminate = someCompaniesSelected && !allCompaniesSelected; }}
                                  onChange={toggleSelectAllCompanies}
                                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </th>
                              {companyColumnOrder.map((column) => (
                                <DraggableTh
                                  key={column}
                                  column={column}
                                  label={COMPANY_COLUMN_LABELS[column]}
                                  sortConfig={companySort}
                                  onSort={handleCompanySort}
                                  onMove={moveCompanyColumn}
                                  onStartDrag={beginCompanyDrag}
                                  onPreviewMove={previewCompanyMove}
                                  onCommitDrop={commitCompanyDrop}
                                  onCancelDrag={cancelCompanyDrag}
                                  order={companyPreviewOrder ?? companyColumnOrder}
                                  dragging={draggingCompanyColumn}
                                  movable={column !== "name"}
                                  previewOffset={companyPreviewOrder ? previewOffset(column, companyColumnOrder, companyPreviewOrder, companyColumnWidths) : 0}
                                  width={companyColumnWidths[column]}
                                  onResize={(width) => setCompanyColumnWidths((current) => ({ ...current, [column]: width }))}
                                   className={column === "name" ? "sticky top-0 left-10 z-40 bg-muted border-b border-border" : "sticky top-0 z-30 bg-muted border-b border-border"}
                                />
                              ))}
                              <th
                                aria-hidden="true"
                                data-directory-drop-target={companyColumnOrder[companyColumnOrder.length - 1]}
                                 className="sticky top-0 z-30 bg-muted border-b border-border"
                                onDragOver={(event) => {
                                  if (!draggingCompanyColumn.current) return;
                                  event.preventDefault();
                                  previewCompanyMove(draggingCompanyColumn.current, companyColumnOrder[companyColumnOrder.length - 1]);
                                }}
                                onDrop={(event) => {
                                  if (!draggingCompanyColumn.current) return;
                                  event.preventDefault();
                                  commitCompanyDrop(draggingCompanyColumn.current, companyColumnOrder[companyColumnOrder.length - 1]);
                                  draggingCompanyColumn.current = null;
                                }}
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {companies.map((company, idx) => {
                              const isSelected = selectedIds.has(company.id);
                              const companyInsightCount = (company as typeof company & { insightCount?: number }).insightCount ?? 0;
                              const companyInsightLevel = getInsightLevel(companyInsightCount);
                              return (
                              <tr
                                key={company.id}
                                className={cn(
                                  "border-b border-border/50 hover:bg-primary/5 transition-colors group cursor-pointer",
                                  isSelected ? "bg-primary/5" : idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                                )}
                                onClick={() => setLocation(`/companies/${company.id}`)}
                              >
                                 <td className={cn("px-3 py-2 sticky left-0 z-20 directory-frozen-cell", isSelected && "directory-frozen-cell--selected")} onClick={(e) => toggleId(company.id, e)}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                  />
                                </td>
                                {companyColumnOrder.map((column) => {
                                  if (column === "name") {
                                    return (
                                      <td key={column} className={cn(
                                        "px-4 py-2",
                                         companyColumnOrder[0] === "name" && "sticky left-10 z-20 directory-frozen-cell border-r border-border/60 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]",
                                         isSelected && "directory-frozen-cell--selected",
                                      )}>
                                        <div className="flex items-center gap-3">
                                          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:bg-none dark:bg-background border border-border flex items-center justify-center flex-shrink-0">
                                            <Building2 className="h-4 w-4 text-slate-500" />
                                          </div>
                                          <span className="min-w-0 truncate font-normal text-foreground underline decoration-foreground/40 underline-offset-2 transition-colors group-hover:text-primary">
                                            {company.name}
                                          </span>
                                          {competitorIds.has(company.id) && <CompetitorBadge />}
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column === "industry") return <td key={column} className="px-4 py-2 text-muted-foreground">{company.industry ?? "—"}</td>;
                                  if (column === "website") {
                                    return (
                                      <td key={column} className="px-4 py-2">
                                        {company.website ? (
                                          <a
                                            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex max-w-full min-w-0 items-center gap-1 truncate text-primary hover:underline"
                                          >
                                            {company.website}
                                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                          </a>
                                        ) : <span className="text-muted-foreground">—</span>}
                                      </td>
                                    );
                                  }
                                  if (column === "location") return <td key={column} className="px-4 py-2 text-muted-foreground">{company.location ?? "—"}</td>;
                                  if (column === "size") return <td key={column} className="px-4 py-2 text-muted-foreground">{company.size ?? "—"}</td>;
                                  return (
                                    <td key={column} className="px-4 py-2">
                                      {companyInsightLevel
                                        ? <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", companyInsightLevel.className)}>{companyInsightLevel.label}</span>
                                        : <span className="text-muted-foreground">—</span>}
                                    </td>
                                  );
                                })}
                                <td aria-hidden="true" />
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {companiesData && companiesData.totalPages > 1 && (
                    <Pagination
                      currentPage={page}
                      totalPages={companiesData.totalPages}
                      onPageChange={setPage}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        </div>
      </div>

      <Dialog open={enrichOpen} onOpenChange={(open) => { if (!open) closeEnrichment(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {confirmEnrichment.isSuccess ? "Enrichment complete" : "Review enrichment"}
            </DialogTitle>
            <DialogDescription>
              {confirmEnrichment.isSuccess
                ? "Your Directory has been updated."
                : `Review the credit cost for your selected ${enrichSelection?.type === "companies" ? "companies" : "contacts"} before confirming.`}
            </DialogDescription>
          </DialogHeader>
          {confirmEnrichment.isSuccess && (
            <div className="space-y-2 rounded-lg border border-border p-4 text-sm" role="status">
              <p className="font-semibold">
                {formatNumber(confirmEnrichment.data.enrichedCount)} new {enrichSelection?.type === "companies" ? "companies" : "contacts"} enriched
              </p>
              <p className="text-muted-foreground">
                {formatNumber(confirmEnrichment.data.creditsCharged)} {confirmEnrichment.data.creditsCharged === 1 ? "credit" : "credits"} used
                {confirmEnrichment.data.alreadyEnrichedCount > 0 &&
                  ` · ${formatNumber(confirmEnrichment.data.alreadyEnrichedCount)} already enriched at no charge`}
              </p>
              {!confirmEnrichment.data.isUnlimited && (
                <p className="text-muted-foreground">{formatNumber(confirmEnrichment.data.creditsRemaining ?? 0)} credits remaining this month.</p>
              )}
            </div>
          )}
          {!confirmEnrichment.isSuccess && enrichmentPreview.isPending && (
            <p className="py-5 text-sm text-muted-foreground" role="status">Calculating your credit estimate…</p>
          )}
          {!confirmEnrichment.isSuccess && enrichmentPreview.isError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              Could not calculate the estimate. Refresh the directory and try again.
            </p>
          )}
          {!confirmEnrichment.isSuccess && enrichmentPreview.data && !enrichmentPreview.isPending && (() => {
            const estimate = enrichmentPreview.data;
            const insufficient = estimate.creditsRemaining !== null &&
              estimate.creditsRequired > estimate.creditsRemaining;
            const noun = enrichSelection?.type === "companies" ? "company" : "contact";
            return (
              <div className="space-y-4 text-sm">
                <dl className="divide-y divide-border rounded-lg border border-border px-4">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Selected {noun}s</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(estimate.selectedCount)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Already enriched · no charge</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(estimate.alreadyEnrichedCount)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">New {noun}s to enrich</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(estimate.toEnrichCount)}</dd>
                  </div>
                </dl>
                <div className="rounded-lg bg-primary/10 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">Estimated credit use</span>
                    <strong className="text-xl tabular-nums text-primary">
                      {formatNumber(estimate.creditsRequired)} {estimate.creditsRequired === 1 ? "credit" : "credits"}
                    </strong>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(estimate.toEnrichCount)} × {estimate.creditsPerRecord} credit{estimate.creditsPerRecord === 1 ? "" : "s"} per {noun}
                  </p>
                </div>
                <p className={cn("text-xs", insufficient ? "text-destructive" : "text-muted-foreground")}>
                  {estimate.isUnlimited
                    ? "Your plan has no monthly credit limit."
                    : `${formatNumber(estimate.creditsRemaining ?? 0)} credits remaining this month.${insufficient ? " Not enough for this selection." : ""}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Credits are only used when you confirm. The final charge is recalculated at confirmation.
                </p>
              </div>
            );
          })()}
          {confirmEnrichment.isPending && (
            <p className="text-sm text-muted-foreground" role="status">Enriching your selection… Please wait.</p>
          )}
          {confirmEnrichment.isError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {confirmEnrichment.error.status === 402
                ? "Not enough credits remain. Close and reopen Enrich to review a fresh estimate."
                : confirmEnrichment.error.status === 409
                  ? "Some selected records are no longer available. Refresh the directory and try again."
                  : "Could not confirm the result. Check the Directory and your credit balance before trying again; previously enriched records won't be charged twice."}
            </p>
          )}
          <DialogFooter>
            <Button variant={confirmEnrichment.isSuccess ? "default" : "outline"} disabled={confirmEnrichment.isPending} onClick={closeEnrichment}>
              {confirmEnrichment.isSuccess ? "Done" : "Cancel"}
            </Button>
            {!confirmEnrichment.isSuccess && enrichmentPreview.data && !enrichmentPreview.isPending && (
              <Button
                disabled={confirmEnrichment.isPending || confirmEnrichment.isError ||
                  (enrichmentPreview.data.creditsRemaining !== null &&
                    enrichmentPreview.data.creditsRequired > enrichmentPreview.data.creditsRemaining)}
                onClick={handleConfirmEnrichment}
              >
                Confirm · use {formatNumber(enrichmentPreview.data.creditsRequired)} {enrichmentPreview.data.creditsRequired === 1 ? "credit" : "credits"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Search Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={(open) => { setSaveDialogOpen(open); if (!open) { setSaveName(""); setSaveError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5 text-primary" /> Save This Search
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-4">
              Give this search a name so you can quickly recall it later.
            </p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Senior Engineers in NYC"
              value={saveName}
              onChange={(e) => { setSaveName(e.target.value); setSaveError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveSearch(); }}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {saveError && <p className="mt-2 text-xs text-destructive">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSearch} disabled={createSearch.isPending}>
              {createSearch.isPending ? "Saving…" : "Save Search"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function FilterCategory({
  title, icon: Icon, activeCount = 0, children,
}: {
  title: string;
  icon: LucideIcon;
  activeCount?: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <div className="border-b border-border/60">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2.5 px-5 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        {activeCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-primary/40 px-1 text-[10px] font-bold text-primary">
            {activeCount}
          </span>
        )}
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={contentId}
            role="region"
            aria-label={title}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="mx-5 mb-3 rounded-md border border-border p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterSection({
  title, icon, options, selected, onChange,
}: {
  title: string;
  icon: LucideIcon;
  options: string[];
  selected: string[];
  onChange: (v: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayOptions = showAll ? options : options.slice(0, 6);
  const hasMore = options.length > 6;

  return (
    <FilterCategory title={title} icon={icon} activeCount={selected.length}>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No options available.</p>
      ) : (
        <div className="space-y-2">
          {displayOptions.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => onChange(opt)}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                  isSelected ? "bg-primary border-primary" : "border-input bg-background group-hover:border-primary/50",
                )}>
                  {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
                <span className={cn(
                  "text-sm transition-colors",
                  isSelected ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground",
                )}>{opt}</span>
              </label>
            );
          })}
          {hasMore && (
            <button
              type="button"
              className="text-xs text-primary font-medium mt-2 hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show less" : `Show ${options.length - 6} more`}
            </button>
          )}
        </div>
      )}
    </FilterCategory>
  );
}

function MultiSelectFilter({
  title,
  icon,
  options,
  selected,
  onChange,
}: {
  title: string;
  icon: LucideIcon;
  options: string[];
  selected: string[];
  onChange: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase()),
  );

  const showChecklist = isFocused || search.length > 0;

  return (
    <FilterCategory title={title} icon={icon} activeCount={selected.length}>
      {options.length === 0 && selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">No options available.</p>
      ) : (
            <div className="space-y-2">
              {/* Active selections — always visible */}
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.map((s) => (
                    <button
                      key={s}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onChange(s)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      <span className="max-w-[120px] truncate">{s}</span>
                      <X className="h-3 w-3 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Search input — always visible */}
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={isFocused ? "Type to filter…" : "Click to browse…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-input bg-background outline-none focus:border-primary/60 placeholder:text-muted-foreground transition-colors"
                />
                {search && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Checklist — only visible when input is focused or a search query is active */}
              <AnimatePresence initial={false}>
                {showChecklist && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      className="max-h-48 overflow-y-auto space-y-1.5 pr-1"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {filtered.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">No options found</p>
                      ) : (
                        filtered.map((opt) => {
                          const isSelected = selected.includes(opt);
                          return (
                            <label
                              key={opt}
                              className="flex items-center gap-2 cursor-pointer group"
                              onClick={() => onChange(opt)}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                                isSelected
                                  ? "bg-primary border-primary"
                                  : "border-input bg-background group-hover:border-primary/50",
                              )}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                              </div>
                              <span className={cn(
                                "text-sm transition-colors",
                                isSelected
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground group-hover:text-foreground",
                              )}>
                                {opt}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
      )}
    </FilterCategory>
  );
}

function TableSkeleton({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-pulse">
      <div className="h-10 bg-muted/40 border-b border-border" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-3 border-b border-border/50">
          <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
          {Array.from({ length: cols - 1 }).map((_, j) => (
            <div key={j} className="h-4 bg-muted rounded flex-1" style={{ maxWidth: `${80 + j * 20}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
      <div className="bg-secondary/50 p-6 rounded-full mb-4">
        <SearchIcon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-bold mb-2">No results found</h3>
      <p className="text-muted-foreground max-w-md">
        Try adjusting your search terms or clearing some filters to find what you're looking for.
      </p>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{currentPage}</span> of <span className="font-medium text-foreground">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
