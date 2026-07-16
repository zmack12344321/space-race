import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_GAME_SETTINGS = {
  masterVolume: 0.85,
  sfxVolume: 0.9,
  renderPreset: "balanced", // "performance" | "balanced" | "quality" | "custom"
  aaMode: "multisample4", // "renderer" | "multisample4" | "multisample8" | "smaa" | "off"
  dprCap: 1.75,
  adaptiveDpr: true,
  starsMode: "lean", // "off" | "lean" | "full"
};

const RENDER_PRESETS = {
  performance: {
    renderPreset: "performance",
    aaMode: "off",
    dprCap: 1.25,
    adaptiveDpr: true,
    starsMode: "off",
  },
  balanced: {
    renderPreset: "balanced",
    aaMode: "multisample4",
    dprCap: 1.75,
    adaptiveDpr: true,
    starsMode: "lean",
  },
  quality: {
    renderPreset: "quality",
    aaMode: "multisample8",
    dprCap: 2,
    adaptiveDpr: true,
    starsMode: "full",
  },
};

export const useGameSettings = create(
  persist(
    (set, get) => ({
      ...DEFAULT_GAME_SETTINGS,
      setSetting: (key, value) => set({ [key]: value }),
      applyRenderPreset: (preset) => {
        const next = RENDER_PRESETS[preset] ?? RENDER_PRESETS.balanced;
        set({ ...next, renderPreset: preset in RENDER_PRESETS ? preset : "custom" });
      },
      markCustomRender: () => {
        if (get().renderPreset !== "custom") set({ renderPreset: "custom" });
      },
      reset: () => set({ ...DEFAULT_GAME_SETTINGS }),
    }),
    {
      name: "space-race-game-settings",
      partialize: (state) => ({
        masterVolume: state.masterVolume,
        sfxVolume: state.sfxVolume,
        renderPreset: state.renderPreset,
        aaMode: state.aaMode,
        dprCap: state.dprCap,
        adaptiveDpr: state.adaptiveDpr,
        starsMode: state.starsMode,
      }),
    }
  )
);
