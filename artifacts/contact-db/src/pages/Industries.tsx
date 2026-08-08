import { apiFetch } from "@/lib/apiFetch";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Factory, ChevronRight, Search, Loader2, FileText } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface Industry {
  id: number;
  name: string;
  description: string | null;
  insightCount: number;
}

interface PageResponse {
  data: Industry[];
  total: number;
  page: number;
  totalPages: number;
}

function Paginator({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center py-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="px-3 py-1.5 rounded-lg text-sm border border-border disabled:opacity-40 hover:bg-accent transition-colors"
      >
        Previous
      </button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 rounded-lg text-sm border border-border disabled:opacity-40 hover:bg-accent transition-colors"
      >
        Next
      </button>
    </div>
  );
}

export default function Industries() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Industries · Whyhello";
    return () => { document.title = "Whyhello"; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    apiFetch(`/api/industries?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [debouncedSearch, page]);

  const industries = data?.data ?? [];

  return (
    <Shell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Industries</h1>
            <p className="text-muted-foreground mt-1">
              {data ? `${data.total.toLocaleString()} industr${data.total !== 1 ? "ies" : "y"}` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search industries…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : industries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Factory className="h-10 w-10 opacity-20" />
            <p className="text-sm">
              {debouncedSearch ? `No industries matching "${debouncedSearch}"` : "No industries yet. Use Import to add them."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border divide-y overflow-hidden">
            {industries.map(ind => (
              <Link key={ind.id} href={`/industries/${ind.id}`}>
                <div className="flex items-center gap-4 px-4 py-4 hover:bg-accent/40 transition-colors cursor-pointer group">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Factory className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ind.name}</p>
                    {ind.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{ind.description}</p>
                    )}
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0",
                  )}>
                    <FileText className="h-3.5 w-3.5" />
                    <span>{ind.insightCount} insight{ind.insightCount !== 1 ? "s" : ""}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {data && <Paginator page={data.page} totalPages={data.totalPages} onPage={setPage} />}
      </div>
    </Shell>
  );
}
