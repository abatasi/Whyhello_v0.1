import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import { 
  Building2, Users, Search as SearchIcon, Filter, 
  MapPin, Briefcase, Building, ChevronLeft, ChevronRight,
  Mail, Phone
} from "lucide-react";
import { 
  useListContacts, 
  useListCompanies, 
  useGetFilterOptions 
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getInitials, formatNumber, cn } from "@/lib/utils";

type Tab = "contacts" | "companies";

export default function Search() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "contacts");
  
  // Search state
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [debouncedSearch] = useDebounce(searchTerm, 400);

  // Pagination state
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  
  // Filter states
  const [filters, setFilters] = useState({
    industry: searchParams.get("industry") || "",
    department: searchParams.get("department") || "",
    seniority: searchParams.get("seniority") || "",
    companySize: searchParams.get("companySize") || "",
    location: searchParams.get("location") || "",
  });

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", page.toString());
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    
    const newSearch = params.toString();
    const newUrl = newSearch ? `?${newSearch}` : window.location.pathname;
    
    if (window.location.search !== `?${newSearch}` && newSearch !== "") {
       window.history.replaceState(null, "", newUrl);
    }
  }, [activeTab, debouncedSearch, page, filters]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, activeTab]);

  const { data: filterOptions } = useGetFilterOptions();

  const { data: contactsData, isLoading: isContactsLoading } = useListContacts({
    search: debouncedSearch || undefined,
    page,
    limit: 20,
    ...filters,
  }, { query: { enabled: activeTab === "contacts" }});

  const { data: companiesData, isLoading: isCompaniesLoading } = useListCompanies({
    search: debouncedSearch || undefined,
    page,
    limit: 20,
    industry: filters.industry || undefined,
    size: filters.companySize || undefined,
    location: filters.location || undefined,
  }, { query: { enabled: activeTab === "companies" }});

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: prev[key] === value ? "" : value }));
  };

  const clearFilters = () => {
    setFilters({
      industry: "",
      department: "",
      seniority: "",
      companySize: "",
      location: "",
    });
    setSearchTerm("");
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <Shell>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar Filters */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto flex-shrink-0">
          <div className="p-5 border-b border-border sticky top-0 bg-card z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filters
              </h2>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                  Clear All
                </Button>
              )}
            </div>
            <Input 
              placeholder="Search names, companies..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<SearchIcon className="h-4 w-4" />}
            />
          </div>

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
                  activeTab === "contacts" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contacts {contactsData && <Badge variant="secondary" className="ml-1 px-1.5">{formatNumber(contactsData.total)}</Badge>}
                </div>
                {activeTab === "contacts" && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("companies")}
                className={cn(
                  "pb-3 px-4 font-medium text-sm transition-all relative",
                  activeTab === "companies" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Companies {companiesData && <Badge variant="secondary" className="ml-1 px-1.5">{formatNumber(companiesData.total)}</Badge>}
                </div>
                {activeTab === "companies" && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto px-8 pb-8">
            <AnimatePresence mode="wait">
              {activeTab === "contacts" ? (
                <motion.div 
                  key="contacts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {isContactsLoading ? (
                    <LoadingSkeletons type="contact" count={5} />
                  ) : contactsData?.data.length === 0 ? (
                    <EmptyState />
                  ) : (
                    contactsData?.data.map((contact) => (
                      <Link key={contact.id} href={`/contacts/${contact.id}`} className="block group">
                        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                                {getInitials(`${contact.firstName} ${contact.lastName}`)}
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                                  {contact.firstName} {contact.lastName}
                                </h3>
                                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                                  <span className="font-medium text-foreground/80">{contact.jobTitle}</span>
                                  <span>at</span>
                                  <span className="text-primary font-medium">{contact.companyName}</span>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  {contact.location && (
                                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {contact.location}</span>
                                  )}
                                  {contact.department && (
                                    <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {contact.department}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {contact.seniority && (
                                <Badge variant="outline" className="bg-secondary/50">{contact.seniority}</Badge>
                              )}
                              <div className="flex items-center gap-2 text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Mail className="h-4 w-4" />
                                <Phone className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
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
                  className="space-y-3"
                >
                  {isCompaniesLoading ? (
                    <LoadingSkeletons type="company" count={5} />
                  ) : companiesData?.data.length === 0 ? (
                    <EmptyState />
                  ) : (
                    companiesData?.data.map((company) => (
                      <Link key={company.id} href={`/companies/${company.id}`} className="block group">
                        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-border flex items-center justify-center text-slate-500 font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
                                <Building className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                                  {company.name}
                                </h3>
                                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3">
                                  {company.industry && <span className="font-medium text-foreground/80">{company.industry}</span>}
                                  {company.industry && <span>•</span>}
                                  {company.website && <span className="text-primary hover:underline">{company.website}</span>}
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  {company.location && (
                                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {company.location}</span>
                                  )}
                                  {company.size && (
                                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {company.size} employees</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
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
    </Shell>
  );
}

function FilterSection({ title, options, selected, onChange }: { title: string, options: string[], selected: string, onChange: (v: string) => void }) {
  if (!options || options.length === 0) return null;
  
  const displayOptions = options.slice(0, 6);
  const hasMore = options.length > 6;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-2">
        {displayOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer group">
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
              selected === opt ? "bg-primary border-primary" : "border-input bg-background group-hover:border-primary/50"
            )}>
              {selected === opt && <div className="w-2 h-2 bg-white rounded-sm" />}
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{opt}</span>
          </label>
        ))}
        {hasMore && <button className="text-xs text-primary font-medium mt-2 hover:underline">Show more</button>}
      </div>
    </div>
  );
}

function LoadingSkeletons({ type, count }: { type: 'contact'|'company', count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border/50 rounded-xl p-4 shadow-sm flex items-center gap-4 animate-pulse">
          <div className={cn("bg-muted flex-shrink-0", type === 'contact' ? "h-12 w-12 rounded-full" : "h-12 w-12 rounded-xl")} />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-muted rounded w-1/4" />
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="flex gap-4 mt-2">
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-24" />
            </div>
          </div>
        </div>
      ))}
    </>
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

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Showing page <span className="font-medium text-foreground">{currentPage}</span> of <span className="font-medium text-foreground">{totalPages}</span>
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
