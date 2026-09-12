"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_API_URL } from "@/lib/constants";

export type ThemeMode = "light" | "dark" | "auto";

interface FilterDefaults {
  axisCount: 1 | 3 | 4;
  processNoiseScale: number;
  measurementNoiseScale: number;
  nParticles: number;
  resampleThreshold: number | null;
  useCorrelationInit: boolean;
}

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;

  apiUrl: string;
  setApiUrl: (url: string) => void;

  refreshIntervalMs: number;
  setRefreshIntervalMs: (v: number) => void;

  filterDefaults: FilterDefaults;
  setFilterDefaults: (partial: Partial<FilterDefaults>) => void;
  resetFilterDefaults: () => void;
}

const DEFAULT_FILTERS: FilterDefaults = {
  axisCount: 4,
  processNoiseScale: 1.0,
  measurementNoiseScale: 1.0,
  nParticles: 1000,
  resampleThreshold: null,
  useCorrelationInit: true,
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      theme: "auto",
      setTheme: (t) => set({ theme: t }),

      apiUrl: DEFAULT_API_URL,
      setApiUrl: (url) => {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("nv-nav-api-url", url);
        }
        set({ apiUrl: url });
      },

      refreshIntervalMs: 15000,
      setRefreshIntervalMs: (v) => set({ refreshIntervalMs: v }),

      filterDefaults: DEFAULT_FILTERS,
      setFilterDefaults: (partial) =>
        set((s) => ({ filterDefaults: { ...s.filterDefaults, ...partial } })),
      resetFilterDefaults: () => set({ filterDefaults: DEFAULT_FILTERS }),
    }),
    { name: "nv-nav-ui-store" }
  )
);
