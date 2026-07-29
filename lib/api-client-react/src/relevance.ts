import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface InsightRelevanceScore {
  signalType: string;  // personal | company | industry | role | colleague | counterpart
  signalId: number;
  score: number;       // 0–100
  description: string;
  matchedHqSignals: string[];
  computedAt: string;
}

export interface TopRelevantContact {
  contactId: number;
  firstName: string;
  lastName: string;
  title: string | null;
  companyName: string | null;
  avgScore: number;
  maxScore: number;
}

export function useGetInsightRelevance(
  contactId: number,
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery<InsightRelevanceScore[]>({
    queryKey: ["contacts", contactId, "insights", "relevance"],
    queryFn: () =>
      customFetch<InsightRelevanceScore[]>(`/api/contacts/${contactId}/insights/relevance`),
    enabled: options?.query?.enabled !== false && contactId > 0,
    staleTime: 5 * 60_000,
  });
}

export function useGetTopRelevantContact(contactId: number, enabled = true) {
  return useQuery<TopRelevantContact | null>({
    queryKey: ["contacts", contactId, "insights", "relevance", "top-contact"],
    queryFn: () =>
      customFetch<TopRelevantContact | null>(
        `/api/contacts/${contactId}/insights/relevance/top-contact`
      ),
    enabled: enabled && contactId > 0,
    staleTime: 10 * 60_000,
  });
}

export function useTriggerInsightRelevance() {
  const queryClient = useQueryClient();
  return useMutation<InsightRelevanceScore[], Error, number>({
    mutationFn: (contactId: number) =>
      customFetch<InsightRelevanceScore[]>(
        `/api/contacts/${contactId}/insights/relevance/score`,
        { method: "POST" }
      ),
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({
        queryKey: ["contacts", contactId, "insights", "relevance"],
      });
    },
  });
}
