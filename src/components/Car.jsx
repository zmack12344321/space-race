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

// Default per-board normalization (kept so the lobby's <Board> preview still
// positions correctly). The in-game <Car> passes these SAME values as literal
// props on each <Board> so Triplex can drag/tune them (see A8 / C2).
// longboard/surfboard are correct; skateboard/arcadia are best-guess.
const BOARD_CONFIG = {
  longboard: { scale: 1.0, rotationY: 0, position: [0, -0.113, 0] },
  surfboard_lucid_sn1: { scale: 1.125, rotationY: 0, position: [0, -0.558, 0] },
  skateboard: { scale: 6.517, rotationY: Math.PI / 2, position: [0, -0.704, 0] },
  arcadia_longboard: { scale: 0.0515, rotationY: Math.PI / 2, position: [0, -25.7, 0] },
};

export const Board = ({ model = "longboard", position, rotationY, scale, ...props }) => {
  const cfg = BOARD_CONFIG[model] ?? BOARD_CONFIG.longboard;
  const { scene } = useGLTF(`/models/boards/${model}-transformed.glb`, '/draco/');
  return (
    <group scale={scale ?? cfg.scale} rotation-y={rotationY ?? cfg.rotationY} position={position ?? cfg.position}>
      <Clone object={scene} castShadow {...props} />
    </group>
  );
};

export const Car = ({ model = CAR_MODELS[0], ...props }) => {
  const board = BOARD_MAP[model] ?? "longboard";
  return (
    <group {...props}>
      {/* Dog placement — literal transform so Triplex can drag/tune (A8) */}
      <group position={[0, 0, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
        <Dog />
      </group>
      {board === "longboard" && (
        <Board model="longboard" position={[0, -0.113, 0]} rotationY={0} scale={1.0} />
      )}
      {board === "skateboard" && (
        <Board model="skateboard" position={[0, -0.704, 0]} rotationY={Math.PI / 2} scale={6.517} />
      )}
      {board === "surfboard_lucid_sn1" && (
        <Board model="surfboard_lucid_sn1" position={[0, -0.558, 0]} rotationY={0} scale={1.125} />
      )}
      {board === "arcadia_longboard" && (
        <Board model="arcadia_longboard" position={[0, -25.7, 0]} rotationY={Math.PI / 2} scale={0.0515} />
      )}
    </group>
  );
};

Object.values(BOARD_MAP).forEach((model) => {
  useGLTF.preload(`/models/boards/${model}-transformed.glb`, '/draco/');
});

// Default export so Triplex can open this file directly as a preview target
// (the dog + board rider) for visual transform tuning (A8).
export default Car;
