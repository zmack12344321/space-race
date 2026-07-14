import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Snap-on hover thruster emitter. Beams along its local -Y (down by default),
// so wrap it in a rotated group to aim it anywhere (e.g. backward for jets).
//
// - `color`:     Tron edge/rim + beam tint (cyan, green, ...) — base when
//                `hueCycle` is 0; ignored when hueCycle > 0 (auto color)
// - `coreColor`: hot center of the nozzle (default white — the "white light")
// - `scale`:     overall size
// - `intensity`: pointLight brightness
// - `beamTop` / `beamBottom` / `beamHeight`: cylinder beam radii + length
// - `rungs` / `flowSpeed`: streaming energy rings + fall speed
// - `hueCycle`:  hue rotate speed (0 = static `color`, >0 = automated rainbow)
// - `hueSat` / `hueLight`: rainbow saturation + lightness (lower light = deeper)
// - `sparks`:    number of spark particles streaking down the beam
// - `glow`:      toggle the soft radial glow masks (bloom)
// - `fire`:      toggle the flickering hot flare at the mouth

// ---- shared, module-level resources ----
// NOTE: only the glow *texture* is shared (one canvas, reused by every
// instance). Geometries are intentionally NOT shared — each <HoverThruster>
// declares its OWN inline <cylinderGeometry>/<torusGeometry> so every
// instance is independent (Triplex can tune one without touching the others).
const makeGlowTexture = () => {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const GLOW_TEX = makeGlowTexture();

export const HoverThruster = ({
  color = "#22e6ff",
  coreColor = "white",
  scale = 1,
  intensity = 3,
  beamTop = 0.13,
  beamBottom = 0.16,
  beamHeight = 0.5,
  rungs = 4,
  flowSpeed = 0.8,
  hueCycle = 0,
  hueSat = 1,
  hueLight = 0.5,
  sparks = 0,
  glow = true,
  fire = true,
  ...props
}) => {
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const lightRef = useRef();
  const groupRef = useRef();
  const rimRef = useRef();
  const flareRef = useRef();
  const billboardRef = useRef();
  const pointsRef = useRef();
  const rimMatRef = useRef();
  const haloMatRef = useRef();
  const pointsMatRef = useRef();
  const rungRefs = useRef([]);

  const flareSize = beamTop * 7;

  // spark particle state (per instance — positions differ per emitter)
  const sparkCount = sparks;
  const sparkPos = useMemo(() => {
    const a = new Float32Array(Math.max(sparkCount, 1) * 3);
    for (let i = 0; i < sparkCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random();
      a[i * 3] = Math.cos(ang) * rad * beamTop;
      a[i * 3 + 1] = -Math.random() * beamHeight;
      a[i * 3 + 2] = Math.sin(ang) * rad * beamTop;
    }
    return a;
  }, [sparkCount, beamTop]);

  const lerp = (a, b, t) => a + (b - a) * t;
  const topY = -0.06;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pulse = 0.85 + Math.sin(t * 6) * 0.15;

    // flicker: tame shimmer, or fire-breathing when `fire` is on
    const flick = fire
      ? 0.55 + Math.abs(Math.sin(t * 9)) * 0.3 + Math.abs(Math.sin(t * 17)) * 0.15
      : 0.9 + Math.sin(t * 13) * 0.05 + Math.sin(t * 27) * 0.03;

    // automated color (deeper = lower lightness)
    let r, g, b;
    if (hueCycle > 0) {
      tmpColor.setHSL((t * hueCycle) % 1, hueSat, hueLight);
    } else {
      tmpColor.set(color);
    }
    r = tmpColor.r; g = tmpColor.g; b = tmpColor.b;

    if (haloMatRef.current) {
      haloMatRef.current.color.setRGB(r, g, b);
      haloMatRef.current.opacity = 0.11 * flick;
    }
    if (rimMatRef.current) {
      rimMatRef.current.color.setRGB(r, g, b);
      rimMatRef.current.emissive.setRGB(r, g, b);
      rimMatRef.current.emissiveIntensity = 2.4 * pulse * flick;
    }
    if (lightRef.current) lightRef.current.intensity = intensity * pulse * flick;
    if (pointsMatRef.current) pointsMatRef.current.color.setRGB(r, g, b);
    if (flareRef.current) {
      flareRef.current.material.color.setRGB(r, g, b);
      flareRef.current.material.opacity = fire ? 0.7 * flick : 0;
      const s = flareSize * (1 + flick * 0.6);
      flareRef.current.scale.set(s, s, 1);
    }

    if (rimRef.current) rimRef.current.rotation.z += delta * 1.6;
    // manual billboard: face the camera with a single quaternion copy (cheaper
    // than drei <Billboard>, which spins up its own useFrame per instance)
    if (billboardRef.current) billboardRef.current.quaternion.copy(state.camera.quaternion);

    if (groupRef.current) {
      const baseY = Array.isArray(props.position) ? props.position[1] ?? 0 : 0;
      groupRef.current.position.y = baseY + Math.sin(t * 4) * 0.01;
    }

    // streaming energy rungs (per-rung hue offset when cycling)
    for (let i = 0; i < rungRefs.current.length; i++) {
      const ring = rungRefs.current[i];
      if (!ring) continue;
      const phase = (t * flowSpeed + i / rungs) % 1;
      ring.position.y = topY - phase * beamHeight;
      const rr = lerp(beamTop, beamBottom, phase) * 0.92;
      ring.scale.set(rr, rr, 1);
      ring.material.opacity = Math.sin(phase * Math.PI) * 0.9;
      if (hueCycle > 0) {
        tmpColor.setHSL((t * hueCycle + i / rungs) % 1, hueSat, Math.min(0.7, hueLight + 0.18));
        ring.material.color.setRGB(tmpColor.r, tmpColor.g, tmpColor.b);
      }
    }

    // sparks
    if (sparkCount > 0 && pointsMatRef.current && pointsRef.current) {
      const arr = sparkPos;
      for (let i = 0; i < sparkCount; i++) {
        let y = arr[i * 3 + 1] - delta * (flowSpeed + 0.4);
        if (y < topY - beamHeight) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.random() * 0.8;
          arr[i * 3] = Math.cos(ang) * rad * beamTop;
          arr[i * 3 + 2] = Math.sin(ang) * rad * beamTop;
          y = topY;
        }
        arr[i * 3 + 1] = y;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsMatRef.current.opacity = 0.95 * flick;
    }
  });

  return (
    <group {...props} ref={groupRef} scale={scale}>
      {/* hot white core nozzle */}
      <mesh position={[0, -0.042, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.016, 16]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={1.6}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* tron rim at the mouth (spins) */}
      <mesh ref={rimRef} position={[0, topY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.018, 12, 24]} />
        <meshStandardMaterial
          ref={rimMatRef}
          color={color}
          emissive={color}
          emissiveIntensity={2.2}
          roughness={0.2}
          metalness={0.2}
        />
      </mesh>

      {/* faint outer halo beam (glow depth) */}
      <mesh position={[0, topY - beamHeight / 2, 0]}>
        <cylinderGeometry args={[beamTop * 1.7, beamBottom * 1.7, beamHeight, 20, 1, true]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color={color}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* streaming energy rungs */}
      {Array.from({ length: rungs }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => (rungRefs.current[i] = el)}
          position={[0, topY, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[1, 0.03, 8, 20]} />
          <meshBasicMaterial
            color={coreColor}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* spark particles (DynamicDrawUsage — positions mutate every frame) */}
      {sparkCount > 0 && (
        <points ref={pointsRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={sparkCount}
              array={sparkPos}
              itemSize={3}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
          <pointsMaterial
            ref={pointsMatRef}
            size={0.055}
            map={GLOW_TEX}
            color={color}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}

      {/* soft glow masks + fire flare — all in ONE manual billboard group */}
      <group ref={billboardRef}>
        {glow && (
          <>
            <mesh scale={beamTop * 4} position={[0, topY, 0]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={GLOW_TEX}
                color={color}
                transparent
                opacity={0.45}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <mesh scale={beamBottom * 4} position={[0, topY - beamHeight, 0]}>
              <meshBasicMaterial
                map={GLOW_TEX}
                color={color}
                transparent
                opacity={0.3}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </>
        )}

        {/* hot flickering flare at the mouth — the "fire" */}
        {fire && (
          <>
            <mesh ref={flareRef} scale={flareSize} position={[0, topY, 0]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={GLOW_TEX}
                color={color}
                transparent
                opacity={0.7}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            {/* white-hot inner core of the flame */}
            <mesh scale={flareSize * 0.45} position={[0, topY, 0]}>
              <meshBasicMaterial
                map={GLOW_TEX}
                color={coreColor}
                transparent
                opacity={0.85}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </>
        )}
      </group>

      {/* the white light */}
      <pointLight
        ref={lightRef}
        position={[0, -0.02, 0]}
        color="white"
        intensity={intensity}
        distance={2.6}
        decay={2}
      />
    </group>
  );
};
