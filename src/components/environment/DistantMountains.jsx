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

      const ridgeY = height * (0.55 + broad + detail);

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

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
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
      <meshBasicMaterial color={color} side={THREE.DoubleSide} fog />
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
      // Far — lightest, bluest, lowest contrast, haziest.
      {
        radius: radius + 170,
        height: height * 1.75,
        segments: Math.round(segments * 0.6),
        strips: 9,
        seed: seed + 13,
        color: "#1c2942",
        y: 6,
        depth: 0,
      },
      // Mid — medium.
      {
        radius: radius + 90,
        height: height * 1.4,
        segments: Math.round(segments * 0.8),
        strips: 7,
        seed: seed + 8,
        color: "#142033",
        y: 2,
        depth: depth * 0.6,
      },
      // Near — darkest, most defined, highest contrast.
      {
        radius,
        height,
        segments,
        strips: 6,
        seed,
        color,
        y: -2,
        depth,
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
