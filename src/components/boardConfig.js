// Slot/board configuration — kept out of Car.jsx so the Triplex-edited scene
// file exports ONLY its single component (no Component Switcher clutter).
export const CAR_MODELS = [
  "sedanSports",
  "raceFuture",
  "taxi",
  "ambulance",
  "police",
  "truck",
  "firetruck",
];

// Slot -> board mapping (A5).
export const BOARD_MAP = {
  sedanSports: "longboard",
  raceFuture: "skateboard",
  taxi: "surfboard_lucid_sn1",
  ambulance: "arcadia_longboard",
  police: "longboard",
  truck: "skateboard",
  firetruck: "arcadia_longboard",
};

export const BOARD_MODELS = [
  "longboard",
  "skateboard",
  "surfboard_lucid_sn1",
  "arcadia_longboard",
];
