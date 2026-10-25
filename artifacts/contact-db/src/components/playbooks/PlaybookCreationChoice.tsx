import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { ArrowLeft, Check, LayoutTemplate, PencilRuler, Users } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { BUYING_CENTER_SEATS, SINGLE_CONTACT, configuredBuyingCenterSeats, type ContactModeChoice } from "./contact-mode-model";
import { PlaybookDialog } from "./PlaybookDialog";

type BuildMethod = "scratch" | "template";
type ProfileCenter = { id: string; name: string; seats: string[] };
type HqProfile = {
  buyingCenters?: { id?: string; name?: string; seats?: unknown[] }[];
  buyingCenter?: unknown[];
  liveBuyingCenterId?: string | null;
};

export function PlaybookCreationChoice({ onScratch, onTemplate, onClose }: {
  onScratch: (choice: ContactModeChoice) => void;
  onTemplate: (choice: ContactModeChoice) => void;
  onClose: () => void;
}) {
  const { user, isLoaded } = useUser();
  const [method, setMethod] = useState<BuildMethod | null>(null);
  const [stage, setStage] = useState<"method" | "mode" | "seats">("method");
  const [selectedSeats, setSelectedSeats] = useState<string[]>(["Economic Buyer"]);
  const [selectedCenterId, setSelectedCenterId] = useState("standard");
  const profileQuery = useQuery({
    queryKey: ["hq-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await apiFetch("/api/hq/profile");
      if (!response.ok) throw new Error("Your HQ Buying Center could not be loaded.");
      const body = await response.json() as { data?: HqProfile } | HqProfile | null;
      const profile: HqProfile | null | undefined = body && "data" in body
        ? (body as { data?: HqProfile }).data
        : body as HqProfile | null;
      if (!profile) return { centers: [] as ProfileCenter[], liveId: null as string | null };
      const centers = profile.buyingCenters?.length
        ? profile.buyingCenters.map((center, index) => ({
            id: String(center.id ?? `saved-${index}`),
            name: String(center.name ?? `Buying Center ${index + 1}`),
            seats: configuredBuyingCenterSeats(center.seats),
          }))
        : profile.buyingCenter?.length
          ? [{ id: "default", name: "Default Buying Center", seats: configuredBuyingCenterSeats(profile.buyingCenter) }]
          : [];
      return { centers, liveId: profile.liveBuyingCenterId ?? null };
    },
    staleTime: 60_000,
  });
  const centers = profileQuery.data?.centers ?? [];
  const profileLoading = !isLoaded || profileQuery.isLoading;
  const liveCenter = centers.find(center => center.id === profileQuery.data?.liveId);
  const chosenCenter = centers.find(center => center.id === selectedCenterId);
  const selectedMethodTitle = method === "scratch" ? "Build from scratch" : "Use a template";

  const onChoose = (choice: ContactModeChoice) => {
    if (method === "scratch") onScratch(choice);
    else if (method === "template") onTemplate(choice);
  };
  const standardSeats = useMemo(() => [...BUYING_CENTER_SEATS.slice(1)], []);
  const toggleSeat = (seat: string) => {
    setSelectedSeats(current => current.includes(seat) ? current.filter(value => value !== seat) : [...current, seat]);
  };
  const selectCenter = (id: string) => {
    setSelectedCenterId(id);
    const center = centers.find(item => item.id === id);
    setSelectedSeats(center ? center.seats.filter(seat => seat !== "Business Champion") : ["Economic Buyer"]);
  };
  const back = () => setStage(current => current === "seats" ? "mode" : "method");

  return <PlaybookDialog
    title={stage === "method" ? "Create playbook" : stage === "mode" ? "Choose contact workflow" : "Set up your Buying Center"}
    description={stage === "method" ? "Choose how to build your playbook." : stage === "mode" ? `First, ${selectedMethodTitle.toLowerCase()}. Next, choose who this playbook is for.` : "Each Buying Center seat gets its own outreach sequence."}
    onClose={onClose}
  >
    {stage !== "method" && <button type="button" data-testid="button-playbook-choice-back" onClick={back} className="mx-5 mt-3 inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ArrowLeft size={14} /> Back
    </button>}

    {stage === "method" && <div className="pb-creation-choices">
      <button type="button" className="pb-creation-choice" onClick={() => { setMethod("scratch"); setStage("mode"); }}>
        <span className="pb-creation-choice-icon"><PencilRuler size={40} strokeWidth={1.5} aria-hidden="true" /></span>
        <span className="pb-creation-choice-title">Build from scratch</span>
        <span className="pb-creation-choice-description">Start with a blank canvas and build your own outreach workflow.</span>
      </button>
      <button type="button" className="pb-creation-choice" onClick={() => { setMethod("template"); setStage("mode"); }}>
        <span className="pb-creation-choice-icon"><LayoutTemplate size={40} strokeWidth={1.5} aria-hidden="true" /></span>
        <span className="pb-creation-choice-title">Use a template</span>
        <span className="pb-creation-choice-description">Choose a ready-made playbook and customize it to fit your outreach.</span>
      </button>
    </div>}

    {stage === "mode" && <div className="grid gap-3 p-5 sm:grid-cols-2" role="group" aria-label="Contact mode">
      <button type="button" data-testid="button-single-contact-mode" onClick={() => onChoose(SINGLE_CONTACT)} className="group flex min-h-36 flex-col items-start gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:border-primary/60 hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid size-10 place-items-center rounded-md border border-border bg-secondary/60 text-foreground"><Users size={19} aria-hidden="true" /></span>
        <span className="text-sm font-semibold text-foreground">Single-Contact</span>
        <span className="text-xs leading-relaxed text-muted-foreground">Build one sequence for one contact at a time.</span>
      </button>
      <button type="button" data-testid="button-multi-contact-mode" onClick={() => setStage("seats")} className="group flex min-h-36 flex-col items-start gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:border-primary/60 hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid size-10 place-items-center rounded-md border border-border bg-secondary/60 text-foreground"><Users size={19} aria-hidden="true" /></span>
        <span className="text-sm font-semibold text-foreground">Multi-Contact</span>
        <span className="text-xs leading-relaxed text-muted-foreground">Create separate outreach sequences for a Buying Center.</span>
      </button>
    </div>}

    {stage === "seats" && <div className="space-y-4 px-5 pb-5 pt-3">
      <section aria-labelledby="bc-select-label">
        <label id="bc-select-label" htmlFor="playbook-buying-center" className="mb-1.5 block text-xs font-semibold text-foreground">Buying Center setup</label>
        {profileLoading ? <div className="h-9 animate-pulse rounded-md bg-secondary" aria-label="Loading Buying Center" /> :
          <select id="playbook-buying-center" data-testid="select-playbook-buying-center" disabled={profileLoading} value={selectedCenterId} onChange={event => selectCenter(event.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60">
            <option value="standard">Standard seat list</option>
            {centers.map(center => <option key={center.id} value={center.id}>{center.name}{center.id === liveCenter?.id ? " (live)" : ""}</option>)}
          </select>}
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{chosenCenter ? "Highlighted seats from this saved Buying Center are selected. Business Champion remains the lead; your live default is unchanged." : "Start with Business Champion and Economic Buyer, or choose a saved Buying Center. Most playbooks target 2–4 seats."}</p>
      </section>

      {profileQuery.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-foreground">
        <span>{profileQuery.error instanceof Error ? profileQuery.error.message : "Buying Center details could not be loaded."} Standard seats are available.</span>
        <button type="button" data-testid="button-retry-hq-profile" onClick={() => void profileQuery.refetch()} className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 font-semibold hover:bg-secondary">Retry</button>
      </div>}

      <div className="rounded-md border border-border bg-secondary/20">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Sequence seats</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">A separate sequence will be created for every seat.</p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[10px] font-semibold text-muted-foreground">{selectedSeats.length + 1} seats</span>
        </div>
        <div className="max-h-64 divide-y divide-border/60 overflow-y-auto">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid size-4 shrink-0 place-items-center rounded border border-primary bg-primary text-primary-foreground"><Check size={11} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">Business Champion</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Lead · always included</span>
          </div>
          {standardSeats.map(seat => <label key={seat} className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-secondary/50">
            <input type="checkbox" data-testid={`checkbox-buying-center-seat-${seat.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} checked={selectedSeats.includes(seat)} onChange={() => toggleSeat(seat)} className="size-3.5 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <span className="text-foreground">{seat}</span>
          </label>)}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground" aria-live="polite">{selectedSeats.length === 0 ? "Select at least one seat beyond the Business Champion." : `${selectedSeats.length + 1} separate sequences will be set up.`}</p>
        <button type="button" data-testid="button-continue-multi-contact" disabled={profileLoading || selectedSeats.length < 1} onClick={() => onChoose({ mode: "multi", seats: selectedSeats, ...(selectedCenterId !== "standard" ? { buyingCenterId: selectedCenterId } : {}) })} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground dark:bg-indigo-700 dark:border-indigo-700 dark:text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Continue <ArrowLeft size={13} className="rotate-180" aria-hidden="true" />
        </button>
      </div>
    </div>}
  </PlaybookDialog>;
}
