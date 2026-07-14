import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { getLunarHeight } from "../src/utils/lunarHeightfield.js";

if (typeof FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      }, (error) => this.onerror?.(error));
    }

    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        const base64 = Buffer.from(buffer).toString("base64");
        this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      }, (error) => this.onerror?.(error));
    }
  };
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(rootDir, "public", "models", "lunar1-baked.glb");

const BAKE = {
  seed: 1544803905,
  flatRadius: 85,
  falloff: 277,
};

function makeGroundGeometry() {
  const size = 4000;
  const segments = 256;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  const positions = geometry.attributes.position.array;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = -positions[i + 1];
    positions[i + 2] = getLunarHeight(x, z, BAKE.seed, {
      flatZone: {
        center: { x: 0, z: 0 },
        radius: BAKE.flatRadius,
        innerRadius: Math.max(0, BAKE.flatRadius - BAKE.falloff),
      },
    });
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

async function exportGlb(scene) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true, trs: true, onlyVisible: true });
  if (result instanceof ArrayBuffer) return Buffer.from(result);
  throw new Error("Unexpected GLTFExporter output format");
}

async function main() {
  console.log(`baking to ${outPath}`);
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({
    color: "#7f8bad",
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(makeGroundGeometry(), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -getLunarHeight(0, 0, BAKE.seed, {
    flatZone: {
      center: { x: 0, z: 0 },
      radius: BAKE.flatRadius,
      innerRadius: Math.max(0, BAKE.flatRadius - BAKE.falloff),
    },
  });
  mesh.receiveShadow = true;
  mesh.name = "Lunar1Ground";
  scene.add(mesh);

  const glb = await exportGlb(scene);
  console.log(`exported ${glb.length} bytes`);
  await fs.writeFile(outPath, glb);
  console.log(`wrote ${path.relative(rootDir, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
