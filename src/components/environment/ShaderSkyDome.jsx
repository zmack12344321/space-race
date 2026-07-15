import { useFrame, useThree } from "@react-three/fiber";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
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
      for (int i = 0; i < 3; i++) {
        value += amp * noise(p);
        p *= 2.02;
        amp *= 0.5;
      }
      return value;
    }

    vec2 sphereUV(vec3 n) {
      float u = atan(n.z, n.x) * 0.15915494 + 0.5;
      float v = asin(clamp(n.y, -1.0, 1.0)) * 0.31830989 + 0.5;
      return vec2(u, v);
    }

    vec3 planetBasis(vec3 center, out vec3 right, out vec3 up) {
      vec3 helper = abs(center.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      right = normalize(cross(helper, center));
      up = normalize(cross(center, right));
      return center;
    }

    float starField(vec3 d, float scale, float density, float twinkle) {
      vec3 p = floor(d * scale);
      float h = hash(p);
      float star = smoothstep(1.0 - density, 1.0, h);
      float pulse = 0.7 + 0.3 * sin(uTime * twinkle + h * 60.0);
      return star * pulse;
    }

    vec4 drawPlanet(
      vec3 dir,
      vec3 center,
      float radius,
      vec3 baseColor,
      vec3 accentColor,
      vec3 shadowColor,
      float style,
      float seed,
      float glow
    ) {
      vec4 hit = vec4(0.0);

      float nd = dot(dir, center);
      float radiusCos = cos(radius);
      float edgeCos = cos(radius - 0.03);
      float disc = smoothstep(radiusCos, edgeCos, nd);
      if (disc <= 0.0) return hit;

      vec3 right;
      vec3 up;
      planetBasis(center, right, up);
      vec2 p = vec2(dot(dir, right), dot(dir, up)) / max(0.001, nd);
      float maxR = tan(radius);
      vec2 q = p / maxR;
      float qLen = length(q);
      float edge = fwidth(qLen);
      float bodyMask = 1.0 - smoothstep(0.95, 1.0 + edge * 3.0, qLen);
      if (bodyMask <= 0.0) return hit;

      vec3 local = normalize(vec3(q, sqrt(max(0.0, 1.0 - dot(q, q)))));
      vec3 worldNormal = normalize(right * local.x + up * local.y + center * local.z);
      vec3 viewDir = dir;
      vec3 lightDir = normalize(vec3(-0.55, 0.34, 0.76));
      float ndl = clamp(dot(worldNormal, lightDir), 0.0, 1.0);
      float rim = pow(1.0 - clamp(dot(worldNormal, viewDir), 0.0, 1.0), 2.6);

      vec2 uv = sphereUV(worldNormal);
      vec2 flow = uv * (4.6 + style * 0.5) + vec2(uTime * 0.03 * uMotion, uTime * 0.02 * uMotion);
      float baseNoise = fbm(vec3(flow, seed));
      float detailNoise = fbm(vec3(flow * 1.8 + baseNoise * 0.8, seed + 8.0));
      float bandNoise = 0.5 + 0.5 * sin((uv.y * (7.0 + style * 2.2) + baseNoise * 0.9 + seed) * 6.2831853 + uTime * 0.18 * uMotion);
      float warpNoise = 0.5 + 0.5 * sin((uv.x * 4.0 + uv.y * 1.2 + detailNoise * 1.2 + seed * 1.7) * 6.2831853 + uTime * 0.12 * uMotion);
      float latitude = abs(uv.y - 0.5) * 2.0;

      vec3 col;
      if (style < 0.5) {
        float storm = smoothstep(0.62, 0.95, fbm(vec3(flow * 1.0, seed + 2.0)));
        col = mix(shadowColor, baseColor, 0.22 + baseNoise * 0.78);
        col = mix(col, accentColor, bandNoise * 0.28 + warpNoise * 0.08 + storm * 0.1);
      } else if (style < 1.5) {
        float continent = smoothstep(0.46, 0.7, fbm(vec3(flow * 0.95, seed + 4.0)));
        float ridge = smoothstep(0.62, 0.88, fbm(vec3(flow * 2.3, seed + 6.0)));
        col = mix(shadowColor, baseColor, 0.25 + baseNoise * 0.75);
        col = mix(col, accentColor, continent * 0.24 + ridge * 0.14);
      } else if (style < 2.5) {
        float ice = smoothstep(0.5, 0.92, fbm(vec3(flow * 0.92, seed + 3.0)));
        float cracks = abs(sin((q.x * 16.0 + q.y * 7.0 + uTime * 0.25 + seed) * 3.1415926));
        col = mix(shadowColor, baseColor, 0.22 + baseNoise * 0.78);
        col = mix(col, accentColor, ice * 0.24 + smoothstep(0.8, 0.98, cracks) * 0.12);
      } else if (style < 3.5) {
        float dunes = 0.5 + 0.5 * sin((q.x * 4.4 + q.y * 1.8 + detailNoise * 1.2) * 6.2831853 + uTime * 0.12 * uMotion);
        float dust = smoothstep(0.42, 0.9, fbm(vec3(flow * 1.2, seed + 9.0)));
        col = mix(shadowColor, baseColor, 0.22 + baseNoise * 0.78);
        col = mix(col, accentColor, dunes * 0.2 + dust * 0.14);
      } else {
        float mottling = smoothstep(0.48, 0.96, fbm(vec3(flow * 1.1, seed + 12.0)));
        col = mix(shadowColor, baseColor, 0.2 + baseNoise * 0.8);
        col = mix(col, accentColor, mottling * 0.24 + warpNoise * 0.06);
      }

      float polar = smoothstep(0.55, 0.95, latitude);
      col = mix(col, mix(col, accentColor, 0.25), polar * 0.5);

      float lighting = mix(0.16, 1.0, ndl);
      col *= lighting;
      col += accentColor * rim * glow * 0.12;
      col *= mix(0.78, 1.0, bodyMask);

      float halo = smoothstep(1.05, 0.96, qLen) * glow;
      hit = vec4(mix(col, accentColor, halo * 0.18), disc);
      return hit;
    }

    void main() {
      vec3 dir = normalize(vDir);

      vec3 deep = vec3(0.0, 0.0, 0.015);
      vec3 blue = vec3(0.08, 0.16, 0.52);
      vec3 indigo = vec3(0.2, 0.15, 0.58);
      vec3 violet = vec3(0.36, 0.16, 0.72);
      vec3 teal = vec3(0.08, 0.55, 0.68);
      vec3 green = vec3(0.16, 0.82, 0.52);

      float horizon = smoothstep(-0.08, 0.55, dir.y);
      float skyBase = fbm(dir * 1.2 + vec3(uTime * 0.008, uTime * 0.01, uTime * 0.012));
      float skyCloud = fbm(dir * 2.8 + vec3(0.0, uTime * 0.014, uTime * 0.02));
      float nebula = smoothstep(0.62, 0.98, fbm(dir * 1.7 + vec3(uTime * 0.008, uTime * 0.012, 0.0)));
      float aurora = smoothstep(0.34, 0.9, fbm(dir * 2.6 + vec3(uTime * 0.016, uTime * 0.01, uTime * 0.02)));

      vec3 col = deep;
      col += blue * skyBase * 0.045 * horizon;
      col += indigo * skyCloud * 0.03 * horizon;
      col += violet * nebula * 0.05 * horizon;
      col += teal * aurora * horizon * 0.1;
      col += green * aurora * horizon * 0.05;

      float starDust = starField(dir, 220.0, 0.9965, 0.9);
      float starsMid = starField(dir, 360.0, 0.9977, 1.2);
      col += vec3(1.0) * (starDust * 0.1 + starsMid * 0.04);

      float megaRadius = mix(0.32, 0.96, clamp((uMegaScale - 600.0) / 2000.0, 0.0, 1.0));
      float normalRadius = mix(0.14, 0.32, clamp(uPlanetScale, 0.0, 2.0) * 0.5);

      vec4 hit;

      hit = drawPlanet(dir, normalize(vec3(-0.16, 0.94, -0.29)), megaRadius, vec3(0.43, 0.36, 0.53), vec3(0.85, 0.74, 1.0), vec3(0.11, 0.08, 0.16), 0.0, 1.7, 1.0 * uGlow);
      col = mix(col, hit.rgb, hit.a);

      hit = drawPlanet(dir, normalize(vec3(0.36, 0.68, -0.64)), normalRadius * 0.8, vec3(0.27, 0.43, 0.69), vec3(0.78, 0.9, 1.0), vec3(0.08, 0.14, 0.24), 2.0, 2.3, 0.7 * uGlow);
      col = mix(col, hit.rgb, hit.a);

      hit = drawPlanet(dir, normalize(vec3(-0.63, 0.58, -0.53)), normalRadius * 0.65, vec3(0.55, 0.39, 0.23), vec3(0.95, 0.78, 0.5), vec3(0.18, 0.11, 0.07), 1.0, 3.1, 0.6 * uGlow);
      col = mix(col, hit.rgb, hit.a);

      hit = drawPlanet(dir, normalize(vec3(0.72, 0.43, -0.54)), normalRadius * 0.55, vec3(0.58, 0.5, 0.28), vec3(0.98, 0.84, 0.58), vec3(0.18, 0.14, 0.08), 3.0, 4.2, 0.55 * uGlow);
      col = mix(col, hit.rgb, hit.a);

      hit = drawPlanet(dir, normalize(vec3(-0.23, 0.78, 0.58)), normalRadius * 0.35, vec3(0.73, 0.77, 0.84), vec3(0.96, 0.98, 1.0), vec3(0.31, 0.34, 0.42), 4.0, 5.4, 0.45 * uGlow);
      col = mix(col, hit.rgb, hit.a);

      hit = drawPlanet(dir, normalize(vec3(0.18, 0.89, 0.41)), normalRadius * 0.25, vec3(0.75, 0.68, 0.44), vec3(0.98, 0.9, 0.66), vec3(0.3, 0.26, 0.16), 2.0, 6.6, 0.35 * uGlow);
      col = mix(col, hit.rgb, hit.a);

      col *= uBrightness;
      gl_FragColor = vec4(col, 1.0);
    }
  `
);

extend({ ShaderSkyMaterial });

function SkyDomeMaterial({
  megaScale,
  planetScale,
  brightness,
  glow,
  motion,
}) {
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
        <SkyDomeMaterial
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
