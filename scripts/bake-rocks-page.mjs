import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { mergeBufferGeometries } from "three-stdlib";

const ROCK_PATHS = [
  "/models/rocks/moon_rock_01-transformed.glb",
  "/models/rocks/moon_rock_02-transformed.glb",
  "/models/rocks/moon_rock_03-transformed.glb",
  "/models/rocks/moon_rock_04-transformed.glb",
  "/models/rocks/moon_rock_05-transformed.glb",
  "/models/rocks/moon_rock_06-transformed.glb",
  "/models/rocks/moon_rock_07-transformed.glb",
];

const BAKE = {
  seed: 1544803905,
  staticRadius: 8,
  clearRadius: 85,
};

const CHUNK_SIZE = 64;
const ROCKS_PER_CHUNK = 4;
const ROCK_BASE_SCALE = 76;
const ROCK_TYPES = [1, 2, 3, 4, 5, 6, 7];

function rockHash(x, z, salt = 0, seed = BAKE.seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed + salt, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function computeField(seed = BAKE.seed, radius = BAKE.staticRadius, clearRadius = BAKE.clearRadius) {
  const meshes = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const chx = dx;
      const chz = dz;
      for (let i = 0; i < ROCKS_PER_CHUNK; i++) {
        const lx = rockHash(chx, chz, i * 131 + 1, seed);
        const lz = rockHash(chx, chz, i * 131 + 2, seed);
        const worldX = chx * CHUNK_SIZE + lx * CHUNK_SIZE;
        const worldZ = chz * CHUNK_SIZE + lz * CHUNK_SIZE;
        if (clearRadius > 0 && Math.hypot(worldX, worldZ) < clearRadius) continue;
        meshes.push({
          type: 1 + Math.floor(rockHash(chx, chz, i * 131 + 3, seed) * 7),
          position: [worldX, 0, worldZ],
          rotation: [0, rockHash(chx, chz, i * 131 + 5, seed) * Math.PI * 2, 0],
          scale: ROCK_BASE_SCALE * (0.5 + 2.5 * Math.pow(rockHash(chx, chz, i * 131 + 4, seed), 2.0)),
        });
      }
    }
  }
  return meshes;
}

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
        material = o.material.clone();
        material.color.set("#7f8bad");
      }
    }
  });
  return {
    geometry: geometries.length === 1 ? geometries[0] : mergeBufferGeometries(geometries, false) || geometries[0],
    material,
  };
}

async function exportGlb(scene) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true, trs: true, onlyVisible: true });
  if (!(result instanceof ArrayBuffer)) throw new Error("Unexpected GLTFExporter output format");
  return Array.from(new Uint8Array(result));
}

async function loadRock(loader, path) {
  return await loader.loadAsync(path);
}

export async function bakeRocks() {
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const rockScenes = [];
  for (const rockPath of ROCK_PATHS) {
    const gltf = await loadRock(loader, rockPath);
    rockScenes.push(gltf.scene);
  }

  const assets = rockScenes.map(extractRock);
  const scene = new THREE.Scene();
  const placements = computeField();
  const dummy = new THREE.Object3D();

  for (const type of ROCK_TYPES) {
    const list = placements.filter((p) => p.type === type);
    const asset = assets[type - 1];
    const mesh = new THREE.InstancedMesh(asset.geometry, asset.material, list.length);
    mesh.name = `RockType_${type}`;
    for (let i = 0; i < list.length; i++) {
      const rock = list[i];
      dummy.position.set(rock.position[0], rock.position[1], rock.position[2]);
      dummy.rotation.set(...rock.rotation);
      dummy.scale.setScalar(rock.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  return await exportGlb(scene);
}
