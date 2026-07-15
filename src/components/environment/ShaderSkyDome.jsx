import { shaderMaterial } from "@react-three/drei";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const ShaderSkyMaterial = shaderMaterial(
  {
    uTime: 0,
    uMegaScale: 1,
    uPlanetScale: 1,
    uBrightness: 1,
    uGlow: 1,
    uMotion: 1,
  },
  /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform float uTime;
    uniform float uMegaScale;
    uniform float uPlanetScale;
    uniform float uBrightness;
    uniform float uGlow;
    uniform float uMotion;
    varying vec3 vDir;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    float hash3(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
      float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash3(i + vec3(1.0, 1.0, 1.0));

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
      for (int i = 0; i < 3; i++) {
        value += amp * noise(p);
        p *= 2.02;
        amp *= 0.5;
      }
      return value;
    }

    float circle(vec2 p, vec2 c, float r) {
      return smoothstep(r, r - 0.01, length(p - c));
    }

    vec3 planetShade(vec2 p, vec2 c, float r, vec3 baseColor, vec3 accentColor, vec3 shadowColor, float style, float seed) {
      vec2 d = p - c;
      float dist = length(d);
      if (dist > r) return vec3(-1.0);

      float norm = clamp(dist / r, 0.0, 1.0);
      vec3 n = normalize(vec3(d / r, sqrt(max(0.0, 1.0 - norm * norm))));
      vec3 lightDir = normalize(vec3(-0.55, 0.36, 0.76));
      float lit = clamp(dot(n, lightDir), 0.0, 1.0);

      vec2 flow = d * (4.0 + style * 1.3) + vec2(uTime * 0.04 * uMotion, uTime * 0.025 * uMotion);
      float n0 = fbm(vec3(flow, seed));
      float n1 = fbm(vec3(flow * 1.9 + n0 * 0.7, seed + 2.7));
      float n2 = fbm(vec3(flow * 3.1 + n1 * 0.35, seed + 6.1));

      vec3 col = baseColor;

      if (style < 0.5) {
        float bands = 0.5 + 0.5 * sin((d.y * 8.0 + n0 * 1.8 + seed) * 6.2831853 + uTime * 0.08 * uMotion);
        float storm = smoothstep(0.55, 0.92, n1);
        col = mix(baseColor * 0.65, accentColor, bands * 0.65 + storm * 0.25);
      } else if (style < 1.5) {
        float land = smoothstep(0.44, 0.7, n0);
        float ridge = smoothstep(0.62, 0.9, n1);
        float crater = smoothstep(0.58, 0.98, n2);
        col = mix(shadowColor, baseColor, 0.2 + land * 0.8);
        col = mix(col, accentColor, ridge * 0.18 + crater * 0.14);
      } else {
        float ice = smoothstep(0.45, 0.95, n0);
        float cracks = abs(sin((d.x * 15.0 + d.y * 6.0 + uTime * 0.18 + seed) * 3.1415926));
        col = mix(shadowColor, baseColor, 0.25 + ice * 0.75);
        col = mix(col, accentColor, smoothstep(0.78, 0.98, cracks) * 0.12);
      }

      float terminator = smoothstep(-0.2, 0.75, lit);
      col *= mix(0.18, 1.0, terminator);

      float polar = smoothstep(0.62, 0.98, abs((p.y - c.y) / r));
      col = mix(col, accentColor, polar * 0.2);

      float rim = smoothstep(r + 0.03, r - 0.01, dist) * uGlow;
      col += accentColor * rim * 0.08;

      return mix(shadowColor, col, smoothstep(r, r - 0.01, dist));
    }

    void main() {
      vec3 dir = normalize(vDir);
      vec2 p = vec2(dir.x, dir.y);
      p.x *= 1.25;
      p += vec2(0.015 * sin(uTime * 0.02 * uMotion), 0.01 * cos(uTime * 0.017 * uMotion));

      vec3 skyTop = vec3(0.02, 0.03, 0.08);
      vec3 skyMid = vec3(0.05, 0.08, 0.15);
      vec3 skyGlow = vec3(0.11, 0.14, 0.24);
      vec3 col = mix(skyTop, skyMid, smoothstep(-0.12, 0.72, p.y));
      col = mix(col, skyGlow, smoothstep(0.1, 0.8, p.y) * 0.15);

      float haze = fbm(vec3(p * 1.8, uTime * 0.01));
      col += vec3(0.03, 0.06, 0.1) * haze * smoothstep(-0.1, 0.55, p.y);

      float starA = smoothstep(0.9977, 1.0, hash(floor(p * vec2(320.0, 220.0))));
      float starB = smoothstep(0.9988, 1.0, hash(floor(p * vec2(610.0, 420.0) + 11.3)));
      col += vec3(1.0) * (starA * 0.12 + starB * 0.07);

      // Horizon mountains.
      float ridge = 0.24 + 0.03 * fbm(vec3(vec2(p.x * 3.6, 0.0), 7.0));
      ridge += 0.015 * sin(p.x * 9.0 + uTime * 0.025 * uMotion);
      float mountains = smoothstep(0.01, -0.01, p.y - ridge);
      col = mix(col, vec3(0.12, 0.07, 0.1), mountains);
      col += vec3(0.22, 0.14, 0.12) * mountains * 0.16;

      vec3 planet1 = planetShade(p, vec2(0.15, 0.94 + 0.01 * sin(uTime * 0.02 * uMotion)), mix(0.52, 0.96, clamp((uMegaScale - 600.0) / 2000.0, 0.0, 1.0)), vec3(0.5, 0.42, 0.62), vec3(0.84, 0.75, 0.98), vec3(0.14, 0.11, 0.2), 0.0, 1.7);
      if (planet1.x >= 0.0) col = mix(col, planet1, step(0.0, planet1.x));

      vec3 planet2 = planetShade(p, vec2(-0.48, 0.08 + 0.01 * sin(uTime * 0.028 * uMotion)), mix(0.12, 0.22, clamp(uPlanetScale, 0.0, 2.0) * 0.5), vec3(0.34, 0.22, 0.12), vec3(0.72, 0.5, 0.26), vec3(0.1, 0.07, 0.05), 1.0, 3.1);
      if (planet2.x >= 0.0) col = mix(col, planet2, step(0.0, planet2.x));

      vec3 planet3 = planetShade(p, vec2(0.58, -0.02 + 0.01 * cos(uTime * 0.022 * uMotion)), mix(0.08, 0.15, clamp(uPlanetScale, 0.0, 2.0) * 0.45), vec3(0.72, 0.79, 0.9), vec3(0.96, 0.98, 1.0), vec3(0.32, 0.35, 0.42), 2.0, 5.4);
      if (planet3.x >= 0.0) col = mix(col, planet3, step(0.0, planet3.x));

      float atmo = smoothstep(-0.02, 0.5, p.y) * 0.16;
      col += vec3(0.08, 0.16, 0.28) * atmo;

      col *= uBrightness;
      gl_FragColor = vec4(col, 1.0);
    }
  `
);

extend({ ShaderSkyMaterial });

function SkyMaterial({ brightness, motion, megaScale, planetScale, glow }) {
  const mat = useRef();

  useFrame(({ clock }) => {
    if (mat.current) mat.current.uTime = clock.elapsedTime;
  });

  return (
    <shaderSkyMaterial
      ref={mat}
      uMegaScale={megaScale}
      uPlanetScale={planetScale}
      uBrightness={brightness}
      uGlow={glow}
      uMotion={motion}
      side={THREE.BackSide}
      depthWrite={false}
      depthTest={false}
    />
  );
}

export function ShaderSkyDome({
  megaScale = 1300,
  planetScale = 1.1,
  brightness = 0.85,
  glow = 0.5,
  motion = 0.7,
}) {
  const camera = useThree((state) => state.camera);
  const ref = useRef();

  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position);
  });

  return (
    <group ref={ref}>
      <mesh scale={3200} renderOrder={-20}>
        <sphereGeometry args={[1, 64, 64]} />
        <SkyMaterial
          megaScale={megaScale}
          planetScale={planetScale}
          brightness={brightness}
          glow={glow}
          motion={motion}
        />
      </mesh>
    </group>
  );
}
