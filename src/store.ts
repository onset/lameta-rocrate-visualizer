import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsStore {
  renderer: "default" | "elk";
  lastFilePath: string;
  hiddenTypes: Set<string>;
  showRootDataset: boolean;
  showNeighborhoodOnly: boolean;
  setRenderer: (renderer: "default" | "elk") => void;
  setLastFilePath: (path: string) => void;
  toggleType: (type: string) => void;
  isTypeVisible: (type: string) => boolean;
  toggleRootDataset: () => void;
  toggleNeighborhoodOnly: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      renderer: "default",
      lastFilePath: "",
      hiddenTypes: new Set<string>(),
      showRootDataset: true,
      showNeighborhoodOnly: false,

      setRenderer: (renderer) => set({ renderer }),

      setLastFilePath: (path) => set({ lastFilePath: path }),

      toggleType: (type) =>
        set((state) => {
          const newHidden = new Set(state.hiddenTypes);
          if (newHidden.has(type)) {
            newHidden.delete(type);
          } else {
            newHidden.add(type);
          }
          return { hiddenTypes: newHidden };
        }),

      isTypeVisible: (type) => !get().hiddenTypes.has(type),

      toggleRootDataset: () =>
        set((state) => ({ showRootDataset: !state.showRootDataset })),

      toggleNeighborhoodOnly: () =>
        set((state) => ({ showNeighborhoodOnly: !state.showNeighborhoodOnly }))
    }),
    {
      name: "rocrate-visualizer-settings",
      partialize: (state) => ({
        renderer: state.renderer,
        lastFilePath: state.lastFilePath,
        hiddenTypes: Array.from(state.hiddenTypes),
        showRootDataset: state.showRootDataset,
        showNeighborhoodOnly: state.showNeighborhoodOnly
      }),
      merge: (persistedState: unknown, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<SettingsStore>),
        hiddenTypes: new Set((persistedState as any)?.hiddenTypes || [])
      })
    }
  )
);
