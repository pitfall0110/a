import { create } from "zustand";

export const useUser = create<{
    userId: string | null;
    setUserId(id: string): void;
}>((set) => ({
    userId: null,
    setUserId: (id) => {
        sessionStorage.setItem("currentUserId", id);
        set({ userId: id });
    },
}));
