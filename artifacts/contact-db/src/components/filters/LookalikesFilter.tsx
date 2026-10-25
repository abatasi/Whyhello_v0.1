import { useState } from "react";
import { useDebounce } from "use-debounce";
import { Search as SearchIcon } from "lucide-react";
import {
  useListContacts, getListContactsQueryKey, useGetContact, getGetContactQueryKey,
} from "@workspace/api-client-react";

interface Props {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}

const btn = "text-[11px] text-muted-foreground underline hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function LookalikesFilter({ value, onChange }: Props) {
  const id = value && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
  const [changing, setChanging] = useState(false);
  const [q, setQ] = useState("");
  const [dq] = useDebounce(q.trim(), 300);
  const typing = q.trim().length > 0;

  const seed = useGetContact(id ?? 0, {
    query: { queryKey: getGetContactQueryKey(id ?? 0), enabled: id !== undefined, retry: false },
  });
  const params = { search: dq, limit: 10 };
  const results = useListContacts(params, {
    query: { queryKey: getListContactsQueryKey(params), enabled: (id === undefined || changing) && dq.length > 0 },
  });
  const rows = results.data?.data ?? [];
  const busy = typing && (results.isFetching || q.trim() !== dq);

  const showSeed = id !== undefined && !changing;
  const pick = (cid: number) => { onChange(String(cid)); setChanging(false); setQ(""); };

  return (
    <div className="space-y-2" data-testid="lookalikes-filter">
      <p className="text-xs text-muted-foreground">Choose a contact to find similar people already in the app.</p>
      <p className="text-[11px] text-muted-foreground">Matches are based on role, department, seniority and company profile.</p>
      {showSeed && (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs" data-testid="lookalikes-seed">
          {seed.isLoading && <div className="h-8 animate-pulse rounded bg-muted" aria-label="Loading contact" />}
          {seed.isError && (
            <div role="alert" className="space-y-1">
              <p className="text-foreground">Couldn't load the selected contact.</p>
              <div className="flex gap-3">
                <button type="button" className={btn} onClick={() => seed.refetch()} data-testid="lookalikes-retry">Retry</button>
                <button type="button" className={btn} onClick={() => onChange(undefined)}>Remove</button>
              </div>
            </div>
          )}
          {seed.data && (
            <>
              <p className="font-semibold text-foreground" data-testid="lookalikes-seed-name">{seed.data.firstName} {seed.data.lastName}</p>
              <p className="text-muted-foreground">{[seed.data.jobTitle, seed.data.company?.name].filter(Boolean).join(" · ") || "No title or company"}</p>
              <div className="mt-1 flex gap-3">
                <button type="button" className={btn} onClick={() => setChanging(true)} data-testid="lookalikes-change">Change</button>
                <button type="button" className={btn} onClick={() => onChange(undefined)} data-testid="lookalikes-remove">Remove</button>
              </div>
            </>
          )}
        </div>
      )}
      {!showSeed && (
        <div className="space-y-2">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts by name"
              aria-label="Search for a reference contact" data-testid="lookalikes-search"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
          </div>
          {changing && (
            <button type="button" className={btn} onClick={() => { setChanging(false); setQ(""); }}>Cancel</button>
          )}
          {busy && <div className="h-8 animate-pulse rounded bg-muted" />}
          {typing && !busy && results.isError && (
            <div role="alert" className="text-xs text-muted-foreground">
              Search failed. <button type="button" className={btn} onClick={() => results.refetch()}>Retry</button>
            </div>
          )}
          {typing && !busy && !results.isError && results.data && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">No contacts found.</p>
          )}
          {typing && !busy && rows.length > 0 && (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pick(c.id)} data-testid={`lookalikes-option-${c.id}`}
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <span className="block font-medium text-foreground">{c.firstName} {c.lastName}</span>
                    <span className="block truncate text-muted-foreground">{[c.jobTitle, c.companyName].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
