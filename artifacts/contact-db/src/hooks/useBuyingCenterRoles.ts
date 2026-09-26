import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

/** Buying Center department choices are the names of the saved Roles. */
export function useBuyingCenterRoles() {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const found: string[] = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          const response = await apiFetch(`/api/roles?limit=100&page=${page}`);
          if (!response.ok) throw new Error("Could not load Roles");
          const result: { data: { name: string }[]; totalPages: number } = await response.json();
          found.push(...result.data.map(role => role.name));
          totalPages = result.totalPages;
          page++;
        }
        if (!cancelled) {
          setNames([...new Set(found)].sort((a, b) => a.localeCompare(b)));
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return { names, loading, error };
}