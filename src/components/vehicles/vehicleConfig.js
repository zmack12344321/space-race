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
  "longboard",
  "skateboard",
  "arcadiaBoard",
  "goKart",
  "surfboard_lucid_sn1",
  "ufo",
];

export const VEHICLE_MAP = {
  longboard: "longboard",
  skateboard: "skateboard",
  surfboard_lucid_sn1: "surfboard_lucid_sn1",
  arcadiaBoard: "arcadia_longboard",
  ufo: "ufo",
  goKart: "go-kart",
};

export const VEHICLE_THUMBNAILS = {};

export const VEHICLE_GLB_MODELS = [
  "longboard",
  "skateboard",
  "surfboard_lucid_sn1",
  "arcadia_longboard",
  "ufo",
  "go-kart",
];

export const VEHICLE_SPEEDS = {
  longboard: 4,
  skateboard: 2,
  surfboard_lucid_sn1: 5.5,
  arcadiaBoard: 8.5,
  ufo: 6,
  goKart: 5,
};
