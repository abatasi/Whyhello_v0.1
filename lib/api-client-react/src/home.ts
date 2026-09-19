import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface TopLead {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  score: number;
  scoreCategory: "Excellent" | "Strong" | "Potential" | "Low Fit";
}

export function useTopLeads(limit = 10) {
  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  return useQuery<TopLead[]>({
    queryKey: ["home", "top-leads", safeLimit],
    queryFn: () => customFetch<TopLead[]>(`/api/home/top-leads?limit=${safeLimit}`),
    staleTime: 5 * 60_000,
  });
}