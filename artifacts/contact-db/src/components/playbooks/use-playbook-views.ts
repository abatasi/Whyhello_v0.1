import { useEffect, useState } from "react";
import { copyConfig, DEFAULT_VIEW, validateConfig, type ViewConfig } from "./list-model";

export interface SavedView { id: string; name: string; config: ViewConfig }
interface Store { owner: string; views: SavedView[]; selected: string }

export function usePlaybookViews(owner: string) {
  const key = `whyhello:playbook-views:${owner}`;
  const [store, setStore] = useState<Store>({ owner: "", views: [], selected: "all" });
  const [storageError, setStorageError] = useState("");
  const load = (): Store => {
    const raw = localStorage.getItem(key);
    if (!raw) return { owner, views: [], selected: "all" };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.views)) throw new Error("Saved views could not be read.");
    const views = parsed.views.filter((view: SavedView) => typeof view.id === "string" && typeof view.name === "string")
      .map((view: SavedView) => ({ id: view.id, name: view.name, config: validateConfig(view.config) }));
    return { owner, views, selected: views.some((view: SavedView) => view.id === parsed.selected) ? parsed.selected : "all" };
  };
  useEffect(() => {
    if (!owner) return;
    const restore = () => {
      try { setStore(load()); setStorageError(""); }
      catch { setStore({ owner, views: [], selected: "all" }); setStorageError("Saved views are unavailable. Browser storage may be blocked or damaged."); }
    };
    restore();
    const sync = (event: StorageEvent) => { if (event.key === key) restore(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, owner]);

  const current = store.owner === owner ? store : { owner, views: [], selected: "all" };
  const commit = (next: Store) => {
    if (!owner) throw new Error("Sign in before saving a view.");
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, views: next.views, selected: next.selected }));
      setStore(next); setStorageError("");
    } catch { throw new Error("The view could not be saved. Browser storage is unavailable."); }
  };
  return {
    views: current.views, selected: current.selected, ready: store.owner === owner, storageError,
    initialConfig: copyConfig(current.views.find(view => view.id === current.selected)?.config ?? DEFAULT_VIEW),
    select: (id: string) => commit({ ...current, selected: id }),
    save: (name: string, config: ViewConfig) => {
      const view = { id: crypto.randomUUID(), name: name.trim(), config: copyConfig(config) };
      commit({ ...current, views: [...current.views, view], selected: view.id }); return view.id;
    },
    rename: (id: string, name: string) => commit({ ...current, views: current.views.map(view => view.id === id ? { ...view, name: name.trim() } : view) }),
    duplicate: (id: string) => {
      const view = current.views.find(view => view.id === id);
      if (view) commit({ ...current, views: [...current.views, { ...view, id: crypto.randomUUID(), name: `${view.name} copy`, config: copyConfig(view.config) }] });
    },
    remove: (id: string) => commit({ ...current, views: current.views.filter(view => view.id !== id), selected: current.selected === id ? "all" : current.selected }),
  };
}