import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import {
  Building2, Users, Search as SearchIcon, Filter,
  ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown,
  ExternalLink, Bookmark, Trash2, BookmarkPlus,
} from "lucide-react";
import {
  useListContacts,
  useListCompanies,
  useGetFilterOptions,
  useListSavedSearches,
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

type SortConfig = {
  column: string;
  direction: "asc" | "desc";
};

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
  if (count >= 1) return { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200" };
  return null;
}

function SortIcon({ column, sortConfig }: { column: string; sortConfig: SortConfig | null }) {
  if (!sortConfig || sortConfig.column !== column) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50 ml-1 flex-shrink-0" />;
  }
  return sortConfig.direction === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-primary ml-1 flex-shrink-0" />
    : <ChevronDown className="h-3.5 w-3.5 text-primary ml-1 flex-shrink-0" />;
}

function SortableTh({
  column,
  label,
  sortConfig,
  onSort,
  className,
}: {
  column: string;
  label: string;
  sortConfig: SortConfig | null;
  onSort: (col: string) => void;
  className?: string;
}) {
  const isActive = sortConfig?.column === column;
  return (
    <th
      onClick={() => onSort(column)}
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <div className="flex items-center">
        {label}
        <SortIcon column={column} sortConfig={sortConfig} />
      </div>
    </th>
  );
}

export default function Search() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "contacts");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));

  const [filters, setFilters] = useState<Filters>({
    industry: parseArrayParam(searchParams.get("industry")),
    department: parseArrayParam(searchParams.get("department")),
    seniority: parseArrayParam(searchParams.get("seniority")),
    companySize: parseArrayParam(searchParams.get("companySize")),
    location: parseArrayParam(searchParams.get("location")),
  });

  const [contactSort, setContactSort] = useState<SortConfig | null>(null);
  const [companySort, setCompanySort] = useState<SortConfig | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");

  const { data: savedSearches = [] } = useListSavedSearches();
  const createSearch = useCreateSavedSearch();
  const deleteSearch = useDeleteSavedSearch();

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

  const handleLoadSearch = (s: (typeof savedSearches)[number]) => {
    setActiveTab(s.tab as Tab);
    setSearchTerm(s.search ?? "");
    setFilters({
      industry: s.filters.industry ?? [],
      department: s.filters.department ?? [],
      seniority: s.filters.seniority ?? [],
      companySize: s.filters.companySize ?? [],
      location: s.filters.location ?? [],
    });
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [contactSort, companySort]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", page.toString());
    Object.entries(filters).forEach(([key, arr]) => {
      if (arr.length > 0) params.set(key, arr.join(","));
    });
    const newSearch = params.toString();
    const newUrl = newSearch ? `?${newSearch}` : window.location.pathname;
    if (window.location.search !== `?${newSearch}` && newSearch !== "") {
      window.history.replaceState(null, "", newUrl);
    }
  }, [activeTab, debouncedSearch, page, filters]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, activeTab]);

  const { data: filterOptions } = useGetFilterOptions();

  const { data: contactsData, isLoading: isContactsLoading } = useListContacts(
    {
      search: debouncedSearch || undefined,
      page,
      limit: 20,
      industry: joinParam(filters.industry),
      department: joinParam(filters.department),
      seniority: joinParam(filters.seniority),
      companySize: joinParam(filters.companySize),
      location: joinParam(filters.location),
      sortBy: contactSort?.column,
      sortOrder: contactSort?.direction,
    },
    { query: { enabled: activeTab === "contacts" } },
  );

  const { data: companiesData, isLoading: isCompaniesLoading } = useListCompanies(
    {
      search: debouncedSearch || undefined,
      page,
      limit: 20,
      industry: joinParam(filters.industry),
      size: joinParam(filters.companySize),
      location: joinParam(filters.location),
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
  };

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => acc + arr.length, 0);

  const handleContactSort = (col: string) => {
    setContactSort((prev) =>
      prev?.column === col
        ? { column: col, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column: col, direction: "asc" },
    );
  };

  const handleCompanySort = (col: string) => {
    setCompanySort((prev) =>
      prev?.column === col
        ? { column: col, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column: col, direction: "asc" },
    );
  };

  const contacts = contactsData?.data ?? [];
  const companies = companiesData?.data ?? [];

  return (
    <Shell>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar Filters */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto flex-shrink-0">
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
              </div>
            </div>
            <Input
              placeholder="Search names, companies..."
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
                      <span className="ml-1.5 text-[10px] text-muted-foreground font-normal capitalize">{s.tab}</span>
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

          <div className="p-5 space-y-8">
            <FilterSection
              title="Industry"
              options={filterOptions?.industries || []}
              selected={filters.industry}
              onChange={(v) => handleFilterChange("industry", v)}
            />
            {activeTab === "contacts" && (
              <>
                <FilterSection
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
            <FilterSection
              title="Location"
              options={filterOptions?.locations || []}
              selected={filters.location}
              onChange={(v) => handleFilterChange("location", v)}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
          {/* Header & Tabs */}
          <div className="px-8 pt-8 pb-4">
            <h1 className="text-3xl font-display font-bold mb-6">Directory Search</h1>
            <div className="flex space-x-1 border-b border-border">
              <button
                onClick={() => setActiveTab("contacts")}
                className={cn(
                  "pb-3 px-4 font-medium text-sm transition-all relative",
                  activeTab === "contacts" ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contacts{contactsData && <Badge variant="secondary" className="ml-1 px-1.5">{formatNumber(contactsData.total)}</Badge>}
                </div>
                {activeTab === "contacts" && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("companies")}
                className={cn(
                  "pb-3 px-4 font-medium text-sm transition-all relative",
                  activeTab === "companies" ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Companies{companiesData && <Badge variant="secondary" className="ml-1 px-1.5">{formatNumber(companiesData.total)}</Badge>}
                </div>
                {activeTab === "companies" && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-auto px-8 pb-8">
            <AnimatePresence mode="wait">
              {activeTab === "contacts" ? (
                <motion.div
                  key="contacts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {isContactsLoading ? (
                    <TableSkeleton cols={7} rows={8} />
                  ) : !contactsData?.data.length ? (
                    <EmptyState />
                  ) : (
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/40">
                              <SortableTh column="name" label="Name" sortConfig={contactSort} onSort={handleContactSort} className="pl-5 min-w-[180px]" />
                              <SortableTh column="jobTitle" label="Title" sortConfig={contactSort} onSort={handleContactSort} className="min-w-[160px]" />
                              <SortableTh column="companyName" label="Company" sortConfig={contactSort} onSort={handleContactSort} className="min-w-[140px]" />
                              <SortableTh column="location" label="Location" sortConfig={contactSort} onSort={handleContactSort} className="min-w-[140px]" />
                              <SortableTh column="department" label="Department" sortConfig={contactSort} onSort={handleContactSort} className="min-w-[130px]" />
                              <SortableTh column="seniority" label="Seniority" sortConfig={contactSort} onSort={handleContactSort} className="min-w-[120px]" />
                              <SortableTh column="insightCount" label="Insights" sortConfig={contactSort} onSort={handleContactSort} className="min-w-[100px]" />
                            </tr>
                          </thead>
                          <tbody>
                            {contacts.map((contact, idx) => {
                              const insightCount = contact.insightCount ?? 0;
                              const insightLevel = getInsightLevel(insightCount);
                              return (
                                <tr
                                  key={contact.id}
                                  className={cn(
                                    "border-b border-border/50 hover:bg-primary/5 transition-colors group cursor-pointer",
                                    idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                                  )}
                                  onClick={() => setLocation(`/contacts/${contact.id}`)}
                                >
                                  <td className="px-4 py-3 pl-5">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                        {getInitials(`${contact.firstName} ${contact.lastName}`)}
                                      </div>
                                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                        {contact.firstName} {contact.lastName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">{contact.jobTitle ?? "—"}</td>
                                  <td className="px-4 py-3">
                                    {contact.companyName
                                      ? <span className="text-primary font-medium">{contact.companyName}</span>
                                      : <span className="text-muted-foreground">—</span>
                                    }
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">{contact.location ?? "—"}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{contact.department ?? "—"}</td>
                                  <td className="px-4 py-3">
                                    {contact.seniority
                                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-secondary/50 text-foreground/80 border-border">{contact.seniority}</span>
                                      : <span className="text-muted-foreground">—</span>
                                    }
                                  </td>
                                  <td className="px-4 py-3">
                                    {insightLevel
                                      ? (
                                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", insightLevel.className)}>
                                          {insightLevel.label}
                                        </span>
                                      )
                                      : <span className="text-muted-foreground text-xs">—</span>
                                    }
                                  </td>
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
                >
                  {isCompaniesLoading ? (
                    <TableSkeleton cols={5} rows={8} />
                  ) : !companiesData?.data.length ? (
                    <EmptyState />
                  ) : (
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/40">
                              <SortableTh column="name" label="Company Name" sortConfig={companySort} onSort={handleCompanySort} className="pl-5 min-w-[180px]" />
                              <SortableTh column="industry" label="Industry" sortConfig={companySort} onSort={handleCompanySort} className="min-w-[140px]" />
                              <SortableTh column="website" label="Website" sortConfig={companySort} onSort={handleCompanySort} className="min-w-[180px]" />
                              <SortableTh column="location" label="Location" sortConfig={companySort} onSort={handleCompanySort} className="min-w-[140px]" />
                              <SortableTh column="size" label="Employee Size" sortConfig={companySort} onSort={handleCompanySort} className="min-w-[130px]" />
                            </tr>
                          </thead>
                          <tbody>
                            {companies.map((company, idx) => (
                              <tr
                                key={company.id}
                                className={cn(
                                  "border-b border-border/50 hover:bg-primary/5 transition-colors group cursor-pointer",
                                  idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                                )}
                                onClick={() => setLocation(`/companies/${company.id}`)}
                              >
                                <td className="px-4 py-3 pl-5">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 border border-border flex items-center justify-center flex-shrink-0">
                                      <Building2 className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                      {company.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{company.industry ?? "—"}</td>
                                <td className="px-4 py-3">
                                  {company.website ? (
                                    <a
                                      href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate"
                                    >
                                      {company.website}
                                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{company.location ?? "—"}</td>
                                <td className="px-4 py-3 text-muted-foreground">{company.size ?? "—"}</td>
                              </tr>
                            ))}
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
  const [showAll, setShowAll] = useState(false);
  if (!options || options.length === 0) return null;

  const displayOptions = showAll ? options : options.slice(0, 6);
  const hasMore = options.length > 6;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
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
            className="text-xs text-primary font-medium mt-2 hover:underline"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show less" : `Show ${options.length - 6} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function TableSkeleton({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-pulse">
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
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
