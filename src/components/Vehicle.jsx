import { Clone, useGLTF } from "@react-three/drei";
import { BOARD_MODELS } from "./boardConfig";

// Loads + clones one board model with NO transform of its own — placement/scale
// is owned by the literal <group> that wraps <Board> in Car.jsx (single source
// of truth, edited live in Triplex). This file exports exactly one component.
export const Board = ({ model = "longboard", ...props }) => {
  const { scene } = useGLTF(`/models/boards/${model}-transformed.glb`, "/draco/");
  return (
    <group {...props}>
      <Clone object={scene} castShadow />
    </group>
  );
};

BOARD_MODELS.forEach((model) => {
  useGLTF.preload(`/models/boards/${model}-transformed.glb`, "/draco/");
});
