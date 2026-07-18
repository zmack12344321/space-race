import { create } from "zustand";

export const useRaceCourseStore = create((set) => ({
  markers: [],
  resetToken: 0,
  setMarkers: (markers) => set({ markers }),
  race: {
    startedAt: null,
    cleared: 0,
    running: false,
  },
  markGatePassed: () =>
    set((state) => ({
      race: {
        startedAt: state.race.startedAt ?? performance.now(),
        cleared: state.race.cleared + 1,
        running: true,
      },
    })),
  resetRace: () =>
    set((state) => ({
      race: {
        startedAt: null,
        cleared: 0,
        running: false,
      },
      markers: [],
      resetToken: state.resetToken + 1,
    })),
}));
