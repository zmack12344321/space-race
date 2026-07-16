import { create } from "zustand";

// Local cannon heat. 0 = cold, 1 = overheated. Driven imperatively by
// RiderController each frame; read by the HUD.
export const useHeatStore = create((set) => ({
  heat: 0, // 0..1 (heat / OVERHEAT_TIME)
  overheated: false,
  set: ({ heat, overheated }) => set({ heat, overheated }),
  reset: () => set({ heat: 0, overheated: false }),
}));
