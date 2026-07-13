import { AdaptiveDpr, Environment, PerformanceMonitor, Preload, Stars, useTexture } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Terrain, { TerrainNS } from "three.terrain.js";
import { createMoonGroundTextures } from "../utils/moonGround";
import { fillLunarHeightmap } from "../utils/lunarHeightfield";
import { DistantMountains } from "./DistantMountains";

const CHUNK_SIZE = 64;
const DEFAULT_VISUAL_RADIUS = 4;
const PHYSICS_RADIUS = 1;

function chunkKey(x, z) {
  return `${x}:${z}`;
}

function chunkRing(x, z, cx, cz) {
  return Math.max(Math.abs(x - cx), Math.abs(z - cz));
}

function segmentsForRing(ring, quality) {
  const q = quality < 0.45 ? 0.75 : 1;
  if (ring <= 1) return Math.round(96 * q);
  if (ring === 2) return Math.round(48 * q);
  return Math.round(20 * q);
}

function LunarTerrainChunk({ chunkX, chunkZ, centerX, centerZ, material, quality }) {
  const ring = chunkRing(chunkX, chunkZ, centerX, centerZ);
  const hasPhysics = ring <= PHYSICS_RADIUS;
  const segments = segmentsForRing(ring, quality);
  const worldX = chunkX * CHUNK_SIZE;
  const worldZ = chunkZ * CHUNK_SIZE;

  const terrain = useMemo(() => {
    const object = Terrain({
      easing: TerrainNS.Linear,
      heightmap: (zs, options) => fillLunarHeightmap(zs, options, worldX, worldZ),
      material,
      maxHeight: 6,
      minHeight: -6,
      stretch: false,
      xSegments: segments,
      xSize: CHUNK_SIZE,
      ySegments: segments,
      ySize: CHUNK_SIZE,
    });

    object.position.set(worldX, 0, worldZ);
    object.traverse((child) => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.frustumCulled = true;
      }
    });
    return object;
  }, [material, segments, worldX, worldZ]);

  useEffect(
    () => () => {
      terrain.traverse((child) => {
        if (child.isMesh) child.geometry?.dispose();
      });
    },
    [terrain]
  );

  if (hasPhysics) {
    return (
      <RigidBody type="fixed" colliders="trimesh">
        <primitive object={terrain} />
      </RigidBody>
    );
  }

  return <primitive object={terrain} />;
}

export function LunarSky() {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const prevFog = scene.fog;
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.003);
    return () => {
      scene.fog = prevFog;
    };
  }, [scene]);

  return (
    <>
      <Environment files="/NightSkyHDRI002_2K_HDR.exr" environmentIntensity={0} />
      <Stars radius={900} depth={400} count={9000} factor={4} saturation={0} fade speed={0.25} />
      <DistantMountains />
      <AdaptiveDpr pixelated />
      <Preload all />
    </>
  );
}

export function LunarTerrain() {
  const camera = useThree((state) => state.camera);
  const [quality, setQuality] = useState(1);
  const [center, setCenter] = useState(() => ({
    x: Math.floor(camera.position.x / CHUNK_SIZE),
    z: Math.floor(camera.position.z / CHUNK_SIZE),
  }));
  const centerRef = useRef(center);

  useFrame(() => {
    const x = Math.floor(camera.position.x / CHUNK_SIZE);
    const z = Math.floor(camera.position.z / CHUNK_SIZE);
    if (x !== centerRef.current.x || z !== centerRef.current.z) {
      centerRef.current = { x, z };
      setCenter(centerRef.current);
    }
  });

  const [diffA, diffB, norA, norB] = useTexture([
    "/moon_01_diff_1k.jpg",
    "/moon_02_diff_1k.jpg",
    "/moon_01_nor_gl_1k.jpg",
    "/moon_02_nor_gl_1k.jpg",
  ]);

  const textures = useMemo(
    () =>
      createMoonGroundTextures(diffA, diffB, norA, norB, {
        repeat: 24,
        normalRepeat: 96,
        dispRepeat: 12,
      }),
    [diffA, diffB, norA, norB]
  );

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures.map,
        normalMap: textures.normalMap,
        normalScale: new THREE.Vector2(1.7, 1.7),
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0,
      }),
    [textures]
  );

  useEffect(
    () => () => {
      material.dispose();
    },
    [material]
  );

  const chunks = useMemo(() => {
    const radius = quality < 0.35 ? 3 : DEFAULT_VISUAL_RADIUS;
    const list = [];
    for (let z = center.z - radius; z <= center.z + radius; z++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        list.push({ x, z, key: chunkKey(x, z) });
      }
    }
    return list;
  }, [center, quality]);

  return (
    <>
      <PerformanceMonitor onChange={({ factor }) => setQuality(factor)} />
      <group name="InfiniteLunarTerrain">
        {chunks.map((chunk) => (
          <LunarTerrainChunk
            key={chunk.key}
            chunkX={chunk.x}
            chunkZ={chunk.z}
            centerX={center.x}
            centerZ={center.z}
            material={material}
            quality={quality}
          />
        ))}
      </group>
    </>
  );
}
