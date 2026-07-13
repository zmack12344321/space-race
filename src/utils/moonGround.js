import * as THREE from "three";

// Builds a single, tileable lunar-ground material map set by BLENDING the two
// moon surface texture sets (moon_01 + moon_02). We blend because neither set
// tiles seamlessly on its own; mixing two decorrelated sets hides repetition.
//
// There is no heightmap in the source assets, so the displacement map is
// derived from the blended albedo luminance (so bumps line up with visible
// craters/maria) plus a fractal-noise term for large rolling relief.
//
// IMPORTANT: we use THREE different repeats so the surface reads correctly at
// every scale —
//   • color  (repeat)        — base surface tone
//   • normal (normalRepeat)  — HIGH frequency → visible pebbles/bumps
//   • displ. (dispRepeat)    — LOW frequency  → craters/rolling terrain
//
// NOTE: runs in the browser (uses document/canvas). Fine for R3F + Triplex.

const SIZE = 512;

// Tileable value noise: grid corners wrap, so the result repeats seamlessly
// across the canvas (period = `cells`).
function makeTilingValueNoise(cells, seed = 1) {
  const g = cells;
  const grid = new Float32Array((g + 1) * (g + 1));
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let y = 0; y <= g; y++)
    for (let x = 0; x <= g; x++) grid[y * (g + 1) + x] = rnd();

  const out = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const gy = (y / SIZE) * g;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    const sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < SIZE; x++) {
      const gx = (x / SIZE) * g;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const sx = fx * fx * (3 - 2 * fx);
      const x1 = (x0 + 1) % (g + 1);
      const y1 = (y0 + 1) % (g + 1);
      const v00 = grid[y0 * (g + 1) + x0];
      const v10 = grid[y0 * (g + 1) + x1];
      const v01 = grid[y1 * (g + 1) + x0];
      const v11 = grid[y1 * (g + 1) + x1];
      const a = v00 + (v10 - v00) * sx;
      const b = v01 + (v11 - v01) * sx;
      out[y * SIZE + x] = a + (b - a) * sy;
    }
  }
  return out;
}

// Fractal sum of tileable noise octaves (also seamless).
function makeFbm(cellsBase, octaves) {
  const total = new Float32Array(SIZE * SIZE);
  let amp = 1;
  let freq = cellsBase;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = makeTilingValueNoise(freq, 1000 + o * 7);
    for (let i = 0; i < total.length; i++) total[i] += n[i] * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  for (let i = 0; i < total.length; i++) total[i] /= norm;
  return total;
}

function toImageData(tex) {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  ctx.drawImage(tex.image, 0, 0, SIZE, SIZE);
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

// Draw the second texture shifted by half a tile (and wrapped) so it is
// decorrelated from the first — this is what really sells the "no tiling" look.
function toImageDataShifted(tex) {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  const h = SIZE / 2;
  ctx.drawImage(tex.image, -h, -h, SIZE, SIZE);
  ctx.drawImage(tex.image, h, -h, SIZE, SIZE);
  ctx.drawImage(tex.image, -h, h, SIZE, SIZE);
  ctx.drawImage(tex.image, h, h, SIZE, SIZE);
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

function blend(A, B, mask) {
  const out = new ImageData(SIZE, SIZE);
  for (let i = 0; i < A.data.length; i += 4) {
    const m = mask[i >> 2];
    out.data[i] = A.data[i] * (1 - m) + B.data[i] * m;
    out.data[i + 1] = A.data[i + 1] * (1 - m) + B.data[i + 1] * m;
    out.data[i + 2] = A.data[i + 2] * (1 - m) + B.data[i + 2] * m;
    out.data[i + 3] = 255;
  }
  return out;
}

function canvasFrom(imageData) {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c;
}

function makeTexture(canvas, { srgb = false, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function createMoonGroundTextures(
  diffA,
  diffB,
  norA,
  norB,
  {
    repeat = 60,
    normalRepeat = 240,
    dispRepeat = 24,
    cells = 10,
    heightMix = 0.55,
    desat = 0.8,
    tint = [0.85, 0.88, 0.98],
    bright = 1.0,
  } = {}
) {
  const mask = makeTilingValueNoise(cells, 42);
  const aColor = toImageData(diffA);
  const bColor = toImageDataShifted(diffB);
  const aNorm = toImageData(norA);
  const bNorm = toImageDataShifted(norB);

  const color = blend(aColor, bColor, mask);
  const normal = blend(aNorm, bNorm, mask);

  // The source moon albedo is warm brown-grey; recolor it to a cool lunar
  // grey by desaturating toward luminance and tinting slightly cool.
  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const recolored = new ImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = color.data[i * 4];
    const g = color.data[i * 4 + 1];
    const b = color.data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    recolored.data[i * 4] = clamp255((r + (lum - r) * desat) * tint[0] * bright);
    recolored.data[i * 4 + 1] = clamp255((g + (lum - g) * desat) * tint[1] * bright);
    recolored.data[i * 4 + 2] = clamp255((b + (lum - b) * desat) * tint[2] * bright);
    recolored.data[i * 4 + 3] = 255;
  }

  // Low-frequency displacement = craters / rolling terrain. Combines fractal
  // relief with the albedo luminance so the big bumps follow surface features.
  const fbm = makeFbm(6, 5);
  const height = new ImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = color.data[i * 4] / 255;
    const g = color.data[i * 4 + 1] / 255;
    const bch = color.data[i * 4 + 2] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * bch;
    let v = heightMix * fbm[i] + (1 - heightMix) * lum;
    v = Math.pow(v, 1.4); // boost contrast a touch
    const c = Math.max(0, Math.min(255, v * 255));
    height.data[i * 4] = height.data[i * 4 + 1] = height.data[i * 4 + 2] = c;
    height.data[i * 4 + 3] = 255;
  }

  return {
    map: makeTexture(canvasFrom(recolored), { srgb: true, repeat }),
    // High-repeat normal = fine pebble/regolith bump detail (shading only).
    normalMap: makeTexture(canvasFrom(normal), { repeat: normalRepeat }),
    // Low-repeat displacement = craters / large relief (actual geometry).
    displacementMap: makeTexture(canvasFrom(height), { repeat: dispRepeat }),
  };
}
