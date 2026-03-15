import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type Tier = "freemium" | "professional" | "enterprise";

export interface CreditStatus {
  tier: Tier;
  creditsUsed: number;
  creditsTotal: number | null;
  isUnlimited: boolean;
}

export interface RevealStatus {
  isRevealed: boolean;
}

export interface RevealResult extends CreditStatus {
  revealed: boolean;
  alreadyRevealed: boolean;
}

export function useCreditsStatus() {
  return useQuery<CreditStatus>({
    queryKey: ["credits", "status"],
    queryFn: () => customFetch<CreditStatus>("/api/credits/status"),
    staleTime: 30_000,
  });
}

export function useRevealStatus(contactId: number) {
  return useQuery<RevealStatus>({
    queryKey: ["credits", "reveal-status", contactId],
    queryFn: () => customFetch<RevealStatus>(`/api/credits/reveal-status/${contactId}`),
    enabled: !!contactId,
  });
}

export function useRevealContact() {
  const queryClient = useQueryClient();
  return useMutation<RevealResult, Error, number>({
    mutationFn: (contactId: number) =>
      customFetch<RevealResult>(`/api/credits/reveal/${contactId}`, { method: "POST" }),
    onSuccess: (_, contactId) => {
      queryClient.invalidateQueries({ queryKey: ["credits", "reveal-status", contactId] });
      queryClient.invalidateQueries({ queryKey: ["credits", "status"] });
    },
  });
}

export function useCompanyRevealStatus(companyId: number) {
  return useQuery<RevealStatus>({
    queryKey: ["credits", "company-reveal-status", companyId],
    queryFn: () => customFetch<RevealStatus>(`/api/credits/company-reveal-status/${companyId}`),
    enabled: !!companyId,
  });
}

export function useRevealCompany() {
  const queryClient = useQueryClient();
  return useMutation<RevealResult, Error, number>({
    mutationFn: (companyId: number) =>
      customFetch<RevealResult>(`/api/credits/reveal-company/${companyId}`, { method: "POST" }),
    onSuccess: (_, companyId) => {
      queryClient.invalidateQueries({ queryKey: ["credits", "company-reveal-status", companyId] });
      queryClient.invalidateQueries({ queryKey: ["credits", "status"] });
    },
  });
}
