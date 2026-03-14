import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Download, FileDown, Users, Building2 } from "lucide-react";
import { useListExports, downloadExportFile } from "@workspace/api-client-react";
import type { ExportRecord } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn, getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ExportRow({ row }: { row: ExportRecord }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadExportFile(row.id, row.filename);
    } catch {
      toast({ title: "Download failed", description: "Unable to download the file.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="border-b border-border/50 hover:bg-primary/5 transition-colors">
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          {row.listType === "contacts"
            ? <Users className="h-4 w-4 text-indigo-500 flex-shrink-0" />
            : <Building2 className="h-4 w-4 text-amber-500 flex-shrink-0" />}
          <span className="font-medium">{row.listName}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="capitalize">{row.listType}</Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground tabular-nums">
        {row.memberCount.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">
        {formatDate(row.requestedAt)}
      </td>
      <td className="px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={loading}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          {loading ? "Downloading…" : "Download"}
        </Button>
      </td>
    </tr>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { data: exports, isLoading } = useListExports();

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.email ?? "Account";

  return (
    <Shell>
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-10">
        {/* User info card */}
        <div className="flex items-center gap-6">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover border-2 border-border shadow-sm"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border-2 border-primary/20 shadow-sm">
              {getInitials(displayName)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-display font-bold">{displayName}</h1>
            {user?.email && <p className="text-muted-foreground mt-0.5">{user.email}</p>}
          </div>
        </div>

        {/* Export history */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <FileDown className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-display font-semibold">Export History</h2>
            {exports && exports.length > 0 && (
              <span className="ml-auto text-sm text-muted-foreground">{exports.length} export{exports.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border/50">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-4 bg-muted rounded flex-1" style={{ maxWidth: `${80 + j * 40}px` }} />
                  ))}
                </div>
              ))}
            </div>
          ) : !exports || exports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
              <FileDown className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No exports yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                Open a list and click "Export CSV" to generate your first export.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[200px]">List</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[100px]">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[100px]">Records</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[160px]">Exported</th>
                      <th className="px-4 py-3 min-w-[120px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {exports.map((row, idx) => (
                      <ExportRow key={`${row.id}-${idx}`} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
