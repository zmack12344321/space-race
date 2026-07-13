const SEED = 1337;

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash2(x, z, salt = 0) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(SEED + salt, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, z, scale, salt) {
  const nx = x / scale;
  const nz = z / scale;
  const x0 = Math.floor(nx);
  const z0 = Math.floor(nz);
  const tx = fade(nx - x0);
  const tz = fade(nz - z0);

  const a = hash2(x0, z0, salt) * 2 - 1;
  const b = hash2(x0 + 1, z0, salt) * 2 - 1;
  const c = hash2(x0, z0 + 1, salt) * 2 - 1;
  const d = hash2(x0 + 1, z0 + 1, salt) * 2 - 1;

  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function fbm(x, z, baseScale, octaves, salt) {
  let amp = 1;
  let scale = baseScale;
  let total = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x, z, scale, salt + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    scale *= 0.5;
  }

  return total / norm;
}

function craterAt(x, z, cellX, cellZ) {
  const cx = (cellX + hash2(cellX, cellZ, 101)) * 48;
  const cz = (cellZ + hash2(cellX, cellZ, 102)) * 48;
  const radius = 5 + hash2(cellX, cellZ, 103) * 13;
  const depth = 0.35 + hash2(cellX, cellZ, 104) * 1.4;
  const rim = 0.12 + hash2(cellX, cellZ, 105) * 0.35;
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.sqrt(dx * dx + dz * dz);

  if (d > radius * 1.45) return 0;

  const bowl = Math.max(0, 1 - d / radius);
  const rimBand = Math.max(0, 1 - Math.abs(d - radius) / (radius * 0.35));
  return -depth * bowl * bowl + rim * rimBand * rimBand;
}

function craters(x, z) {
  const cellSize = 48;
  const cx = Math.floor(x / cellSize);
  const cz = Math.floor(z / cellSize);
  let h = 0;

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      h += craterAt(x, z, cx + dx, cz + dz);
    }
  }

  return h;
}

export function getLunarHeight(x, z) {
  const rolling = fbm(x, z, 180, 5, 1) * 2.2;
  const dunes = fbm(x + 91.7, z - 43.2, 62, 4, 80) * 0.9;
  const regolith = fbm(x, z, 15, 3, 160) * 0.18;
  return rolling + dunes + regolith + craters(x, z);
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
