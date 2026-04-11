import { create } from "zustand";

interface UpgradeState {
    isOpen: boolean;
    featureRequested: string | null;
    openModal: (feature: string) => void;
    closeModal: () => void;
}

export const useUpgradeStore = create<UpgradeState>((set) => ({
    isOpen: false,
    featureRequested: null,
    openModal: (feature) => set({ isOpen: true, featureRequested: feature }),
    closeModal: () => set({ isOpen: false, featureRequested: null }),
}));
