import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface InsightMeta {
  ogImage: string | null;
  favicon: string | null;
  /** Publisher name extracted from og:site_name, meta[name=publisher], or hostname */
  source: string | null;
  /** Normalised date string (e.g. "Mar 2024") from article:published_time or similar */
  publishedDate: string | null;
}

export function useInsightMeta(url: string) {
  return useQuery<InsightMeta>({
    queryKey: ["insight-meta", url],
    queryFn: () =>
      customFetch<InsightMeta>(`/api/meta?url=${encodeURIComponent(url)}`),
    staleTime: 6 * 60 * 60 * 1000, // 6 h — meta rarely changes
    gcTime: 24 * 60 * 60 * 1000,
    enabled: !!url,
    retry: false,
  });
}
