import { AdaptiveDpr, PerformanceMonitor, Preload, useTexture } from "@react-three/drei";
import { MeshCollider, RigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createMoonGroundTextures } from "../utils/moonGround";
import { getLunarHeight } from "../utils/lunarHeightfield";
import { SpaceBackdrop } from "./SpaceBackdrop";

const CHUNK_SIZE = 64;
const DEFAULT_VISUAL_RADIUS = 4;
const PHYSICS_RADIUS = 3;

function chunkKey(x, z) {
  return `${x}:${z}`;
}

function chunkRing(x, z, cx, cz) {
  return Math.max(Math.abs(x - cx), Math.abs(z - cz));
}

function segmentsForRing(ring, quality) {
  const q = quality < 0.45 ? 0.75 : 1;
  if (ring <= 2) return Math.round(80 * q);
  return Math.round(40 * q);
}

function LunarTerrainChunk({ chunkX, chunkZ, centerX, centerZ, material, quality }) {
  const ring = chunkRing(chunkX, chunkZ, centerX, centerZ);
  const hasPhysics = ring <= PHYSICS_RADIUS;
  const segments = segmentsForRing(ring, quality);
  const worldX = chunkX * CHUNK_SIZE;
  const worldZ = chunkZ * CHUNK_SIZE;

  const terrain = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      segments,
      segments
    );
    const positions = geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
      const localX = positions[i];
      const localY = positions[i + 1];
      positions[i + 2] = getLunarHeight(worldX + localX, worldZ - localY);
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(worldX, 0, worldZ);
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    return mesh;
  }, [material, segments, worldX, worldZ]);

  useEffect(
    () => () => {
      terrain.geometry?.dispose();
    },
    [terrain]
  );

  if (hasPhysics) {
    return (
      <RigidBody type="fixed" colliders={false}>
        <MeshCollider type="trimesh">
          <primitive object={terrain} />
        </MeshCollider>
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
      <SpaceBackdrop />
      <AdaptiveDpr pixelated />
      <Preload all />
    </>
  );
}

export function LunarTerrain() {
  const camera = useThree((state) => state.camera);
  const cameraWorldPosition = useRef(new THREE.Vector3());
  const [quality, setQuality] = useState(1);
  const [center, setCenter] = useState(() => ({
    x: Math.floor(camera.position.x / CHUNK_SIZE),
    z: Math.floor(camera.position.z / CHUNK_SIZE),
  }));
  const centerRef = useRef(center);

  useFrame(() => {
    camera.getWorldPosition(cameraWorldPosition.current);
    const x = Math.floor(cameraWorldPosition.current.x / CHUNK_SIZE);
    const z = Math.floor(cameraWorldPosition.current.z / CHUNK_SIZE);
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
        <mesh name="TerrainUnderlay" rotation={[-Math.PI / 2, 0, 0]} position={[0, -44, 0]}>
          <planeGeometry args={[2000, 2000, 1, 1]} />
          <meshStandardMaterial color="#1d2433" roughness={1} />
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
          />
        ))}
      </group>
    </>
  );
}
