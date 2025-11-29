// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RenderMethod = "mermaid" | "tldraw";
export type LayoutAlgorithm = "dagre" | "elk" | "cola";

interface SettingsStore {
  direction: "LR" | "TB";
  lastFilePath: string;
  hiddenTypes: Set<string>;
  egoNodeId: string | null;
  showInverseLinks: boolean;
  renderMethod: RenderMethod;
  layoutAlgorithm: LayoutAlgorithm;
  setDirection: (direction: "LR" | "TB") => void;
  setLastFilePath: (path: string) => void;
  toggleType: (type: string) => void;
  isTypeVisible: (type: string) => boolean;
  setEgoNodeId: (id: string | null) => void;
  setShowInverseLinks: (show: boolean) => void;
  setRenderMethod: (method: RenderMethod) => void;
  setLayoutAlgorithm: (algorithm: LayoutAlgorithm) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      direction: "LR",
      lastFilePath: "",
      hiddenTypes: new Set<string>(),
      egoNodeId: null,
      showInverseLinks: false,
      renderMethod: "mermaid" as RenderMethod,
      layoutAlgorithm: "dagre" as LayoutAlgorithm,

      setDirection: (direction) => set({ direction }),

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

      setEgoNodeId: (id) => set({ egoNodeId: id }),

      setShowInverseLinks: (show) => set({ showInverseLinks: show }),

      setRenderMethod: (method) => set({ renderMethod: method }),
      setLayoutAlgorithm: (algorithm) => set({ layoutAlgorithm: algorithm }),    }),
    {
      name: "rocrate-visualizer-settings",
      partialize: (state) => ({
        direction: state.direction,
        lastFilePath: state.lastFilePath,
        hiddenTypes: Array.from(state.hiddenTypes),
        showInverseLinks: state.showInverseLinks,
        renderMethod: state.renderMethod,
        layoutAlgorithm: state.layoutAlgorithm,
      }),
      merge: (persistedState: unknown, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<SettingsStore>),
        hiddenTypes: new Set((persistedState as any)?.hiddenTypes || []),
      }),
    }
  )
);
