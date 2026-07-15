import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_PLAYER_SETTINGS = {
  lookSensitivity: 1,
  invertLookY: true,
  invertLookX: false,
  invertSteering: false,
};

export const usePlayerSettings = create(
  persist(
    (set) => ({
      ...DEFAULT_PLAYER_SETTINGS,
      setSetting: (key, value) => set({ [key]: value }),
      reset: () => set({ ...DEFAULT_PLAYER_SETTINGS }),
    }),
    {
      name: "space-race-player-settings",
      partialize: (state) => ({
        lookSensitivity: state.lookSensitivity,
        invertLookY: state.invertLookY,
        invertLookX: state.invertLookX,
        invertSteering: state.invertSteering,
      }),
    }
  )
);
