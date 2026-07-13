import { Environment, Float, Lightformer, Sparkles, Stars, Trail, shaderMaterial } from "@react-three/drei";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { Vehicle } from "./Vehicle";

const NebulaMaterial = shaderMaterial(
  { time: 0 },
  /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform float time;
    varying vec3 vDir;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash(i + vec3(0.0, 0.0, 0.0));
      float n100 = hash(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash(i + vec3(1.0, 1.0, 1.0));

      float n00 = mix(n000, n100, f.x);
      float n10 = mix(n010, n110, f.x);
      float n01 = mix(n001, n101, f.x);
      float n11 = mix(n011, n111, f.x);
      float n0 = mix(n00, n10, f.y);
      float n1 = mix(n01, n11, f.y);
      return mix(n0, n1, f.z);
    }

    float fbm(vec3 p) {
      float value = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p *= 2.02;
        amp *= 0.5;
      }
      return value;
    }

    void main() {
      vec3 dir = normalize(vDir);
      vec2 angles = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));

      float base = fbm(dir * 1.8 + vec3(time * 0.01, time * 0.015, time * 0.02));
      float cloud = fbm(dir * 6.0 + vec3(0.0, time * 0.02, time * 0.03));
      float galaxy = smoothstep(0.72, 0.98, fbm(vec3(angles * 1.3, time * 0.01)));
      float skyMask = smoothstep(-0.08, 0.45, dir.y);
      float aurora1 = exp(-pow((dir.y - 0.06) * 16.0, 2.0));
      float aurora2 = exp(-pow((dir.y - 0.18) * 13.0, 2.0));
      float aurora3 = exp(-pow((dir.y - 0.34) * 14.0, 2.0));
      float auroraFlow = fbm(dir * 5.0 + vec3(time * 0.02, time * 0.01, time * 0.03));
      float auroraMask = smoothstep(0.28, 0.9, auroraFlow);
      float starDust = smoothstep(0.9, 1.0, fbm(dir * 55.0 + vec3(time * 0.08)));

      vec3 deep = vec3(0.0, 0.0, 0.01);
      vec3 blue = vec3(0.08, 0.16, 0.52);
      vec3 indigo = vec3(0.2, 0.15, 0.58);
      vec3 violet = vec3(0.36, 0.16, 0.72);
      vec3 teal = vec3(0.08, 0.55, 0.68);
      vec3 green = vec3(0.16, 0.82, 0.52);

      vec3 col = deep;
      col += blue * base * 0.05 * skyMask;
      col += indigo * cloud * 0.04 * skyMask;
      col += teal * aurora1 * auroraMask * skyMask * 0.22;
      col += green * aurora2 * auroraMask * skyMask * 0.18;
      col += violet * aurora3 * auroraMask * skyMask * 0.16;
      col += blue * galaxy * 0.07 * skyMask;
      col += violet * smoothstep(0.8, 1.0, galaxy) * 0.03 * skyMask;
      col += vec3(1.0) * starDust * 0.045;

      gl_FragColor = vec4(col, 1.0);
    }
  `
);

extend({ NebulaMaterial });

function DistantComet({ speed = 0.045, offset = 0, color = "#dcecff", y = 135, depth = -180 }) {
  const cometRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const cycle = ((t * speed) + offset) % 1;
    const visible = cycle > 0.14 && cycle < 0.34;

    if (!cometRef.current) return;

    cometRef.current.visible = visible;
    cometRef.current.position.set(
      THREE.MathUtils.lerp(-220, 220, cycle),
      y - Math.abs(cycle - 0.24) * 260,
      depth + Math.sin(t * 0.12 + offset * Math.PI * 8) * 22
    );
    cometRef.current.rotation.set(-0.15, -0.4, -0.65);
  });

  return (
    <Trail width={0.28} length={9} decay={1.25} color={color}>
      <group ref={cometRef}>
        <mesh>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <pointLight color={color} intensity={2.2} distance={18} />
      </group>
    </Trail>
  );
}

function FlybyUfo() {
  const ufoRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const cycle = ((t * 0.018) + 0.4) % 1;
    const visible = cycle > 0.18 && cycle < 0.48;

    if (!ufoRef.current) return;

    ufoRef.current.visible = visible;
    ufoRef.current.position.set(
      THREE.MathUtils.lerp(-260, 260, cycle),
      112 + Math.sin(cycle * Math.PI) * 18,
      -240 + Math.cos(t * 0.1) * 24
    );
    ufoRef.current.rotation.set(0.12, Math.PI * 0.28, Math.sin(t * 3) * 0.03);
  });

  return (
    <Trail width={0.55} length={8} decay={1.6} color="#cfd7ff">
      <group ref={ufoRef} scale={6.5}>
        <Vehicle model="ufo" />
        <pointLight color="#f4f7ff" intensity={1.8} distance={22} />
      </group>
    </Trail>
  );
}

function GlowField() {
  return (
    <Environment frames={Infinity} resolution={64}>
      <Lightformer form="circle" intensity={1.1} color="#6f8fff" scale={[50, 50, 1]} position={[-60, 100, -120]} />
      <Lightformer form="circle" intensity={0.8} color="#9d69ff" scale={[70, 70, 1]} position={[90, 120, -220]} />
      <Lightformer form="rect" intensity={0.35} color="#dcecff" scale={[220, 24, 1]} position={[0, 140, -360]} />
    </Environment>
  );
}

function NebulaDome() {
  const mat = useRef();

  useFrame((state) => {
    if (mat.current) mat.current.time = state.clock.elapsedTime;
  });

  return (
    <mesh scale={1800} renderOrder={-10}>
      <sphereGeometry args={[1, 48, 48]} />
      <nebulaMaterial ref={mat} side={THREE.BackSide} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

function CelestialBody({ position, scale = 1, color = "#ffffff", emissive = color, speed = 0.12, ring = false }) {
  return (
    <Float speed={speed} rotationIntensity={0.2} floatIntensity={0.35} floatingRange={[-0.08, 0.08]}>
      <group position={position} scale={scale}>
        <mesh>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.95} roughness={0.7} metalness={0.04} />
        </mesh>
        <mesh scale={1.03}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {ring && (
          <mesh rotation={[Math.PI / 2.25, 0.15, 0.3]}>
            <torusGeometry args={[1.5, 0.09, 10, 64]} />
            <meshBasicMaterial color={emissive} transparent opacity={0.26} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )}
      </group>
    </Float>
  );
}

function SunCluster() {
  return (
    <group>
      <CelestialBody position={[-180, 270, -760]} scale={22} color="#ffd28a" emissive="#ffb347" speed={0.035} />
      <CelestialBody position={[240, 250, -980]} scale={16} color="#7d86ff" emissive="#9db0ff" speed={0.05} ring />
      <CelestialBody position={[72, 320, -1180]} scale={34} color="#5c6cff" emissive="#9c7cff" speed={0.028} />
      <CelestialBody position={[-520, 300, -1400]} scale={62} color="#a8d6ff" emissive="#66a6ff" speed={0.016} />
      <CelestialBody position={[450, 260, -1680]} scale={82} color="#ff9f66" emissive="#ff6a3d" speed={0.02} />
      <mesh position={[-220, 140, -760]}>
        <sphereGeometry args={[1.35, 64, 64]} />
        <meshBasicMaterial color="#ffdd9a" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight position={[-180, 270, -760]} color="#ffb347" intensity={52} distance={1500} />
      <pointLight position={[450, 260, -1680]} color="#ff6a3d" intensity={60} distance={2000} />
      <pointLight position={[-520, 300, -1400]} color="#66a6ff" intensity={48} distance={1800} />
    </group>
  );
}

function ShootingStar({ seed = 0, color = "#ffffff" }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 9.7;
    const cycle = (t * 0.12) % 1;
    const active = cycle > 0.72 && cycle < 0.94;
    const progress = THREE.MathUtils.clamp((cycle - 0.72) / 0.22, 0, 1);

    if (!ref.current) return;

    ref.current.visible = active;
    ref.current.position.set(
      THREE.MathUtils.lerp(-240, 240, progress),
      240 - progress * 150,
      -260 - Math.sin(t * 0.3) * 50
    );
    ref.current.rotation.set(-0.2, 0.15, -0.8);
  });

  return (
    <Trail width={0.18} length={5} decay={0.8} color={color}>
      <group ref={ref}>
        <mesh>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </Trail>
  );
}

function ShootingStarField() {
  return (
    <>
      <ShootingStar seed={1} color="#ffffff" />
      <ShootingStar seed={2} color="#9fd8ff" />
      <ShootingStar seed={3} color="#ffe7a8" />
      <ShootingStar seed={4} color="#c3a8ff" />
    </>
  );
}

function SkyShell() {
  const camera = useThree((state) => state.camera);
  const skyRef = useRef();

  useFrame(() => {
    if (!skyRef.current) return;
    skyRef.current.position.copy(camera.position);
    skyRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={skyRef}>
      <GlowField />
      <NebulaDome />
      <Stars radius={1000} depth={450} count={12000} factor={4} saturation={0} fade speed={0.06} />
      <Stars radius={650} depth={180} count={4200} factor={2} saturation={0} fade speed={0.32} />
      <Stars radius={320} depth={90} count={1400} factor={1.2} saturation={0.15} fade speed={0.7} />
      <Sparkles count={180} scale={[160, 90, 160]} size={3.5} speed={0.08} noise={1.0} color="#7fd4ff" opacity={0.18} position={[-60, 40, -220]} />
      <Sparkles count={140} scale={[130, 70, 130]} size={4} speed={0.12} noise={1.3} color="#ffd28a" opacity={0.12} position={[140, 70, -320]} />
      <Sparkles count={80} scale={[100, 40, 100]} size={2.5} speed={0.06} noise={0.7} color="#dcecff" opacity={0.12} position={[0, 110, -180]} />
      <ShootingStarField />
    </group>
  );
}

function WorldBodies() {
  return (
    <group>
      <DistantComet speed={0.045} offset={0.0} color="#dcecff" y={135} depth={-180} />
      <DistantComet speed={0.031} offset={0.37} color="#ffe7a8" y={155} depth={-240} />
      <DistantComet speed={0.058} offset={0.68} color="#9fd8ff" y={118} depth={-120} />
      <FlybyUfo />
      <SunCluster />
    </group>
  );
}

export function SpaceBackdrop() {
  return (
    <>
      <SkyShell />
      <WorldBodies />
    </>
  );
}
