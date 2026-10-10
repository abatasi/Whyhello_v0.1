export type AutosaveState = "saved" | "pending" | "saving" | "error";

/** One writer per editor: acknowledgments belong to the exact snapshot sent. */
export class PlaybookAutosaveQueue {
  latest: string;
  confirmed: string;
  state: AutosaveState = "saved";
  private flight: Promise<boolean> | null = null;
  constructor(initial: string, private save: (snapshot: string) => Promise<boolean>, private changed: () => void = () => {}) {
    this.latest = this.confirmed = initial;
  }
  update(snapshot: string) {
    this.latest = snapshot;
    if (this.state !== "saving") this.state = snapshot === this.confirmed ? "saved" : "pending";
    this.changed();
  }
  flush(): Promise<boolean> {
    if (this.flight) return this.flight;
    if (this.latest === this.confirmed) return Promise.resolve(true);
    this.flight = this.run().finally(() => { this.flight = null; });
    return this.flight;
  }
  private async run(): Promise<boolean> {
    while (this.latest !== this.confirmed) {
      const sent = this.latest;
      this.state = "saving";
      this.changed();
      let saved = false;
      try { saved = await this.save(sent); } catch { /* Keep the latest snapshot available for retry. */ }
      if (!saved) {
        this.state = "error";
        this.changed();
        return false;
      }
      this.confirmed = sent;
      this.changed();
    }
    this.state = "saved";
    this.changed();
    return true;
  }
}

export function autosaveLabel(state: AutosaveState, dirty: boolean): string {
  if (state === "error") return "Couldn't auto-save. Retry to sync your changes.";
  return dirty || state === "pending" || state === "saving" ? "Saving changes…" : "All changes saved";
}
