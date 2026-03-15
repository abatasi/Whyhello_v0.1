import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface ExportRecord {
  id: number;
  userId: string;
  listId: number;
  listName: string;
  listType: string;
  filename: string;
  memberCount: number | null;
  requestedAt: string;
}

export function useListExports() {
  return useQuery<ExportRecord[]>({
    queryKey: ["exports"],
    queryFn: () => customFetch<ExportRecord[]>("/api/exports"),
    staleTime: 30_000,
  });
}

export interface CreateExportPayload {
  listId: number;
}

export function useCreateExport() {
  const queryClient = useQueryClient();
  return useMutation<ExportRecord, Error, CreateExportPayload>({
    mutationFn: (payload) =>
      customFetch<ExportRecord>("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exports"] });
    },
  });
}

export async function downloadExportFile(id: number, filename: string): Promise<void> {
  const response = await fetch(`/api/exports/${id}/download`);
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
