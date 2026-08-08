import { createContext, useContext, useState, ReactNode } from "react";

export type AppMode = "peacetime" | "wartime";

interface AppModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

const STORAGE_KEY = "whyhello-app-mode";

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "wartime" ? "wartime" : "peacetime";
    } catch {
      return "peacetime";
    }
  });

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {}
  };

  const toggleMode = () => setMode(mode === "peacetime" ? "wartime" : "peacetime");

  return (
    <AppModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within AppModeProvider");
  return ctx;
}
