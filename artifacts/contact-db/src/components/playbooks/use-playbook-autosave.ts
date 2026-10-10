import { useEffect, useRef, useState } from "react";
import { PlaybookAutosaveQueue, type AutosaveState } from "./playbook-autosave-model";

export function usePlaybookAutosave({ value, initialSaved, storageKey, enabled, onSave, onSaved }: {
  value: string; initialSaved: string; storageKey: string; enabled: boolean;
  onSave: (snapshot: string) => Promise<boolean>; onSaved: (snapshot: string) => void;
}) {
  const callbacks = useRef({ onSave, onSaved });
  callbacks.current = { onSave, onSaved };
  const mounted = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const latest = useRef(value);
  latest.current = value;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<AutosaveState>("saved");
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const queue = useRef<PlaybookAutosaveQueue | null>(null);
  const writeRecovery = () => {
    if (!enabledRef.current) return;
    try {
      localStorage.setItem(storageKey, latest.current);
      if (latest.current !== queue.current!.confirmed) localStorage.setItem(`${storageKey}_pending`, queue.current!.confirmed);
      else localStorage.removeItem(`${storageKey}_pending`);
      if (mounted.current) setHasLocalDraft(true);
    } catch {
      if (mounted.current) setHasLocalDraft(false);
    }
  };
  if (!queue.current) queue.current = new PlaybookAutosaveQueue(initialSaved,
    snapshot => callbacks.current.onSave(snapshot), () => {
      writeRecovery();
      if (mounted.current) {
        setState(queue.current!.state);
        callbacks.current.onSaved(queue.current!.confirmed);
      }
    });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (enabledRef.current) {
        queue.current!.update(latest.current);
        writeRecovery();
        void queue.current!.flush();
      }
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    queue.current!.update(value);
    writeRecovery();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void queue.current!.flush(); }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, enabled]);
  const flush = () => {
    if (!enabledRef.current) return Promise.resolve(true);
    if (timer.current) clearTimeout(timer.current);
    queue.current!.update(latest.current);
    writeRecovery();
    return queue.current!.flush();
  };
  return { state, hasLocalDraft, flush };
}
