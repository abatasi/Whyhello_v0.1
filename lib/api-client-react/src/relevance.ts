import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface ContactMetaScore {
  metaScore: number;      // 0–100 aggregate across all four core categories
  personalBest: number;   // best Personal signal score (0 if none)
  companyBest: number;    // best Company signal score (0 if none)
  industryBest: number;   // best Industry signal score (0 if none)
  roleBest: number;       // best Role signal score (0 if none)
  signalCount: number;    // total number of scored signals
  computedAt: string;
}

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

export type TriggerInsightRelevanceInput =
  | number
  | { contactId: number; force?: boolean };

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

export function useGetContactMetaScore(
  contactId: number,
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery<ContactMetaScore | null>({
    queryKey: ["contacts", contactId, "insights", "relevance", "meta"],
    queryFn: () =>
      customFetch<ContactMetaScore | null>(
        `/api/contacts/${contactId}/insights/relevance/meta`
      ),
    enabled: options?.query?.enabled !== false && contactId > 0,
    staleTime: 5 * 60_000,
  });
}

export function useTriggerInsightRelevance() {
  const queryClient = useQueryClient();
  return useMutation<InsightRelevanceScore[], Error, TriggerInsightRelevanceInput>({
    mutationFn: (input) => {
      const contactId = typeof input === "number" ? input : input.contactId;
      const force = typeof input === "number" ? false : input.force === true;
      return customFetch<InsightRelevanceScore[]>(
        `/api/contacts/${contactId}/insights/relevance/score`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        },
      );
    },
    onSuccess: (_, input) => {
      const contactId = typeof input === "number" ? input : input.contactId;
      queryClient.invalidateQueries({
        queryKey: ["contacts", contactId, "insights", "relevance"],
      });
      // Also invalidate the meta score — it is recomputed server-side after each scoring run
      queryClient.invalidateQueries({
        queryKey: ["contacts", contactId, "insights", "relevance", "meta"],
      });
    },
  });
}
