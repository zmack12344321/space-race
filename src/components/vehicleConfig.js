// Vehicle configuration — kept out of Rider.jsx so the Triplex-edited scene
// file exports ONLY its single component (no Component Switcher clutter).
//
// A "vehicle" is whatever the dog rides: a board, a UFO, a go-kart, etc.
// - VEHICLE_MODELS:     selectable slot ids shown in the UI selector (also used
//                       as thumbnail filenames under public/images/vehicles/).
// - VEHICLE_MAP:        slot id -> vehicle GLB id (file in public/models/vehicles/).
// - VEHICLE_GLB_MODELS: every vehicle GLB id (used for preload).
// - VEHICLE_TRANSFORMS: per-GLB placement on the rider (scale/rotation/position),
//                       tuned live in Triplex via Rider.jsx.
// - VEHICLE_SPEEDS:     per slot id driving speed.

export const VEHICLE_MODELS = [
  "sedanSports",
  "raceFuture",
  "taxi",
  "ambulance",
  "police",
  "truck",
  "firetruck",
  "ufo",
  "goKart",
];

export const VEHICLE_MAP = {
  sedanSports: "longboard",
  raceFuture: "skateboard",
  taxi: "surfboard_lucid_sn1",
  ambulance: "arcadia_longboard",
  police: "longboard",
  truck: "skateboard",
  firetruck: "arcadia_longboard",
  ufo: "ufo_flying_saucer_spaceship_ovni",
  goKart: "go-kart",
};

export const VEHICLE_GLB_MODELS = [
  "longboard",
  "skateboard",
  "surfboard_lucid_sn1",
  "arcadia_longboard",
  "ufo_flying_saucer_spaceship_ovni",
  "go-kart",
];

// Placement of each vehicle GLB relative to the dog (Rider.jsx outer group is
// scaled 0.32 by the controller). Board values are tuning from earlier passes;
// ufo/go-kart are best-guesses — tune live in Triplex.
export const VEHICLE_TRANSFORMS = {
  longboard: { scale: [1.42, 1.42, 1.42], rotation: [0, 0, 0], position: [0, 0.84, 0] },
  skateboard: { scale: [6.517, 6.517, 6.517], rotation: [0, Math.PI / 2, 0], position: [0, -0.704, 0] },
  surfboard_lucid_sn1: { scale: [1.125, 1.125, 1.125], rotation: [0, 0, 0], position: [0, -0.558, 0] },
  arcadia_longboard: { scale: [0.0515, 0.0515, 0.0515], rotation: [0, Math.PI / 2, 0], position: [0, -25.7, 0] },
  ufo_flying_saucer_spaceship_ovni: { scale: [0.012, 0.012, 0.012], rotation: [0, 0, 0], position: [0, 0.7, 0] },
  "go-kart": { scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0.5, 0] },
};

export const VEHICLE_SPEEDS = {
  sedanSports: 4,
  raceFuture: 2,
  taxi: 5.5,
  ambulance: 8.5,
  police: 5.5,
  truck: 4.8,
  firetruck: 10,
  ufo: 6,
  goKart: 5,
};
