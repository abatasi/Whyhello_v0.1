import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Users, Building2, Trash2, ExternalLink, Download } from "lucide-react";
import { useGetList, useGetListMembers, useRemoveListMember, useCreateExport } from "@workspace/api-client-react";
import type { ContactSummary, CompanySummary } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn, getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function getInsightLevel(count: number): { label: string; className: string } | null {
  if (count >= 7) return { label: "High", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (count >= 4) return { label: "Medium", className: "bg-amber-100 text-amber-700 border-amber-200" };
  if (count >= 1) return { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20" };
  return null;
}

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/50">
      <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export default function ListDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/lists/:id");
  const listId = parseInt(params?.id ?? "0");
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const { data: list, isLoading: listLoading } = useGetList(listId);
  const { data: members, isLoading: membersLoading } = useGetListMembers(listId, { page, limit: 20 });
  const removeContact = useRemoveListMember(listId);
  const exportCSV = useCreateExport();

  const handleExport = async () => {
    try {
      const result = await exportCSV.mutateAsync({ listId });
      const blob = new Blob([result.csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: `${result.memberCount} records exported.` });
    } catch {
      toast({ title: "Export failed", description: "Could not generate export.", variant: "destructive" });
    }
  };

  if (listLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </Shell>
    );
  }

  if (!list) {
    return (
      <Shell>
        <div className="max-w-5xl mx-auto px-8 py-10 text-center">
          <p className="text-muted-foreground">List not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/lists")}>
            Back to Lists
          </Button>
        </div>
      </Shell>
    );
  }

  const isContacts = list.type === "contacts";
  const rows = members?.data ?? [];

  return (
    <Shell>
      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Back + Header */}
        <button
          onClick={() => setLocation("/lists")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> All Lists
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
            isContacts ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600",
          )}>
            {isContacts ? <Users className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{list.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="secondary" className="capitalize">{list.type}</Badge>
              <span className="text-sm text-muted-foreground">{list.memberCount} member{list.memberCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportCSV.isPending || list.memberCount === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {exportCSV.isPending ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>

        {/* Members Table */}
        {membersLoading ? (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border/50">
                <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 bg-muted rounded flex-1" style={{ maxWidth: `${80 + j * 30}px` }} />
                ))}
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-secondary/50 p-6 rounded-full mb-4">
              {isContacts ? <Users className="h-10 w-10 text-muted-foreground" /> : <Building2 className="h-10 w-10 text-muted-foreground" />}
            </div>
            <h3 className="text-xl font-bold mb-2">No members yet</h3>
            <p className="text-muted-foreground max-w-sm mb-4">
              Select {isContacts ? "contacts" : "companies"} from the directory and use "Add to List" to populate this list.
            </p>
            <Button variant="outline" onClick={() => setLocation("/")}>Go to Directory</Button>
          </div>
        ) : isContacts ? (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[180px]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[160px]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[140px]">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[130px]">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[110px]">Seniority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[90px]">Insights</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {(rows as ContactSummary[]).map((contact, idx) => {
                    const insightCount = (contact as any).insightCount ?? 0;
                    const insightLevel = getInsightLevel(insightCount);
                    return (
                      <tr
                        key={contact.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer group",
                          idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                        )}
                        onClick={() => setLocation(`/contacts/${contact.id}`)}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                              {getInitials(`${contact.firstName} ${contact.lastName}`)}
                            </div>
                            <span className="font-medium group-hover:text-primary transition-colors">
                              {contact.firstName} {contact.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{contact.jobTitle ?? "—"}</td>
                        <td className="px-4 py-3">
                          {contact.companyName
                            ? <span className="text-primary font-medium">{contact.companyName}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{contact.location ?? "—"}</td>
                        <td className="px-4 py-3">
                          {contact.seniority
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-secondary/50 text-foreground/80 border-border">{contact.seniority}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {insightLevel
                            ? <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", insightLevel.className)}>{insightLevel.label}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); removeContact.mutate(contact.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                            title="Remove from list"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {members && members.totalPages > 1 && (
              <Pagination currentPage={page} totalPages={members.totalPages} onPageChange={setPage} />
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[180px]">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[140px]">Industry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[180px]">Website</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[140px]">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[120px]">Size</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {(rows as CompanySummary[]).map((company, idx) => (
                    <tr
                      key={company.id}
                      className={cn(
                        "border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer group",
                        idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                      )}
                      onClick={() => setLocation(`/companies/${company.id}`)}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 border border-border flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="font-medium group-hover:text-primary transition-colors">{company.name}</span>
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
                            {company.website}<ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{company.location ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{company.size ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeContact.mutate(company.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                          title="Remove from list"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {members && members.totalPages > 1 && (
              <Pagination currentPage={page} totalPages={members.totalPages} onPageChange={setPage} />
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
