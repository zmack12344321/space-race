import { create } from "zustand";

// Local player's combat state. Lives only on this client; broadcast to others
// via playerState("health", ...) when it changes.
export const useHealthStore = create((set, get) => ({
  health: 100,
  maxHealth: 100,
  stunUntil: 0,
  setStunUntil: (t) => set({ stunUntil: t }),
  applyDamage: (amount) => {
    const next = Math.max(0, get().health - amount);
    set({ health: next });
    return next;
  },
  reset: () => set({ health: 100, stunUntil: 0 }),
  isStunned: (now) => now < get().stunUntil,
}));
