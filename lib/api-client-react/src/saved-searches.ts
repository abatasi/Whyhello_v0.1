import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface SavedSearch {
  id: number;
  name: string;
  tab: "contacts" | "companies";
  search: string | null;
  filters: Record<string, unknown>;
  createdAt: string;
}

export function useListSavedSearches() {
  return useQuery<SavedSearch[]>({
    queryKey: ["saved-searches"],
    queryFn: () => customFetch<SavedSearch[]>("/api/saved-searches"),
    staleTime: 60_000,
  });
}

export interface CreateSavedSearchPayload {
  name: string;
  tab: "contacts" | "companies";
  search: string | null;
  filters: Record<string, unknown>;
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation<SavedSearch, Error, CreateSavedSearchPayload>({
    mutationFn: (payload) =>
      customFetch<SavedSearch>("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id) =>
      customFetch<{ ok: boolean }>(`/api/saved-searches/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });
}
