import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ContactSummary, CompanySummary } from "./generated/api.schemas";

export interface ListRecord {
  id: number;
  name: string;
  type: "contacts" | "companies";
  createdAt: string;
  memberCount: number;
}

export interface ListMembersResponse {
  members: (ContactSummary | CompanySummary)[];
  type: "contacts" | "companies";
}

export function useListLists() {
  return useQuery<ListRecord[]>({
    queryKey: ["lists"],
    queryFn: () => customFetch<ListRecord[]>("/api/lists"),
    staleTime: 30_000,
  });
}

export function useGetList(id: number) {
  return useQuery<ListRecord>({
    queryKey: ["lists", id],
    queryFn: () => customFetch<ListRecord>(`/api/lists/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useGetListMembers(id: number) {
  return useQuery<ListMembersResponse>({
    queryKey: ["lists", id, "members"],
    queryFn: () => customFetch<ListMembersResponse>(`/api/lists/${id}/members`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export interface CreateListPayload {
  name: string;
  type: "contacts" | "companies";
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation<ListRecord, Error, CreateListPayload>({
    mutationFn: (payload) =>
      customFetch<ListRecord>("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id) =>
      customFetch<{ ok: boolean }>(`/api/lists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export interface AddMembersPayload {
  listId: number;
  ids: number[];
}

export function useAddMembersToList() {
  const queryClient = useQueryClient();
  return useMutation<{ added: number }, Error, AddMembersPayload>({
    mutationFn: ({ listId, ids }) =>
      customFetch<{ added: number }>(`/api/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (_data, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists", listId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export interface RemoveMemberPayload {
  listId: number;
  memberId: number;
}

export function useRemoveListMember() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, RemoveMemberPayload>({
    mutationFn: ({ listId, memberId }) =>
      customFetch<{ ok: boolean }>(`/api/lists/${listId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists", listId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}
