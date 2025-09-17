import { create } from "zustand";

export type Mode = "select" | "pan" | "place";
type Drawer = "list" | "details" | "closed";

export const useUI = create<{
    mode: Mode;
    drawer: Drawer;
    selectedTaskId?: string;
    zoom: number;
    pan: { x: number; y: number };
    setMode(m: Mode): void;
    openList(): void;
    openDetails(id: string): void;
    closeDrawer(): void;
    setZoom(z: number): void;
    setPan(p: { x: number; y: number }): void;
}>((set) => ({
    mode: "select",
    drawer: "list",
    zoom: 1,
    pan: { x: 0, y: 0 },
    setMode: (m) => set({ mode: m }),
    openList: () => set({ drawer: "list", selectedTaskId: undefined }),
    openDetails: (id) => set({ drawer: "details", selectedTaskId: id }),
    closeDrawer: () => set({ drawer: "closed" }),
    setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(8, z)) }),
    setPan: (p) => set({ pan: p }),
}));
