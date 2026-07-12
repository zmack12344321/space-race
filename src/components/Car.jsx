import { Clone, useGLTF } from "@react-three/drei";
import { Dog } from "./Dog";

export const CAR_MODELS = [
  "sedanSports",
  "raceFuture",
  "taxi",
  "ambulance",
  "police",
  "truck",
  "firetruck",
];

// Validation phase: keep the existing car slots/selector, but render a board
// under the dog for each slot. Swap this out for real board names in Phase B.
export const BOARD_MAP = {
  sedanSports: "longboard",
  raceFuture: "skateboard",
  taxi: "surfboard_lucid_sn1",
  ambulance: "arcadia_longboard",
  police: "longboard",
  truck: "skateboard",
  firetruck: "arcadia_longboard",
};

// Per-board normalize so each board is centered on X/Z, deck top at y=0, and
// length ~4.95 native units (~1.6 in-scene after the 0.32 scale in
// CarController). Computed from bounding-box measurements.
// longboard/surfboard are correct; skateboard/arcadia are best-guess and need
// a visual tune pass (see CHECKLIST step 5).
const BOARD_CONFIG = {
  longboard: { scale: 1.0, rotationY: 0, position: [0, -0.113, 0] },
  surfboard_lucid_sn1: { scale: 1.125, rotationY: 0, position: [0, -0.558, 0] },
  skateboard: { scale: 6.517, rotationY: Math.PI / 2, position: [0, -0.704, 0] },
  arcadia_longboard: { scale: 0.0515, rotationY: Math.PI / 2, position: [0, -25.7, 0] },
};

export const Board = ({ model = "longboard", ...props }) => {
  const { scene } = useGLTF(`/models/boards/${model}-transformed.glb`, true);
  const cfg = BOARD_CONFIG[model] ?? BOARD_CONFIG.longboard;
  return (
    <group scale={cfg.scale} rotation-y={cfg.rotationY} position={cfg.position}>
      <Clone object={scene} castShadow {...props} />
    </group>
  );
};

export const Car = ({ model = CAR_MODELS[0], ...props }) => {
  const board = BOARD_MAP[model] ?? "longboard";
  return (
    <group {...props}>
      <Dog />
      <Board model={board} />
    </group>
  );
};

Object.values(BOARD_MAP).forEach((model) => {
  useGLTF.preload(`/models/boards/${model}-transformed.glb`, true);
});
