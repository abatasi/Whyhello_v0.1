import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";

interface Enrollment {
  id: number; contactId: number; contactFirstName: string | null; contactLastName: string | null;
  companyName: string | null; contactJobTitle: string | null; status: string;
  enrolledAt: string | null; lastSentAt: string | null; currentStep: number;
}

export function BuilderEnrollmentData({ playbookId, mode }: {
  playbookId: number; mode: "contacts" | "activity" | "report";
}) {
  const qc = useQueryClient();
  const query = useQuery<Enrollment[]>({
    queryKey: ["playbook-enrollments", playbookId],
    queryFn: async () => {
      const response = await apiFetch(`/api/playbooks/${playbookId}/enrollments`);
      if (!response.ok) throw new Error("Enrolled contacts could not be loaded.");
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("The enrollment response was invalid.");
      return rows;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading recorded enrollments…</p>;
  if (query.isError) return <div role="alert" className="space-y-3 text-sm">
    <p>{query.error.message}</p><button type="button" className="rounded-md border border-border px-3 py-2" onClick={() => void query.refetch()}>Retry</button>
  </div>;
  const rows = query.data ?? [];
  const name = (row: Enrollment) => [row.contactFirstName, row.contactLastName].filter(Boolean).join(" ") || `Contact ${row.contactId}`;
  const date = (value: string) => new Date(value).toLocaleString();
  if (mode === "contacts") return rows.length ? <div className="overflow-x-auto rounded-lg border border-border">
    <table className="w-full text-left text-sm"><thead className="border-b border-border"><tr>
      {["Contact", "Company", "Status", "Enrolled"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}
    </tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-border last:border-0">
      <td className="px-4 py-3"><span className="font-medium">{name(row)}</span><span className="block text-xs text-muted-foreground">{row.contactJobTitle}</span></td>
      <td className="px-4 py-3">{row.companyName || "—"}</td><td className="px-4 py-3 capitalize">{row.status}</td><td className="px-4 py-3">{row.enrolledAt ? date(row.enrolledAt) : "—"}</td>
    </tr>)}</tbody></table>
  </div> : <p className="rounded-lg border border-border p-5 text-sm text-muted-foreground">No contacts are enrolled yet. Use Add Contacts to select contacts for this playbook.</p>;
  if (mode === "activity") {
    const events = rows.flatMap(row => [
      ...(row.enrolledAt ? [{ key: `enrolled-${row.id}`, at: row.enrolledAt, text: `${name(row)} enrolled` }] : []),
      ...(row.lastSentAt ? [{ key: `sent-${row.id}`, at: row.lastSentAt, text: `Most recent message sent to ${name(row)}` }] : []),
    ]).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return <section className="rounded-lg border border-border p-5">
      {events.length ? <ol className="divide-y divide-border">{events.map(event => <li key={event.key} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{event.text}</span><time className="text-xs text-muted-foreground" dateTime={event.at}>{date(event.at)}</time></li>)}</ol> : <p className="text-sm text-muted-foreground">No recorded activity yet.</p>}
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Shows recorded enrollments and each contact’s most recent sent message. A complete execution event log is not currently recorded.</p>
    </section>;
  }
  const meta = qc.getQueryData<{ id: number; sentCount?: number }[]>(["playbooks"])?.find(row => row.id === playbookId);
  const stats = [
    ["Enrolled contacts", rows.length],
    ["Active enrollments", rows.filter(row => row.status === "active").length],
    ["Completed enrollments", rows.filter(row => row.status === "completed").length],
    ["Messages sent", meta?.sentCount ?? "—"],
  ];
  return <section className="space-y-4">
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-xl font-semibold">{value}</dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">Sent is not delivered. Delivery, bounce, reply, and conversion outcomes are not currently recorded.</p>
  </section>;
}