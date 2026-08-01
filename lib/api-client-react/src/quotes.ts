import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface InsightQuote {
  id: number;
  contactId: number;
  signalType: string;   // personal | company | industry | role | colleague | counterpart
  signalId: number;
  quote: string;
  attribution: string;  // person's name
  attributionRole: string | null;
  hqBridge: string | null;
  matchedHqSignals: string[];
  computedAt: string;
}

export function useGetInsightQuotes(
  contactId: number,
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery<InsightQuote[]>({
    queryKey: ["contacts", contactId, "insights", "quotes"],
    queryFn: () =>
      customFetch<InsightQuote[]>(`/api/contacts/${contactId}/insights/quotes`),
    enabled: options?.query?.enabled !== false && contactId > 0,
    staleTime: 10 * 60_000,
  });
}

export function useExtractInsightQuotes() {
  const queryClient = useQueryClient();
  return useMutation<InsightQuote[], Error, number>({
    mutationFn: (contactId: number) =>
      customFetch<InsightQuote[]>(
        `/api/contacts/${contactId}/insights/quotes/extract`,
        { method: "POST" }
      ),
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({
        queryKey: ["contacts", contactId, "insights", "quotes"],
      });
    },
  });
}
