import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface Message {
  id: number;
  contactId: number | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  body: string;
  status: "draft" | "sent";
  createdAt: string;
  updatedAt: string;
  contactFirstName: string | null;
  contactLastName: string | null;
}

export interface RevealedContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  companyName: string | null;
}

export function useListMessages(status?: string) {
  return useQuery<Message[]>({
    queryKey: ["messages", status ?? "all"],
    queryFn: () => {
      const qs = status ? `?status=${status}` : "";
      return customFetch<Message[]>(`/api/messages${qs}`);
    },
    staleTime: 30_000,
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  return useMutation<Message, Error, Partial<Message> & { toEmail: string }>({
    mutationFn: (data) => customFetch<Message>("/api/messages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation<Message, Error, { id: number } & Partial<Message>>({
    mutationFn: ({ id, ...data }) =>
      customFetch<Message>(`/api/messages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id) => customFetch<{ ok: boolean }>(`/api/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useRevealedContacts(search?: string) {
  return useQuery<RevealedContact[]>({
    queryKey: ["credits", "revealed-contacts", search ?? ""],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return customFetch<RevealedContact[]>(`/api/credits/revealed-contacts${qs}`);
    },
    staleTime: 60_000,
  });
}
