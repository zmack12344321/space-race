let SEED = 1337;
if (typeof window !== "undefined") {
  const url = new URL(window.location.href);
  const seed = url.searchParams.get("seed");
  const room = url.searchParams.get("room") || "default";
  if (seed !== null && seed !== "") {
    const parsed = Number(seed);
    if (Number.isFinite(parsed)) SEED = Math.abs(Math.trunc(parsed));
  } else {
    let hash = 0;
    for (let i = 0; i < room.length; i++) {
      hash = Math.imul(31, hash) + room.charCodeAt(i) | 0;
    }
    SEED = Math.abs(hash);
  }
}

export function getLunarSeed() {
  return SEED;
}

export function setLunarSeed(nextSeed, { persist = true } = {}) {
  SEED = Math.abs(Math.trunc(nextSeed)) || 0;
  if (persist && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(SEED));
    window.history.replaceState(null, "", url);
  }
  return SEED;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash2(x, z, salt = 0, seed = SEED) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed + salt, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, z, scale, salt, seed) {
  const nx = x / scale;
  const nz = z / scale;
  const x0 = Math.floor(nx);
  const z0 = Math.floor(nz);
  const tx = fade(nx - x0);
  const tz = fade(nz - z0);

  const a = hash2(x0, z0, salt, seed) * 2 - 1;
  const b = hash2(x0 + 1, z0, salt, seed) * 2 - 1;
  const c = hash2(x0, z0 + 1, salt, seed) * 2 - 1;
  const d = hash2(x0 + 1, z0 + 1, salt, seed) * 2 - 1;

  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function fbm(x, z, baseScale, octaves, salt, seed) {
  let amp = 1;
  let scale = baseScale;
  let total = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x, z, scale, salt + i * 17, seed) * amp;
    norm += amp;
    amp *= 0.5;
    scale *= 0.5;
  }

  return total / norm;
}

function rockHash(x, z, salt = 0, seed = SEED) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed + salt, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function craterAt(x, z, cellX, cellZ, seed) {
  const cx = (cellX + hash2(cellX, cellZ, 101, seed)) * 48;
  const cz = (cellZ + hash2(cellX, cellZ, 102, seed)) * 48;
  const radius = 5 + hash2(cellX, cellZ, 103, seed) * 13;
  const depth = 0.35 + hash2(cellX, cellZ, 104, seed) * 1.4;
  const rim = 0.12 + hash2(cellX, cellZ, 105, seed) * 0.35;
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.sqrt(dx * dx + dz * dz);

  if (d > radius * 1.45) return 0;

  const bowl = Math.max(0, 1 - d / radius);
  const rimBand = Math.max(0, 1 - Math.abs(d - radius) / (radius * 0.35));
  return -depth * bowl * bowl + rim * rimBand * rimBand;
}

function craters(x, z, seed) {
  const cellSize = 48;
  const cx = Math.floor(x / cellSize);
  const cz = Math.floor(z / cellSize);
  let h = 0;

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      h += craterAt(x, z, cx + dx, cz + dz, seed);
    }
  }

  return h;
}

function megaCraterAt(x, z, cellX, cellZ, seed) {
  const cellSize = 360;
  const cx = (cellX + hash2(cellX, cellZ, 301, seed)) * cellSize;
  const cz = (cellZ + hash2(cellX, cellZ, 302, seed)) * cellSize;
  const radius = 90 + hash2(cellX, cellZ, 303, seed) * 170;
  const depth = 14 + hash2(cellX, cellZ, 304, seed) * 28;
  const rim = 3 + hash2(cellX, cellZ, 305, seed) * 10;
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.sqrt(dx * dx + dz * dz);

  if (d > radius * 1.6) return 0;

  const bowl = Math.max(0, 1 - d / radius);
  const rimBand = Math.max(0, 1 - Math.abs(d - radius) / (radius * 0.2));
  const outerEjecta = Math.max(0, 1 - Math.abs(d - radius * 1.28) / (radius * 0.32));
  return (
    -depth * Math.pow(bowl, 1.45) +
    rim * rimBand * rimBand +
    rim * 0.28 * outerEjecta * outerEjecta
  );
}

function megaCraters(x, z, seed) {
  const cellSize = 360;
  const cx = Math.floor(x / cellSize);
  const cz = Math.floor(z / cellSize);
  let h = 0;

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      h += megaCraterAt(x, z, cx + dx, cz + dz, seed);
    }
  }

  return h;
}

function namedGiantCrater(x, z, cx, cz, radius, depth, rim) {
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.sqrt(dx * dx + dz * dz);

  if (d > radius * 1.65) return 0;

  const bowl = Math.max(0, 1 - d / radius);
  const floor = -depth * Math.pow(bowl, 1.35);
  const rimBand = Math.max(0, 1 - Math.abs(d - radius) / (radius * 0.18));
  const ejecta = Math.max(0, 1 - Math.abs(d - radius * 1.33) / (radius * 0.36));
  return floor + rim * rimBand * rimBand + rim * 0.22 * ejecta * ejecta;
}

function giantCraters(x, z) {
  return (
    namedGiantCrater(x, z, 135, -95, 145, 28, 9) +
    namedGiantCrater(x, z, -420, 310, 210, 38, 13)
  );
}

function sampleLunarHeight(x, z, seed) {
  const rolling = fbm(x, z, 260, 5, 1, seed) * 5.5;
  const dunes = fbm(x + 91.7, z - 43.2, 82, 4, 80, seed) * 1.8;
  const regolith = fbm(x, z, 15, 3, 160, seed) * 0.18;
  return rolling + dunes + regolith + craters(x, z, seed) + megaCraters(x, z, seed) + giantCraters(x, z);
}

function blendFlatZone(height, x, z, seed, flatZone) {
  if (!flatZone) return height;
  const radius = flatZone.radius || 0;
  if (radius <= 0) return height;

  const centerX = flatZone.center?.x ?? 0;
  const centerZ = flatZone.center?.z ?? 0;
  const dist = Math.hypot(x - centerX, z - centerZ);
  if (dist >= radius) return height;

  const innerRadius = Math.max(0, flatZone.innerRadius ?? radius * 0.65);
  const flatHeight = flatZone.height ?? sampleLunarHeight(centerX, centerZ, seed);
  if (dist <= innerRadius) return flatHeight;

  const t = (dist - innerRadius) / Math.max(0.0001, radius - innerRadius);
  const smooth = t * t * (3 - 2 * t);
  return flatHeight * (1 - smooth) + height * smooth;
}

export function getLunarHeight(x, z, seed = SEED, options = {}) {
  const height = sampleLunarHeight(x, z, seed);
  return blendFlatZone(height, x, z, seed, options.flatZone);
}

export function getLunarSpawnCenter(seed = SEED) {
  const hx = hash2(seed, 123, 0, seed) * 3000 - 1500;
  const hz = hash2(seed, 321, 0, seed) * 3000 - 1500;
  return { x: hx, z: hz };
}

function nearestRockDistance(x, z, seed) {
  const chunkSize = 64;
  const cx = Math.floor(x / chunkSize);
  const cz = Math.floor(z / chunkSize);
  let best = Infinity;

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chx = cx + dx;
      const chz = cz + dz;

      for (let i = 0; i < 4; i++) {
        const lx = rockHash(chx, chz, i * 131 + 1, seed);
        const lz = rockHash(chx, chz, i * 131 + 2, seed);
        const worldX = chx * chunkSize + lx * chunkSize;
        const worldZ = chz * chunkSize + lz * chunkSize;
        const dist = Math.hypot(worldX - x, worldZ - z);
        if (dist < best) best = dist;
      }
    }
  }

  return best;
}

function scoreSpawnPoint(x, z, groundHeight, lastSpawn, seed) {
  const h = groundHeight(x, z);
  const samples = [
    [8, 0],
    [-8, 0],
    [0, 8],
    [0, -8],
    [12, 12],
    [-12, 12],
    [12, -12],
    [-12, -12],
  ];

  let min = h;
  let max = h;
  let slope = 0;

  for (const [dx, dz] of samples) {
    const sample = groundHeight(x + dx, z + dz);
    min = Math.min(min, sample);
    max = Math.max(max, sample);
    slope += Math.abs(sample - h);
  }

  const roughness = max - min;
  const rockDistance = nearestRockDistance(x, z, seed);
  const lastDistance = lastSpawn ? Math.hypot(x - lastSpawn.x, z - lastSpawn.z) : Infinity;

  return (
    slope * 2.25 +
    roughness * 2.5 +
    Math.max(0, 12 - rockDistance) * 10 +
    (lastDistance < 20 ? 30 : 0) +
    Math.max(0, 12 - Math.min(12, Math.abs(h))) * 0.5
  );
}

export function getLunarSpawnPoint({
  lastSpawn = null,
  respawnIndex = 0,
  maxRadius = 100,
  minRadius = 18,
  seed = SEED,
  groundHeight = getLunarHeight,
} = {}) {
  const anchor = getLunarSpawnCenter(seed);
  const anchorSeed = Math.round(anchor.x) ^ Math.round(anchor.z) ^ respawnIndex;
  let bestPoint = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < 36; i++) {
    const angle = hash2(anchorSeed + i, respawnIndex + i * 7, 901, seed) * Math.PI * 2;
    const radius = minRadius + Math.pow(hash2(anchorSeed, respawnIndex + i, 902, seed), 0.5) * (maxRadius - minRadius);
    const x = anchor.x + Math.cos(angle) * radius;
    const z = anchor.z + Math.sin(angle) * radius;
    const score = scoreSpawnPoint(x, z, groundHeight, lastSpawn, seed);

    if (score < bestScore) {
      bestScore = score;
      bestPoint = { x, z };
    }

    if (score < 18) break;
  }

  const x = bestPoint?.x ?? anchor.x;
  const z = bestPoint?.z ?? anchor.z;
  const y = groundHeight(x, z) + 8;
  return { x, y, z };
}

export function fillLunarHeightmap(zs, options, offsetX = 0, offsetZ = 0) {
  const xVerts = options.xSegments + 1;
  const zVerts = options.ySegments + 1;
  const stepX = options.xSize / options.xSegments;
  const stepZ = options.ySize / options.ySegments;
  const startX = offsetX - options.xSize / 2;
  const startZ = offsetZ - options.ySize / 2;

  for (let z = 0; z < zVerts; z++) {
    for (let x = 0; x < xVerts; x++) {
      zs[z * xVerts + x] = getLunarHeight(startX + x * stepX, startZ + z * stepZ);
    }
  }
}
