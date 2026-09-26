import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import {
  Building2, Users, Search as SearchIcon, Filter,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ExternalLink, Bookmark, Trash2, BookmarkPlus, ListPlus, Check, Plus, LayoutList, X,
  Mail, Phone, Clock,
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
  useCreateList,
  useAddMembersToList,
  useBatchRevealStatuses,
  useRevealContact,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { getInitials, formatNumber, cn } from "@/lib/utils";

type Tab = "contacts" | "companies";

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
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [addListError, setAddListError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

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
  const createList = useCreateList();
  const addMembers = useAddMembersToList();

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

  const doAddToList = (listId: number) => {
    addMembers.mutate(
      { listId, ids: Array.from(selectedIds) },
      {
        onSuccess: (res) => {
          setAddToListOpen(false);
          setNewListName("");
          setAddListError("");
          setAddSuccess(`Added ${res.added} ${activeTab} to list.`);
          setSelectedIds(new Set());
          setTimeout(() => setAddSuccess(""), 3000);
        },
        onError: () => setAddListError("Failed to add to list. Try again."),
      },
    );
  };

  const handleAddToNewList = () => {
    if (!newListName.trim()) { setAddListError("Please enter a list name."); return; }
    createList.mutate(
      { name: newListName.trim(), type: activeTab },
      {
        onSuccess: (list) => doAddToList(list.id),
        onError: () => setAddListError("Failed to create list. Try again."),
      },
    );
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
      Object.entries(nextFilters).forEach(([key, values]) => {
        if (values.length) params.set(key, values.join(","));
      });
      const query = params.toString();
      setLocation(`/directory/${targetTab === "contacts" ? "people" : "companies"}${query ? `?${query}` : ""}`);
      return;
    }
    setSearchTerm(s.search ?? "");
    setFilters(nextFilters);
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
    Object.entries(filters).forEach(([key, arr]) => {
      if (arr.length > 0) params.set(key, arr.join(","));
    });
    const newSearch = params.toString();
    const nextQuery = newSearch ? `?${newSearch}` : "";
    if (window.location.search !== nextQuery) {
      window.history.replaceState(null, "", `${window.location.pathname}${nextQuery}`);
    }
  }, [activeTab, debouncedSearch, page, filters]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, activeTab, selectedListId]);

  const { data: filterOptions } = useGetFilterOptions();

  const contactParams = {
    search: debouncedSearch || undefined,
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
    { query: { queryKey: getListContactsQueryKey(contactParams), enabled: activeTab === "contacts" } },
  );

  const { data: companiesData, isLoading: isCompaniesLoading } = useListCompanies(
    {
      search: debouncedSearch || undefined,
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
  };

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => acc + arr.length, 0) + (selectedListId ? 1 : 0);

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
      <div className="flex h-full min-h-0">
        {/* Left Sidebar Filters */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="sidebar"
              initial={{ width: 0 }}
              animate={{ width: 320 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="border-r border-border bg-card flex-shrink-0 overflow-hidden"
            >
        <div className="w-80 h-full overflow-y-auto flex flex-col">
          <div className="p-5 border-b border-border sticky top-0 bg-card z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 text-xs">{activeFilterCount}</Badge>
                )}
              </h2>
              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSaveName(""); setSaveError(""); setSaveDialogOpen(true); }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                  title="Save current search"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Collapse filters"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Input
              placeholder={activeTab === "contacts" ? "Search people, titles, companies..." : "Search companies..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<SearchIcon className="h-4 w-4" />}
            />
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

          {/* Lists Filter */}
          {filteredLists.length > 0 && (
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <LayoutList className="h-3.5 w-3.5" /> Lists
              </h3>
              <ul className="space-y-1">
                {filteredLists.map((list) => {
                  const isActive = selectedListId === list.id;
                  return (
                    <li key={list.id}>
                      <button
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
            </div>
          )}

          <div className="p-5 space-y-8">
            <MultiSelectFilter
              title="Industry"
              options={filterOptions?.industries || []}
              selected={filters.industry}
              onChange={(v) => handleFilterChange("industry", v)}
            />
            {activeTab === "contacts" && (
              <>
                <MultiSelectFilter
                  title="Department"
                  options={filterOptions?.departments || []}
                  selected={filters.department}
                  onChange={(v) => handleFilterChange("department", v)}
                />
                <FilterSection
                  title="Seniority"
                  options={filterOptions?.seniorities || []}
                  selected={filters.seniority}
                  onChange={(v) => handleFilterChange("seniority", v)}
                />
              </>
            )}
            <FilterSection
              title="Company Size"
              options={filterOptions?.companySizes || []}
              selected={filters.companySize}
              onChange={(v) => handleFilterChange("companySize", v)}
            />
            <MultiSelectFilter
              title="Location"
              options={filterOptions?.locations || []}
              selected={filters.location}
              onChange={(v) => handleFilterChange("location", v)}
            />

            {/* Recent Visits */}
            {activeTab === "contacts" && recentContacts.length > 0 && (
              <div>
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
              <div>
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
          {/* Header & Tabs */}
          <div className="px-8 pt-8 pb-4">
            <div className="flex items-center gap-4 mb-6">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-card border border-border rounded-lg shadow-sm hover:bg-secondary/50 transition-colors flex-shrink-0"
                  title="Show filters"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-0.5 px-1.5 text-xs">{activeFilterCount}</Badge>
                  )}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              <h1 className="text-3xl font-display font-bold">
                {activeTab === "contacts" ? "People Directory" : "Companies Directory"}
              </h1>
            </div>
            <div className="flex space-x-1 border-b border-border">
              <Link
                href="/directory/people"
                className={cn(
                  "pb-3 px-4 font-medium text-sm transition-all relative",
                  activeTab === "contacts" ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={activeTab === "contacts" ? "page" : undefined}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  People{contactsData && <Badge variant="secondary" className="ml-1 px-1.5">{formatNumber(contactsData.total)}</Badge>}
                </div>
                {activeTab === "contacts" && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </Link>
              <Link
                href="/directory/companies"
                className={cn(
                  "pb-3 px-4 font-medium text-sm transition-all relative",
                  activeTab === "companies" ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={activeTab === "companies" ? "page" : undefined}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Companies{companiesData && <Badge variant="secondary" className="ml-1 px-1.5">{formatNumber(companiesData.total)}</Badge>}
                </div>
                {activeTab === "companies" && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </Link>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-8 pb-4">
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
                    <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="min-h-0 flex-1 overflow-auto">
                        <table className="table-fixed min-w-full text-[13px] [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap" style={{ width: contactTableWidth }}>
                          <colgroup>
                            <col style={{ width: 40 }} />
                            {contactColumnOrder.map((column) => <col key={column} style={{ width: contactColumnWidths[column] }} />)}
                            <col />
                          </colgroup>
                          <thead className="sticky top-0 z-30">
                            <tr className="border-b border-border bg-muted">
                              <th className="px-3 py-2 sticky left-0 z-40 bg-muted">
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
                                  className={column === "name" ? "sticky left-10 z-30 bg-muted" : "bg-muted"}
                                />
                              ))}
                              <th
                                aria-hidden="true"
                                data-directory-drop-target={contactColumnOrder[contactColumnOrder.length - 1]}
                                className="bg-muted"
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
                                  <td className={cn("px-3 py-2 sticky left-0 z-20 group-hover:bg-primary/5 bg-card", isSelected && "bg-primary/5")} onClick={(e) => toggleId(contact.id, e)}>
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
                                          contactColumnOrder[0] === "name" && "sticky left-10 z-20 group-hover:bg-primary/5 bg-card border-r border-border/60 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]",
                                          isSelected && "bg-primary/5",
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
                    <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="min-h-0 flex-1 overflow-auto">
                        <table className="table-fixed min-w-full text-[13px] [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap" style={{ width: companyTableWidth }}>
                          <colgroup>
                            <col style={{ width: 40 }} />
                            {companyColumnOrder.map((column) => <col key={column} style={{ width: companyColumnWidths[column] }} />)}
                            <col />
                          </colgroup>
                          <thead className="sticky top-0 z-30">
                            <tr className="border-b border-border bg-muted">
                              <th className="px-3 py-2 sticky left-0 z-40 bg-muted">
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
                                  className={column === "name" ? "sticky left-10 z-30 bg-muted" : "bg-muted"}
                                />
                              ))}
                              <th
                                aria-hidden="true"
                                data-directory-drop-target={companyColumnOrder[companyColumnOrder.length - 1]}
                                className="bg-muted"
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
                                <td className={cn("px-3 py-2 sticky left-0 z-20 group-hover:bg-primary/5 bg-card", isSelected && "bg-primary/5")} onClick={(e) => toggleId(company.id, e)}>
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
                                        companyColumnOrder[0] === "name" && "sticky left-10 z-20 group-hover:bg-primary/5 bg-card border-r border-border/60 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]",
                                        isSelected && "bg-primary/5",
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

      {/* Floating Selection Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background rounded-2xl shadow-2xl px-5 py-3",
              ((activeTab === "contacts" ? contactsData?.totalPages : companiesData?.totalPages) ?? 0) > 1 ? "bottom-24" : "bottom-6",
            )}
          >
            <span className="text-sm font-medium">
              {selectedIds.size} {activeTab === "contacts" ? "contact" : "company"}{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="h-4 w-px bg-background/20" />
            <button
              onClick={() => { setNewListName(""); setAddListError(""); setAddToListOpen(true); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary bg-background rounded-lg px-3 py-1.5 hover:bg-primary hover:text-background transition-colors"
            >
              <ListPlus className="h-4 w-4" /> Add to List
            </button>
            <button
              aria-label="Clear selection"
              onClick={() => setSelectedIds(new Set())}
              className="text-background/60 hover:text-background text-sm transition-colors ml-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {addSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white rounded-xl shadow-lg px-4 py-2.5 text-sm font-medium"
          >
            <Check className="h-4 w-4" /> {addSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add to List Dialog */}
      <Dialog open={addToListOpen} onOpenChange={(o) => { setAddToListOpen(o); if (!o) { setNewListName(""); setAddListError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-primary" />
              Add {selectedIds.size} {activeTab === "contacts" ? "contact" : "company"}{selectedIds.size !== 1 ? "s" : ""} to a List
            </DialogTitle>
          </DialogHeader>
          <div className="py-1 space-y-5">
            {/* Existing lists */}
            {filteredLists.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Your {activeTab} lists</p>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {filteredLists.map((list) => (
                    <li key={list.id}>
                      <button
                        onClick={() => doAddToList(list.id)}
                        disabled={addMembers.isPending}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm group"
                      >
                        <span className="font-medium group-hover:text-primary">{list.name}</span>
                        <span className="text-muted-foreground text-xs">{list.memberCount} members</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{filteredLists.length > 0 ? "or create new" : "create a new list"}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Create new */}
            <div className="flex gap-2">
              <input
                autoFocus={filteredLists.length === 0}
                type="text"
                placeholder="New list name…"
                value={newListName}
                onChange={(e) => { setNewListName(e.target.value); setAddListError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddToNewList(); }}
                className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button onClick={handleAddToNewList} disabled={createList.isPending || addMembers.isPending} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create & Add
              </Button>
            </div>
            {addListError && <p className="text-xs text-destructive">{addListError}</p>}
          </div>
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

function FilterSection({
  title, options, selected, onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  if (!options || options.length === 0) return null;

  const displayOptions = showAll ? options : options.slice(0, 6);
  const hasMore = options.length > 6;
  const activeCount = selected.length;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between group mb-1"
      >
        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          {title}
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </span>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-2 space-y-2">
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
                  className="text-xs text-primary font-medium mt-2 hover:underline"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Show less" : `Show ${options.length - 6} more`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MultiSelectFilter({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!options || options.length === 0) return null;

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = selected.length;
  const showChecklist = isFocused || search.length > 0;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between group mb-1"
      >
        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          {title}
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </span>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-2 space-y-2">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
