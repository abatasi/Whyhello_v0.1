import { useState } from "react";
import { useLocation } from "wouter";
import { LayoutList, Trash2, Users, Building2, Plus, ChevronRight } from "lucide-react";
import { useListLists, useDeleteList, useCreateList } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Lists() {
  const [, setLocation] = useLocation();
  const { data: lists = [], isLoading } = useListLists();
  const deleteList = useDeleteList();
  const createList = useCreateList();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"contacts" | "companies">("contacts");
  const [createError, setCreateError] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) { setCreateError("Name is required."); return; }
    createList.mutate(
      { name: newName.trim(), type: newType },
      {
        onSuccess: (list) => {
          setCreateOpen(false);
          setNewName("");
          setCreateError("");
          setLocation(`/lists/${list.id}`);
        },
        onError: () => setCreateError("Failed to create list. Try again."),
      },
    );
  };

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Lists</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Curated groups of contacts and companies from your directory searches.
            </p>
          </div>
          <Button onClick={() => { setNewName(""); setCreateError(""); setCreateOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New List
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border/50 animate-pulse">
                <div className="h-9 w-9 rounded-lg bg-muted flex-shrink-0" />
                <div className="h-4 bg-muted rounded flex-1 max-w-[200px]" />
                <div className="h-5 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-10 ml-auto" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-secondary/50 p-6 rounded-full mb-4">
              <LayoutList className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No lists yet</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Select rows in the Directory and click "Add to List" to start building curated lists.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">Go to Directory</Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lists.map((list, idx) => (
                  <tr
                    key={list.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer group",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                    )}
                    onClick={() => setLocation(`/lists/${list.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                          list.type === "contacts"
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-amber-50 text-amber-600",
                        )}>
                          {list.type === "contacts"
                            ? <Users className="h-4 w-4" />
                            : <Building2 className="h-4 w-4" />}
                        </div>
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {list.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="secondary" className="capitalize text-xs">{list.type}</Badge>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground font-medium">{list.memberCount}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(list.createdAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteList.mutate(list.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                          title="Delete list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create List Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setNewName(""); setCreateError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> New List
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">List name</label>
              <input
                autoFocus
                type="text"
                placeholder="e.g. Top Prospects Q2"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Type</label>
              <div className="flex gap-2">
                {(["contacts", "companies"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors capitalize",
                      newType === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createList.isPending}>
              {createList.isPending ? "Creating…" : "Create List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
