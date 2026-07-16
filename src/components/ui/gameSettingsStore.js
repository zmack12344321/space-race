import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_GAME_SETTINGS = {
  quality: "high", // "low" | "medium" | "high"
  shadows: true,
  bloom: true,
  particles: true,
  screenShake: true,
};

export const useGameSettings = create(
  persist(
    (set) => ({
      ...DEFAULT_GAME_SETTINGS,
      setSetting: (key, value) => set({ [key]: value }),
      reset: () => set({ ...DEFAULT_GAME_SETTINGS }),
    }),
    {
      name: "space-race-game-settings",
      partialize: (state) => ({
        quality: state.quality,
        shadows: state.shadows,
        bloom: state.bloom,
        particles: state.particles,
        screenShake: state.screenShake,
      }),
    }
  )
);
