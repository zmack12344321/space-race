import { Environment, Float, Lightformer, Sparkles, Stars, Trail, shaderMaterial } from "@react-three/drei";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Vehicle } from "../vehicles/Vehicle";

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

const PlanetMaterial = shaderMaterial(
  {
    uBaseColor: new THREE.Color("#ffffff"),
    uAccentColor: new THREE.Color("#ffffff"),
    uShadowColor: new THREE.Color("#000000"),
    uSeed: 0,
    uTime: 0,
    uStyle: 0,
    uNoiseScale: 5,
    uBandScale: 10,
    uBrightness: 0.5,
    uRimStrength: 0.08,
  },
  /* glsl */ `
    varying vec3 vNormalW;
    varying vec3 vViewDir;

    void main() {
      vNormalW = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uAccentColor;
    uniform vec3 uShadowColor;
    uniform float uSeed;
    uniform float uTime;
    uniform float uStyle;
    uniform float uNoiseScale;
    uniform float uBandScale;
    uniform float uBrightness;
    uniform float uRimStrength;

    varying vec3 vNormalW;
    varying vec3 vViewDir;

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
        p *= 2.03;
        amp *= 0.5;
      }
      return value;
    }

    void main() {
      vec3 n = normalize(vNormalW);
      vec3 v = normalize(vViewDir);

      vec3 flow = vec3(0.17, 0.09, -0.13) * uTime;
      vec3 p = n * uNoiseScale + vec3(uSeed * 11.7, uSeed * 7.1, uSeed * 3.9) + flow;

      float mottling = fbm(p);
      float streaks = fbm(p * 1.9 + vec3(0.0, uTime * 0.08, uSeed * 2.0));
      float bands = 0.5 + 0.5 * sin((n.y * uBandScale + uSeed * 0.37) * 6.2831853 + streaks * 4.0 + uTime * 0.45);
      float warpedBands = 0.5 + 0.5 * sin((n.x * (uBandScale * 0.35) + n.z * (uBandScale * 0.22) + mottling * 2.8) * 6.2831853 + uTime * 0.18);
      float craterMask = smoothstep(0.52, 0.94, fbm(p * 2.6 + vec3(8.0, 1.7, 4.3)));
      float storm = smoothstep(0.25, 0.85, fbm(p * 0.7 + vec3(uTime * 0.03, uTime * 0.015, 0.0)));
      float style = floor(uStyle + 0.5);

      vec3 color;
      if (style < 0.5) {
        float gasBands = 0.5 + 0.5 * sin((n.y * uBandScale * 1.8 + uSeed * 0.7) * 6.2831853 + uTime * 0.35);
        float stormBand = smoothstep(0.62, 0.92, fbm(n * (uNoiseScale * 1.5) + vec3(uTime * 0.08, uSeed * 4.0, 1.3)));
        color = mix(uShadowColor, uBaseColor, 0.28 + mottling * 0.72);
        color = mix(color, uAccentColor, gasBands * 0.55 + warpedBands * 0.1 + stormBand * 0.25);
        color += (streaks - 0.5) * 0.06;
      } else if (style < 1.5) {
        float continent = smoothstep(0.42, 0.68, fbm(n * (uNoiseScale * 1.3) + vec3(uSeed * 6.0, 0.0, uTime * 0.04)));
        float ridge = smoothstep(0.57, 0.88, fbm(n * (uNoiseScale * 3.0) + vec3(3.7, uTime * 0.03, uSeed * 2.1)));
        float basin = smoothstep(0.35, 0.77, fbm(n * (uNoiseScale * 2.1) + vec3(0.0, uSeed * 5.0, uTime * 0.02)));
        color = mix(uShadowColor, uBaseColor, 0.18 + mottling * 0.82);
        color = mix(color, uAccentColor, continent * 0.4 + ridge * 0.22 + basin * 0.12);
        color += (streaks - 0.5) * 0.1;
      } else if (style < 2.5) {
        float ice = smoothstep(0.45, 0.9, fbm(n * (uNoiseScale * 1.15) + vec3(uTime * 0.03, uSeed * 2.0, 7.1)));
        float crack = abs(sin((n.x * 18.0 + n.z * 9.0 + uTime * 0.3 + uSeed) * 3.1415926));
        float crackMask = smoothstep(0.76, 0.98, crack * 0.8 + fbm(n * 10.0 + vec3(uTime * 0.06, 4.0, 2.0)) * 0.2);
        color = mix(uShadowColor, uBaseColor, 0.25 + mottling * 0.75);
        color = mix(color, uAccentColor, ice * 0.45 + crackMask * 0.22);
        color += (warpedBands - 0.5) * 0.05;
      } else {
        float dune = 0.5 + 0.5 * sin((n.x * (uBandScale * 0.9) + n.z * (uBandScale * 0.55) + mottling * 2.2) * 6.2831853 + uTime * 0.2);
        float dust = smoothstep(0.4, 0.88, fbm(n * (uNoiseScale * 1.9) + vec3(uSeed * 2.0, uTime * 0.03, 5.0)));
        color = mix(uShadowColor, uBaseColor, 0.24 + mottling * 0.76);
        color = mix(color, uAccentColor, dune * 0.35 + dust * 0.3);
        color += (streaks - 0.5) * 0.07;
      }

      color = mix(color, color * 1.12 + uAccentColor * 0.06, storm * 0.18);

      vec3 lightDir = normalize(vec3(-0.55, 0.32, 0.76));
      float ndl = clamp(dot(n, lightDir), -1.0, 1.0);
      float day = smoothstep(-0.18, 0.65, ndl);
      float nightFade = smoothstep(-0.55, 0.08, ndl);
      float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);

      color *= mix(0.18, 1.0, day);
      color += uAccentColor * rim * uRimStrength;
      color *= uBrightness;
      color = mix(color * 0.68, color, nightFade);

      gl_FragColor = vec4(color, 1.0);
    }
  `
);

extend({ NebulaMaterial, PlanetMaterial });

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
          <meshBasicMaterial color={color} toneMapped={false} fog={false} />
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

function CelestialBody({
  position,
  scale = 1,
  color = "#ffffff",
  accent = color,
  shadow = "#000000",
  speed = 0.12,
  ring = false,
  style = 0,
  scaleMultiplier = 1,
  brightnessMultiplier = 1,
  driftMultiplier = 1,
  atmosphereMultiplier = 1,
  floatRange = [-0.08, 0.08],
  atmosphere = 1.05,
  noiseScale = 5,
  bandScale = 10,
  brightness = 0.5,
  rimStrength = 0.06,
}) {
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  const shadowColor = useMemo(() => new THREE.Color(shadow), [shadow]);
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uTime = clock.elapsedTime;
    }
  });

  return (
    <Float speed={speed * driftMultiplier} rotationIntensity={0.12} floatIntensity={0.2} floatingRange={floatRange}>
      <group position={position} scale={scale * scaleMultiplier}>
        <mesh>
          <sphereGeometry args={[1, 48, 48]} />
          <planetMaterial
            ref={materialRef}
            uBaseColor={baseColor}
            uAccentColor={accentColor}
            uShadowColor={shadowColor}
            uSeed={scale * 0.013 + position[0] * 0.0007 + position[2] * 0.0009}
            uStyle={style}
            uNoiseScale={noiseScale}
            uBandScale={bandScale}
            uBrightness={brightness * brightnessMultiplier}
            uRimStrength={rimStrength}
            toneMapped={false}
          />
        </mesh>
        <mesh scale={atmosphere * atmosphereMultiplier}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </mesh>
        {ring && (
          <mesh rotation={[Math.PI / 2.25, 0.15, 0.3]}>
            <torusGeometry args={[1.5, 0.09, 10, 64]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
          </mesh>
        )}
      </group>
    </Float>
  );
}

function SunCluster({
  megaScale = 920,
  planetScaleMultiplier = 1,
  brightnessMultiplier = 1,
  driftMultiplier = 1,
  glowMultiplier = 1,
}) {
  const planets = [
    { position: [-1850, 1480, -2380], scale: megaScale, color: "#6b577f", accent: "#ceb7ff", shadow: "#1e152c", speed: 0.004, atmosphere: 1.085, noiseScale: 3.6, bandScale: 19, brightness: 0.26, rimStrength: 0.02, style: 0 },
    { position: [-1320, 520, -1600], scale: 220, color: "#6a548b", accent: "#d4b9ff", shadow: "#1d142f", speed: 0.014, atmosphere: 1.08, noiseScale: 4.2, bandScale: 18, brightness: 0.38, rimStrength: 0.04, style: 0 },
    { position: [-420, 410, -980], scale: 122, color: "#8b6340", accent: "#f3c98b", shadow: "#2f1b10", speed: 0.028, ring: true, atmosphere: 1.05, noiseScale: 6.7, bandScale: 6, brightness: 0.4, rimStrength: 0.035, style: 1 },
    { position: [430, 560, -1220], scale: 164, color: "#4f71a3", accent: "#c8e1ff", shadow: "#10243a", speed: 0.02, atmosphere: 1.06, noiseScale: 4.7, bandScale: 14, brightness: 0.38, rimStrength: 0.04, style: 2 },
    { position: [1240, 620, -860], scale: 142, color: "#6670b8", accent: "#dde1ff", shadow: "#191d3f", speed: 0.018, atmosphere: 1.05, noiseScale: 5.3, bandScale: 10, brightness: 0.36, rimStrength: 0.035, style: 3 },
    { position: [1780, 500, -300], scale: 180, color: "#a35628", accent: "#ffc38c", shadow: "#36180f", speed: 0.016, atmosphere: 1.06, noiseScale: 5.0, bandScale: 9, brightness: 0.4, rimStrength: 0.04, style: 1 },
    { position: [980, 760, 1040], scale: 112, color: "#a0b0c8", accent: "#eef4ff", shadow: "#465067", speed: 0.01, ring: true, atmosphere: 1.04, noiseScale: 6.9, bandScale: 5, brightness: 0.32, rimStrength: 0.03, style: 2 },
    { position: [-560, 690, 1520], scale: 150, color: "#507d64", accent: "#c0ead4", shadow: "#172821", speed: 0.012, atmosphere: 1.05, noiseScale: 5.7, bandScale: 11, brightness: 0.37, rimStrength: 0.035, style: 1 },
    { position: [-1620, 610, 620], scale: 170, color: "#92704a", accent: "#f2d6aa", shadow: "#3b2b1a", speed: 0.015, atmosphere: 1.06, noiseScale: 5.6, bandScale: 8, brightness: 0.38, rimStrength: 0.035, style: 4 },
    { position: [120, 920, -420], scale: 260, color: "#5b7fa6", accent: "#d2e8ff", shadow: "#16243a", speed: 0.008, atmosphere: 1.07, noiseScale: 4.0, bandScale: 13, brightness: 0.3, rimStrength: 0.025, style: 0 },
    { position: [-920, 860, 180], scale: 232, color: "#825f98", accent: "#e3ccff", shadow: "#241634", speed: 0.009, atmosphere: 1.07, noiseScale: 4.9, bandScale: 15, brightness: 0.3, rimStrength: 0.025, style: 3 },
    { position: [-300, 1260, 540], scale: 82, color: "#b4c7df", accent: "#f5fbff", shadow: "#525e73", speed: 0.012, atmosphere: 1.03, noiseScale: 7.2, bandScale: 4, brightness: 0.27, rimStrength: 0.018, style: 2 },
    { position: [720, 1180, -70], scale: 68, color: "#d6c092", accent: "#fff0c2", shadow: "#6d5d3a", speed: 0.014, atmosphere: 1.03, noiseScale: 6.5, bandScale: 5, brightness: 0.28, rimStrength: 0.018, style: 4 },
  ];

  return (
    <group>
      {planets.map((planet, index) => (
        <CelestialBody key={index} {...planet} scaleMultiplier={planetScaleMultiplier} brightnessMultiplier={brightnessMultiplier} driftMultiplier={driftMultiplier} atmosphereMultiplier={glowMultiplier} />
      ))}
      <mesh position={[-1850, 1480, -2380]}>
        <sphereGeometry args={[1.08, 64, 64]} />
        <meshBasicMaterial color="#dbcafc" transparent opacity={0.03 * glowMultiplier} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <mesh position={[-1320, 340, -1600]}>
        <sphereGeometry args={[1.6, 64, 64]} />
        <meshBasicMaterial color="#cdb8ff" transparent opacity={0.045 * glowMultiplier} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <pointLight position={[-1320, 340, -1600]} color="#d4b7ff" intensity={10 * glowMultiplier} distance={800} />
      <pointLight position={[1780, 270, -300]} color="#ff6b35" intensity={8 * glowMultiplier} distance={700} />
      <pointLight position={[-560, 300, 1520]} color="#66e0a3" intensity={7 * glowMultiplier} distance={700} />
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
          <meshBasicMaterial color={color} toneMapped={false} fog={false} />
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

function SkyShell({ glowMultiplier = 1 }) {
  const camera = useThree((state) => state.camera);
  const skyRef = useRef();

  useFrame(() => {
    if (!skyRef.current) return;
    skyRef.current.position.copy(camera.position);
  });

  return (
    <group ref={skyRef}>
      <GlowField />
      <NebulaDome />
      <Stars radius={1000} depth={450} count={12000} factor={4} saturation={0} fade speed={0.06} />
      <Stars radius={650} depth={180} count={4200} factor={2} saturation={0} fade speed={0.32} />
      <Stars radius={320} depth={90} count={1400} factor={1.2} saturation={0.15} fade speed={0.7} />
      <Sparkles count={180} scale={[160, 90, 160]} size={3.5} speed={0.08} noise={1.0} color="#7fd4ff" opacity={0.18 * glowMultiplier} position={[-60, 40, -220]} />
      <Sparkles count={140} scale={[130, 70, 130]} size={4} speed={0.12} noise={1.3} color="#ffd28a" opacity={0.12 * glowMultiplier} position={[140, 70, -320]} />
      <Sparkles count={80} scale={[100, 40, 100]} size={2.5} speed={0.06} noise={0.7} color="#dcecff" opacity={0.12 * glowMultiplier} position={[0, 110, -180]} />
      <ShootingStarField />
    </group>
  );
}

function WorldBodies({ megaScale, planetScaleMultiplier, brightnessMultiplier, driftMultiplier, glowMultiplier }) {
  const camera = useThree((state) => state.camera);
  const ref = useRef();

  useFrame(() => {
    if (ref.current) {
      ref.current.position.copy(camera.position);
    }
  });

  return (
    <group ref={ref}>
      <DistantComet speed={0.045} offset={0.0} color="#dcecff" y={135} depth={-180} />
      <DistantComet speed={0.031} offset={0.37} color="#ffe7a8" y={155} depth={-240} />
      <DistantComet speed={0.058} offset={0.68} color="#9fd8ff" y={118} depth={-120} />
      <FlybyUfo />
      <SunCluster megaScale={megaScale} planetScaleMultiplier={planetScaleMultiplier} brightnessMultiplier={brightnessMultiplier} driftMultiplier={driftMultiplier} glowMultiplier={glowMultiplier} />
    </group>
  );
}

export function SpaceBackdrop({
  megaScale = 920,
  planetScaleMultiplier = 1,
  brightnessMultiplier = 1,
  driftMultiplier = 1,
  glowMultiplier = 1,
}) {
  return (
    <>
      <SkyShell glowMultiplier={glowMultiplier} />
      <WorldBodies
        megaScale={megaScale}
        planetScaleMultiplier={planetScaleMultiplier}
        brightnessMultiplier={brightnessMultiplier}
        driftMultiplier={driftMultiplier}
        glowMultiplier={glowMultiplier}
      />
    </>
  );
}
