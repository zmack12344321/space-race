import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeBufferGeometries } from "three-stdlib";
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition } from "react";
import * as THREE from "three";
import { getLunarHeight, getLunarSeed } from "../../utils/lunarHeightfield";
import { Rock, ROCK_BASE_SCALE } from "./rocks/Rock";

// --- Tunables -------------------------------------------------------------
// Mirror LunarTerrain's chunk constants so rocks tile seamlessly with the
// ground underneath them.
const CHUNK_SIZE = 64;
const VISUAL_RADIUS = 9; // Match LunarTerrain's DEFAULT_VISUAL_RADIUS so
                         // rocks and floor stream to the same distance.
const PHYSICS_RADIUS = 1; // chunks within this ring get real colliders
const ROCKS_PER_CHUNK = 4; // deterministic rocks scattered per chunk
// Capacity per rock type: worst case every rock in view is one type.
const CAPACITY = (2 * VISUAL_RADIUS + 1) * (2 * VISUAL_RADIUS + 1) * ROCKS_PER_CHUNK;
const fieldCache = new Map();

export function clearRockFieldCache() {
  fieldCache.clear();
}

const ROCK_TYPES = [1, 2, 3, 4, 5, 6, 7];
const ROCK_PATHS = {
  1: "/models/rocks/moon_rock_01-transformed.glb",
  2: "/models/rocks/moon_rock_02-transformed.glb",
  3: "/models/rocks/moon_rock_03-transformed.glb",
  4: "/models/rocks/moon_rock_04-transformed.glb",
  5: "/models/rocks/moon_rock_05-transformed.glb",
  6: "/models/rocks/moon_rock_06-transformed.glb",
  7: "/models/rocks/moon_rock_07-transformed.glb",
};

// Vertical nudge so rock bases plant into the surface (tweak if kits float/sink).
const ROCK_Y_OFFSET = 0;

// Deterministic, seed-matched hash (sibling of lunarHeightfield.hash2) so the
// same world coordinate always yields the same rock — no seams between chunks.
function rockHash(x, z, salt = 0, seed = getLunarSeed()) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(z | 0, 668265263) ^
    Math.imul(seed + salt, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Bake a glb's meshes into one geometry + material for InstancedMesh use.
function extractRock(scene) {
  scene.updateWorldMatrix(true, true);
  const geometries = [];
  let material = null;
  scene.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      geometries.push(g);
      if (!material) {
        material = o.material.clone(); // Clone to prevent sharing bugs
        material.color.set("#7f8bad"); // Tint instanced rocks to match regolith
      }
    }
  });
  let geometry;
  try {
    geometry =
      geometries.length === 1
        ? geometries[0]
        : mergeBufferGeometries(geometries, false);
  } catch {
    geometry = geometries[0];
  }
  return { geometry, material };
}

function useRockAssets() {
  const s1 = useGLTF(ROCK_PATHS[1], "/draco/").scene;
  const s2 = useGLTF(ROCK_PATHS[2], "/draco/").scene;
  const s3 = useGLTF(ROCK_PATHS[3], "/draco/").scene;
  const s4 = useGLTF(ROCK_PATHS[4], "/draco/").scene;
  const s5 = useGLTF(ROCK_PATHS[5], "/draco/").scene;
  const s6 = useGLTF(ROCK_PATHS[6], "/draco/").scene;
  const s7 = useGLTF(ROCK_PATHS[7], "/draco/").scene;
  const scenes = [s1, s2, s3, s4, s5, s6, s7];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => scenes.map(extractRock), scenes);
}

// Build the full rock field for a chunk-center: deterministic placement, split
// into far (instanced, visual only) and near (collidable) sets.
function computeField(cx, cz, seed, radius = VISUAL_RADIUS, clearRadius = 0) {
  const far = {};
  ROCK_TYPES.forEach((t) => (far[t] = []));
  const near = [];

  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const chx = cx + dx;
      const chz = cz + dz;
      const ring = Math.max(Math.abs(dx), Math.abs(dz));

      for (let i = 0; i < ROCKS_PER_CHUNK; i++) {
        const lx = rockHash(chx, chz, i * 131 + 1, seed);
        const lz = rockHash(chx, chz, i * 131 + 2, seed);
        const worldX = chx * CHUNK_SIZE + lx * CHUNK_SIZE;
        const worldZ = chz * CHUNK_SIZE + lz * CHUNK_SIZE;
        if (clearRadius > 0 && Math.hypot(worldX, worldZ) < clearRadius) continue;
        const type = 1 + Math.floor(rockHash(chx, chz, i * 131 + 3, seed) * 7);
        // Shift the scale multiplier up significantly so rocks feel massive
        // like actual lunar boulders rather than small pebbles.
        // Range ≈ 0.5× – 3.0× dog size, more even distribution
        const sizeRand = rockHash(chx, chz, i * 131 + 4, seed);
        const scale = ROCK_BASE_SCALE * (0.5 + 2.5 * Math.pow(sizeRand, 2.0));
        const ry = rockHash(chx, chz, i * 131 + 5, seed) * Math.PI * 2;
        const y = getLunarHeight(worldX, worldZ, seed) + ROCK_Y_OFFSET;

        if (ring <= PHYSICS_RADIUS) {
          near.push({
            id: `${chx}:${chz}:${i}`,
            type,
            position: [worldX, y, worldZ],
            rotation: [0, ry, 0],
            scale,
          });
        } else {
          far[type].push([worldX, y, worldZ, ry, scale]);
        }
      }
    }
  }
  return { far, near };
}

function fieldKey(cx, cz, seed, radius, clearRadius) {
  return `${seed}:${cx}:${cz}:${radius}:${clearRadius}`;
}

function getCachedField(cx, cz, seed, radius, clearRadius) {
  const key = fieldKey(cx, cz, seed, radius, clearRadius);
  const cached = fieldCache.get(key);
  if (cached) return cached;
  const next = computeField(cx, cz, seed, radius, clearRadius);
  fieldCache.set(key, next);
  return next;
}

export function LunarRocks({ isStatic = false, staticRadius = 2, seed, clearRadius = 0, visualRadiusBoost = 0 }) {
  const camera = useThree((state) => state.camera);
  const cameraWorldPosition = useRef(new THREE.Vector3());
  const deferredVisualRadiusBoost = useDeferredValue(visualRadiusBoost);
  const [center, setCenter] = useState(() => ({
    x: Math.floor(camera.position.x / CHUNK_SIZE),
    z: Math.floor(camera.position.z / CHUNK_SIZE),
  }));
  const centerRef = useRef(center);
  const assets = useRockAssets();
  const refs = useRef({});
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Follow the camera like LunarTerrain does, so rocks stream with the ground.
  useFrame(() => {
    if (isStatic) return;
    camera.getWorldPosition(cameraWorldPosition.current);
    const x = Math.floor(cameraWorldPosition.current.x / CHUNK_SIZE);
    const z = Math.floor(cameraWorldPosition.current.z / CHUNK_SIZE);
    if (x !== centerRef.current.x || z !== centerRef.current.z) {
      centerRef.current = { x, z };
      startTransition(() => {
        setCenter(centerRef.current);
      });
    }
  });

  const { far, near } = useMemo(() => {
    const cx = isStatic ? 0 : center.x;
    const cz = isStatic ? 0 : center.z;
    return getCachedField(cx, cz, seed, (isStatic ? staticRadius : VISUAL_RADIUS) + deferredVisualRadiusBoost, clearRadius);
  }, [center, isStatic, seed, clearRadius, staticRadius, deferredVisualRadiusBoost]);

  // Push far-rock placements into one InstancedMesh per type (1 draw call each).
  useEffect(() => {
    ROCK_TYPES.forEach((t) => {
      const mesh = refs.current[t];
      if (!mesh) return;
      const list = far[t];
      for (let i = 0; i < list.length; i++) {
        const [x, y, z, ry, s] = list[i];
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, ry, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [far, dummy]);

  useEffect(() => {
    return () => {
      assets.forEach(({ geometry }) => geometry?.dispose?.());
    };
  }, [assets]);

  return (
    <group name="LunarRocks">
      {/* Far rocks: instanced (one draw call per rock type). */}
      {ROCK_TYPES.map((t) => (
        <instancedMesh
          key={t}
          ref={(el) => (refs.current[t] = el)}
          args={[assets[t - 1].geometry, assets[t - 1].material, CAPACITY]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      ))}

      {/* Near rocks: real colliders so you can bump into them. */}
      {near.map((rock) => (
        <Rock
          key={rock.id}
          name={`Rock_${rock.id}`}
          model={rock.type}
          position={rock.position}
          rotation={rock.rotation}
          scale={rock.scale}
          colliders
        />
      ))}
    </group>
  );
}

ROCK_TYPES.forEach((t) => useGLTF.preload(ROCK_PATHS[t], "/draco/"));
