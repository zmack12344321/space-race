import { create } from "zustand";

export const useRaceCourseStore = create((set) => ({
  markers: [],
  setMarkers: (markers) => set({ markers }),
}));
