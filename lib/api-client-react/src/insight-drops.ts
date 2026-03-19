import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface InsightDropPayload {
  mediaType?: string;
  insightTitle?: string;
  subInsightText?: string;
  contactId?: number;
}

export interface InsightDropCount {
  count: number;
}

export function useTrackInsightDrop() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, InsightDropPayload>({
    mutationFn: (data) =>
      customFetch<{ ok: boolean }>("/api/insight-drops", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insight-drops", "count"] });
    },
  });
}

export function useInsightDropCount() {
  return useQuery<InsightDropCount>({
    queryKey: ["insight-drops", "count"],
    queryFn: () => customFetch<InsightDropCount>("/api/insight-drops/count"),
    staleTime: 30_000,
  });
}
