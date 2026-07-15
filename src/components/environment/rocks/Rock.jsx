import { useEffect, useRef } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";

// One optimized, draco-compressed .glb per rock (generated from
// _assets-to-import/moon_rock_0N_1k.gltf via gltf-transform --compress draco).
const ROCK_PATHS = {
  1: "/models/rocks/moon_rock_01-transformed.glb",
  2: "/models/rocks/moon_rock_02-transformed.glb",
  3: "/models/rocks/moon_rock_03-transformed.glb",
  4: "/models/rocks/moon_rock_04-transformed.glb",
  5: "/models/rocks/moon_rock_05-transformed.glb",
  6: "/models/rocks/moon_rock_06-transformed.glb",
  7: "/models/rocks/moon_rock_07-transformed.glb",
};

// The rock GLBs are modelled at a tiny native scale (~1/76 of a "dog" unit), so
// this multiplier makes `scale={1}` ≈ dog-sized and `scale={1..2}` ≈ 1–2× dog.
export const ROCK_BASE_SCALE = 76;

/**
 * A single lunar rock. Position / rotation / scale are passed straight through
 * to the wrapping <group>, so Triplex shows them as editable transform handles.
 * Drag/scale any placed rock live in the editor.
 *
 * @typedef {Object} RockProps
 * @property {1|2|3|4|5|6|7|string} [model=1] - Rock variant (1-7) or a raw
 *   filename key like "moon_rock_03" (resolved to /models/rocks/<key>-transformed.glb).
 * @property {[number,number,number]} [position=[0,0,0]] - World position.
 * @property {[number,number,number]} [rotation=[0,0,0]] - Euler rotation (radians).
 * @property {number|number[]} [scale=1] - Uniform or per-axis scale.
 * @property {boolean} [colliders=false] - Add a Rapier hull collider when near
 *   the player. Requires a <Physics> ancestor (the driving scene), not the lobby.
 */

/**
 * @param {RockProps} props
 */
export function Rock({
  model = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  colliders = false,
  ...props
}) {
  const path =
    typeof model === "number" ? ROCK_PATHS[model] : `/models/rocks/${model}-transformed.glb`;
  const { scene } = useGLTF(path, "/draco/");
  const groupRef = useRef();

  useEffect(() => {
    scene.traverse((c) => {
      if (c.isMesh && c.material) {
        c.material.color.set("#7f8bad");
      }
    });
  }, [scene]);

  // The parent LunarRocks already culls rocks that are outside the PHYSICS_RADIUS.
  // If we receive the colliders prop, we are guaranteed to be "near" the player.
  const body = colliders ? (
    <RigidBody type="fixed" colliders="hull" includeInvisible={false}>
      <Clone object={scene} castShadow receiveShadow />
    </RigidBody>
  ) : (
    <Clone object={scene} castShadow receiveShadow />
  );

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale} {...props}>
      {body}
    </group>
  );
}

// Preload every rock so they pop in without a fetch hitch.
Object.values(ROCK_PATHS).forEach((p) => useGLTF.preload(p, "/draco/"));
