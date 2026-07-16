import { PerformanceMonitor } from "@react-three/drei";
import { MeshCollider, RigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import * as THREE from "three";
import { getLunarHeight, getLunarSeed } from "../../utils/lunarHeightfield";
import { NewMoonSky } from "./NewMoonSky";
import { useLunarMaterial } from "./useLunarMaterial";

import TerrainWorker from "../../workers/terrain.worker.js?worker";

const CHUNK_SIZE = 64;
const DEFAULT_VISUAL_RADIUS = 9;
const PHYSICS_RADIUS = 3;

const workers = [];
let nextId = 0;
const callbacks = new Map();

function getWorker() {
  if (workers.length === 0) {
    for (let i = 0; i < 4; i++) {
      const w = new TerrainWorker();
      w.onmessage = (e) => {
        const { id, positions, normals, indices } = e.data;
        const cb = callbacks.get(id);
        if (cb) {
          callbacks.delete(id);
          cb({ positions, normals, indices });
        }
      };
      workers.push(w);
    }
  }
  const w = workers.shift();
  workers.push(w);
  return w;
}

function generateChunkAsync(type, data) {
  return new Promise((resolve) => {
    const id = ++nextId;
    callbacks.set(id, resolve);
    const w = getWorker();
    w.postMessage({ id, type, data });
  });
}

function chunkKey(x, z) {
  return `${x}:${z}`;
}

function chunkRing(x, z, cx, cz) {
  return Math.max(Math.abs(x - cx), Math.abs(z - cz));
}

function segmentsForRing(ring, quality) {
  const q = quality < 0.45 ? 0.75 : 1;
  if (ring <= 2) return Math.round(40 * q);
  if (ring <= 4) return Math.round(30 * q);
  if (ring <= 6) return Math.round(20 * q);
  return Math.round(12 * q);
}

function LunarTerrainChunk({ chunkX, chunkZ, centerX, centerZ, material, quality, seed, heightOptions }) {
  const ring = chunkRing(chunkX, chunkZ, centerX, centerZ);
  const hasPhysics = ring <= PHYSICS_RADIUS;
  const segments = segmentsForRing(ring, quality);
  const worldX = chunkX * CHUNK_SIZE;
  const worldZ = chunkZ * CHUNK_SIZE;

  const [visualTerrain, setVisualTerrain] = useState(null);

  useEffect(() => {
    let active = true;
    generateChunkAsync("GENERATE_CHUNK", {
      CHUNK_SIZE,
      segments,
      worldX,
      worldZ,
      seed: seed ?? getLunarSeed(),
      heightOptions,
    }).then(({ positions, normals, indices }) => {
      if (!active) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(worldX, 0, worldZ);
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      setVisualTerrain(mesh);
    });
    return () => { active = false; };
  }, [material, segments, worldX, worldZ, seed, heightOptions]);

  const [physicsMesh, setPhysicsMesh] = useState(null);

  useEffect(() => {
    if (!hasPhysics) {
      setPhysicsMesh(null);
      return;
    }
    let active = true;
    generateChunkAsync("GENERATE_PHYSICS", {
      CHUNK_SIZE,
      segments: 8,
      worldX,
      worldZ,
      seed: seed ?? getLunarSeed(),
      heightOptions,
    }).then(({ positions, indices }) => {
      if (!active) return;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
      
      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ visible: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(worldX, 0, worldZ);
      setPhysicsMesh(mesh);
    });
    return () => { active = false; };
  }, [hasPhysics, worldX, worldZ, seed, heightOptions]);

  useEffect(() => {
    return () => {
      if (visualTerrain?.geometry) visualTerrain.geometry.dispose();
      if (physicsMesh?.geometry) physicsMesh.geometry.dispose();
      if (physicsMesh?.material) physicsMesh.material.dispose();
    };
  }, [visualTerrain, physicsMesh]);

  if (hasPhysics) {
    return (
      <group>
        {visualTerrain && <primitive object={visualTerrain} />}
        {physicsMesh && (
          <RigidBody type="fixed" colliders={false}>
            <MeshCollider type="trimesh">
              <primitive object={physicsMesh} />
            </MeshCollider>
          </RigidBody>
        )}
      </group>
    );
  }

  return visualTerrain ? <primitive object={visualTerrain} /> : null;
}

export function LunarSky({ skyMode = "blue", starsMode = "lean" } = {}) {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const prevFog = scene.fog;
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.0009);
    return () => {
      scene.fog = prevFog;
    };
  }, [scene]);

  return (
    <>
      {/* <SpaceBackdrop /> */}
      <NewMoonSky skyMode={skyMode} starsMode={starsMode} />
    </>
  );
}

export function LunarTerrain({ isStatic = false, staticRadius = 1, seed, heightOptions }) {
  const camera = useThree((state) => state.camera);
  const cameraWorldPosition = useRef(new THREE.Vector3());
  const [quality, setQuality] = useState(1);
  const [center, setCenter] = useState(() => ({
    x: Math.floor(camera.position.x / CHUNK_SIZE),
    z: Math.floor(camera.position.z / CHUNK_SIZE),
  }));
  const centerRef = useRef(center);

  useFrame(() => {
    if (isStatic) return; // Don't track camera in static mode (lobby)
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

  const material = useLunarMaterial();

  useEffect(
    () => () => {
      material.dispose();
    },
    [material]
  );

  const chunks = useMemo(() => {
    // If static, only generate a fixed 3x3 grid centered at 0
    const radius = isStatic ? staticRadius : (quality < 0.35 ? 3 : DEFAULT_VISUAL_RADIUS);
    const list = [];
    const cx = isStatic ? 0 : center.x;
    const cz = isStatic ? 0 : center.z;
    for (let z = cz - radius; z <= cz + radius; z++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        list.push({ x, z, key: chunkKey(x, z) });
      }
    }
    return list;
  }, [center, quality, isStatic, staticRadius]);

  return (
    <>
      <PerformanceMonitor onChange={({ factor }) => setQuality(factor)} />
      <group name="InfiniteLunarTerrain">
        <mesh 
          name="TerrainUnderlay" 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[center.x * CHUNK_SIZE, -44, center.z * CHUNK_SIZE]}
        >
          <planeGeometry args={[4000, 4000, 1, 1]} />
          <meshBasicMaterial color="#1d2433" />
        </mesh>
        {chunks.map((chunk) => (
          <LunarTerrainChunk
            key={chunk.key}
            chunkX={chunk.x}
            chunkZ={chunk.z}
            centerX={center.x}
            centerZ={center.z}
            material={material}
            quality={quality}
            seed={seed}
            heightOptions={heightOptions}
          />
        ))}
      </group>
    </>
  );
}
