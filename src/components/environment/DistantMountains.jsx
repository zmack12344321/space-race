import * as THREE from "three";
import { useMemo } from "react";

// Deterministic seeded PRNG (same seed → same ridge every render).
function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

// One continuous mountain ridge silhouette built as a vertical strip.
// A top row of irregular ridge vertices + a hidden bottom row, triangulated
// into a single flat wall. No spheres, cones, or repeated blobs. Unlit and
// static — the shape + atmospheric fog do all the work.
export function MountainRange({
  width = 500,
  height = 55,
  depth = 0,
  segments = 36,
  seed = 1,
  color = "#11182b",
  position = [0, -2, -300],
  rotation = [0, 0, 0],
} = {}) {
  const geometry = useMemo(() => {
    const random = seededRandom(seed);
    const positions = [];
    const indices = [];

    const bottomY = -100;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * width;

      // Broad underlying mountain masses (slow, layered sine waves).
      const broad =
        Math.sin(t * Math.PI * 3.2 + seed) * 0.28 +
        Math.sin(t * Math.PI * 7.3 + seed * 0.7) * 0.15 +
        Math.sin(t * Math.PI * 1.4 + seed * 0.3) * 0.2;

      // Occasional sharper peaks + asymmetry from seeded noise.
      const detail = (random() - 0.5) * 0.3;

      // Second higher-frequency octave so closer (more segmented) ridges
      // read as craggy rather than smooth sine lumps.
      const craggy = Math.sin(t * Math.PI * 19 + seed * 1.7) * 0.06 * (segments / 36);

      const ridgeY = height * (0.55 + broad + detail + craggy);

      // Ridge vertex + hidden lower vertex (buried below the terrain).
      positions.push(x, ridgeY, 0);
      positions.push(x, bottomY, 0);

      if (i < segments) {
        const topLeft = i * 2;
        const bottomLeft = i * 2 + 1;
        const topRight = i * 2 + 2;
        const bottomRight = i * 2 + 3;

        indices.push(
          topLeft,
          bottomLeft,
          topRight,
          topRight,
          bottomLeft,
          bottomRight
        );
      }
    }

    // Vertical gradient: ridge brighter, base darker. Gives cheap depth so
    // the flat wall reads as a lit massif instead of a silhouette cutout.
    const colors = [];
    const topColor = new THREE.Color(color);
    const baseColor = topColor.clone().multiplyScalar(0.45);
    for (let i = 0; i <= segments; i++) {
      colors.push(topColor.r, topColor.g, topColor.b);
      colors.push(baseColor.r, baseColor.g, baseColor.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [width, height, segments, seed]);

  const renderWall = (zOffset) => (
    <mesh
      geometry={geometry}
      position={[0, 0, zOffset]}
      frustumCulled={false}
      raycast={() => null}
    >
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog />
    </mesh>
  );

  return (
    <group position={position} rotation={rotation}>
      {renderWall(0)}
      {depth > 0 && renderWall(-depth)}
    </group>
  );
}

// A reusable, deterministic distant-mountain horizon. Builds three layered
// rings of ridge silhouettes around the scene so it reads as a continuous
// mountain horizon from every angle. Front range is darkest/most defined;
// farther ranges are lighter, bluer, and lower contrast so they melt into
// the horizon-colored fog.
export function DistantMountains({
  radius = 650,
  height = 40,
  depth = 6,
  segments = 36,
  seed = 1,
  color = "#0e1626",
  position = [0, 0, 0],
} = {}) {
  const bands = useMemo(
    () => [
      // Far — closest to fog color so it dissolves into the horizon
      // instead of reading as a hard wall. Short + low contrast, but tall
      // enough to poke above the fog line when the camera rises.
      {
        radius: radius + 360,
        height: height * 1.3,
        segments: Math.round(segments * 0.55),
        strips: 12,
        seed: seed + 13,
        color: "#161f33",
        y: 10,
        depth: 0,
      },
      // Far-mid.
      {
        radius: radius + 270,
        height: height * 1.08,
        segments: Math.round(segments * 0.7),
        strips: 11,
        seed: seed + 11,
        color: "#131c2e",
        y: 5,
        depth: depth * 0.35,
      },
      // Mid.
      {
        radius: radius + 185,
        height: height * 1.04,
        segments: Math.round(segments * 0.85),
        strips: 10,
        seed: seed + 8,
        color: "#101829",
        y: 2,
        depth: depth * 0.6,
      },
      // Near-mid — bridges the gap to the foreground.
      {
        radius: radius + 100,
        height: height * 1.1,
        segments: Math.round(segments * 1.05),
        strips: 9,
        seed: seed + 5,
        color: "#0d1525",
        y: -1,
        depth: depth * 0.85,
      },
      // Foreground — closest, but pushed well beyond the rock/terrain
      // stream radius (~576u) so rocks never sit in front of the ridges.
      // Darkest + tallest + most defined; base melts into fog like terrain.
      {
        radius: radius + 30,
        height: height * 1.25,
        segments: Math.round(segments * 1.35),
        strips: 12,
        seed: seed + 21,
        color: "#0b1320",
        y: -6,
        depth: depth * 1.4,
      },
    ],
    [radius, height, depth, segments, seed, color]
  );

  return (
    <group name="DistantMountains" position={position}>
      {bands.map((band, b) =>
        Array.from({ length: band.strips }).map((_, i) => {
          const a = (i / band.strips) * Math.PI * 2;
          const x = Math.sin(a) * band.radius;
          const z = -Math.cos(a) * band.radius;
          const circumference = 2 * Math.PI * band.radius;
          const width = (circumference / band.strips) * 1.6;
          return (
            <MountainRange
              key={`${b}-${i}`}
              width={width}
              height={band.height}
              depth={band.depth}
              segments={band.segments}
              seed={band.seed + i * 7}
              color={band.color}
              position={[x, band.y, z]}
              rotation={[0, -a, 0]}
            />
          );
        })
      )}
    </group>
  );
}
