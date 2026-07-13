import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeBufferGeometries } from "three-stdlib";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getLunarHeight } from "../utils/lunarHeightfield";
import { Rock, ROCK_BASE_SCALE } from "./rocks/Rock";

// --- Tunables -------------------------------------------------------------
// Mirror LunarTerrain's chunk constants so rocks tile seamlessly with the
// ground underneath them.
const CHUNK_SIZE = 64;
const VISUAL_RADIUS = 4; // how many chunks out we draw rocks (matches terrain)
const PHYSICS_RADIUS = 1; // chunks within this ring get real colliders
const ROCKS_PER_CHUNK = 4; // deterministic rocks scattered per chunk
// Capacity per rock type: worst case every rock in view is one type.
const CAPACITY = (2 * VISUAL_RADIUS + 1) * (2 * VISUAL_RADIUS + 1) * ROCKS_PER_CHUNK;

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
function rockHash(x, z, salt = 0) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(z | 0, 668265263) ^
    Math.imul(1337 + salt, 1442695041);
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
      if (!material) material = o.material;
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
function computeField(cx, cz) {
  const far = {};
  ROCK_TYPES.forEach((t) => (far[t] = []));
  const near = [];

  for (let dz = -VISUAL_RADIUS; dz <= VISUAL_RADIUS; dz++) {
    for (let dx = -VISUAL_RADIUS; dx <= VISUAL_RADIUS; dx++) {
      const chx = cx + dx;
      const chz = cz + dz;
      const ring = Math.max(Math.abs(dx), Math.abs(dz));

      for (let i = 0; i < ROCKS_PER_CHUNK; i++) {
        const lx = rockHash(chx, chz, i * 131 + 1);
        const lz = rockHash(chx, chz, i * 131 + 2);
        const worldX = chx * CHUNK_SIZE + lx * CHUNK_SIZE;
        const worldZ = chz * CHUNK_SIZE + lz * CHUNK_SIZE;
        const type = 1 + Math.floor(rockHash(chx, chz, i * 131 + 3) * 7);
        // Refined size curve: heavily biased SMALL (pebbles) with rare boulders,
        // instead of a uniform 1–2× dog that read as "too big" across the map.
        // rand^2.8 pushes most rocks toward the low end; range ≈ 0.15×–1.5× dog.
        const sizeRand = rockHash(chx, chz, i * 131 + 4);
        const scale = ROCK_BASE_SCALE * (0.15 + 1.35 * Math.pow(sizeRand, 2.8));
        const ry = rockHash(chx, chz, i * 131 + 5) * Math.PI * 2;
        const y = getLunarHeight(worldX, worldZ) + ROCK_Y_OFFSET;

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

export function LunarRocks() {
  const camera = useThree((state) => state.camera);
  const cameraWorldPosition = useRef(new THREE.Vector3());
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
    camera.getWorldPosition(cameraWorldPosition.current);
    const x = Math.floor(cameraWorldPosition.current.x / CHUNK_SIZE);
    const z = Math.floor(cameraWorldPosition.current.z / CHUNK_SIZE);
    if (x !== centerRef.current.x || z !== centerRef.current.z) {
      centerRef.current = { x, z };
      setCenter(centerRef.current);
    }
  });

  const { far, near } = useMemo(() => computeField(center.x, center.z), [center]);

  // Push far-rock placements into one InstancedMesh per type (1 draw call each).
  useLayoutEffect(() => {
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
      mesh.computeBoundingSphere();
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
