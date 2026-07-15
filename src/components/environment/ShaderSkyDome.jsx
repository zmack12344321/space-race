import { shaderMaterial } from "@react-three/drei";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const SkyMaterial = shaderMaterial(
  { iTime: 0, iResolution: new THREE.Vector2(1, 1), uBrightness: 1 },
  /* glsl */ `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform float iTime;
    uniform vec2 iResolution;

    mat2 r2d(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, s, -s, c);
    }

    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float sdCircle(vec2 p, float radius, vec2 pos, float prec) {
      return smoothstep(0.0, prec, radius - length(pos - p));
    }

    float dis_e(vec2 center, float a, float b, vec2 coord) {
      float x2 = (coord.x - center.x) * (coord.x - center.x);
      float y2 = (coord.y - center.y) * (coord.y - center.y);
      return x2 / (a * a) + y2 / (b * b);
    }

    float fbm(vec2 v_p) {
      float value = 0.0;
      float amp = 0.5;
      float freq = 1.0;
      for (int i = 0; i < 4; i++) {
        value += amp * noise(v_p * freq);
        freq *= 2.0;
        amp *= 0.5;
      }
      return value;
    }

    float drawStars(vec2 v_p) {
      float acc = 0.0;
      for (int j = 0; j < 20; j++) {
        float jf = float(j);
        vec2 starPos = vec2(
          mod((4.0 * noise(vec2(jf)) - 2.0), 4.0) - 2.0,
          1.9 * noise(vec2(jf + 2.0)) + 0.5
        );
        float distStar = length(v_p - starPos);
        acc += 0.00025 * pow(max(distStar, 0.001), -1.12);
      }
      return acc;
    }

    vec4 drawAtmoGradient(vec2 p) {
      vec4 top = vec4(0.04, 0.07, 0.16, 1.0);
      vec4 mid = vec4(0.08, 0.12, 0.24, 1.0);
      vec4 low = vec4(0.12, 0.08, 0.18, 1.0);
      float t = smoothstep(-0.2, 0.95, p.y);
      vec4 col = mix(low, top, t);
      col = mix(col, mid, smoothstep(-0.05, 0.65, p.y) * 0.35);
      col += vec4(0.04, 0.06, 0.1, 1.0) * fbm(p * 1.5 + vec2(iTime * 0.02, iTime * 0.015));
      return col;
    }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      vec2 p = vec2(
        (iResolution.x / iResolution.y) * (fragCoord.x - iResolution.x / 2.0) / iResolution.x,
        fragCoord.y / iResolution.y
      );

      vec4 col = drawAtmoGradient(p);

      // Stars and galaxy dust.
      if (length(p - vec2(0.23, 0.94)) - 0.8 > 0.0) {
        col += vec4(vec3(drawStars(p)), 1.0);
      }
      col += vec4(0.12, 0.11, 0.24, 1.0) * smoothstep(0.72, 1.0, fbm(p * vec2(2.2, 1.1) + vec2(0.1, 0.3))) * smoothstep(0.0, 0.95, p.y);
      col += vec4(0.05, 0.18, 0.24, 1.0) * smoothstep(0.74, 1.0, fbm(p * vec2(1.4, 2.5) + vec2(-0.45, 0.15))) * smoothstep(0.0, 0.9, p.y);

      // Mountains.
      float mountains = smoothstep(0.007, 0.0, p.y - 0.18 * fbm(vec2(7.0 * p.x)) - 0.38);
      col = mix(col, vec4(0.14, 0.08, 0.1, 1.0), mountains);
      col += vec4(0.22, 0.14, 0.12, 1.0) * fbm(vec2(20.0 * p.x)) * mountains;

      // Mega planet: big, clipped, sphere-like.
      vec2 megaC = vec2(0.28, 1.02);
      float megaR = 0.34;
      float mega = sdCircle(p, megaR, megaC, 0.01);
      float mega2 = sdCircle(p, megaR * 1.02, megaC + vec2(0.03, 0.01), 0.01);
      float megaCrop = mega - mega2;
      vec3 megaCol = vec3(0.46, 0.38, 0.58);
      megaCol = mix(megaCol, vec3(0.86, 0.76, 1.0), 0.25 + 0.35 * fbm(p * vec2(7.0, 4.0) + vec2(iTime * 0.02, 0.0)));
      col.rgb += clamp(megaCrop, 0.0, 1.0) * megaCol;
      col.rgb += vec3(1.0, 0.85, 1.0) * smoothstep(0.36, 0.0, abs(length(p - megaC) - megaR)) * 0.7;

      // Left crescent planet.
      vec2 c2 = vec2(-0.62, 0.72);
      float p2 = sdCircle(p, 0.12, c2, 0.01);
      float p2b = sdCircle(p, 0.16, c2 + vec2(0.04, -0.01), 0.05);
      float crescent = clamp(p2 - p2b, 0.0, 1.0);
      col += vec4(0.95, 0.72, 0.46, 1.0) * crescent;
      col += vec4(0.35, 0.22, 0.12, 1.0) * p2;

      // Tiny upper-right moon.
      vec2 c3 = vec2(0.74, 0.9);
      float p3 = sdCircle(p, 0.03, c3, 0.005);
      float p3b = sdCircle(p, 0.041, c3 + vec2(0.018, 0.0), 0.01);
      col += vec4(0.96, 0.98, 1.0, 1.0) * clamp(p3 - p3b, 0.0, 1.0);

      // Ringed/eclipse accent on the right.
      float ringOuter = sdCircle(p, 0.055, vec2(0.62, 0.92), 0.01);
      float ringInner = sdCircle(p, 0.04, vec2(0.62, 0.92), 0.01);
      col += vec4(0.95, 0.84, 0.6, 1.0) * clamp(ringOuter - ringInner, 0.0, 1.0);

      // Meteors.
      vec2 m1a = vec2(-0.95 + fract(iTime * 0.06), 0.78 - fract(iTime * 0.06) * 0.45);
      vec2 m1b = vec2(-0.45, 0.55);
      float meteor1 = 1.0 - smoothstep(0.0, 0.01, distance(p, m1a));
      meteor1 += 0.12 * (1.0 - smoothstep(0.0, 0.03, abs((p.y - m1a.y) - 0.45 * (p.x - m1a.x))));
      col += vec4(1.0, 0.9, 0.7, 1.0) * meteor1;

      vec2 m2a = vec2(0.18, 0.58);
      vec2 m2b = vec2(0.82 - fract(iTime * 0.05), 0.3 - fract(iTime * 0.05) * 0.3);
      float meteor2 = 1.0 - smoothstep(0.0, 0.01, distance(p, m2b));
      meteor2 += 0.09 * (1.0 - smoothstep(0.0, 0.03, abs((p.y - m2b.y) + 0.35 * (p.x - m2b.x))));
      col += vec4(0.9, 0.95, 1.0, 1.0) * meteor2;

      // Dome glow.
      col += vec4(0.9, 0.68, 1.0, 1.0) * (1.0 - smoothstep(0.0, 0.33, distance(p, megaC))) * 0.06;

      vec4 fragColor = col;
      gl_FragColor = fragColor;
    }
  `
);

extend({ SkyMaterial });

function FullscreenBackdrop({ brightness = 1 }) {
  const size = useThree((state) => state.size);
  const mat = useRef();
  const mesh = useRef();

  useFrame(({ clock }) => {
    if (mat.current) {
      mat.current.iTime = clock.elapsedTime;
      mat.current.iResolution.set(size.width, size.height);
      mat.current.uBrightness = brightness;
    }
  });

  const scale = [8 * (size.width / size.height), 8, 1];

  return (
    <mesh ref={mesh} position={[0, 0, 0]} scale={scale} renderOrder={-20}>
      <planeGeometry args={[1, 1]} />
      <skyMaterial ref={mat} side={THREE.DoubleSide} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

export function ShaderSkyDome({ brightness = 1 }) {
  return <FullscreenBackdrop brightness={brightness} />;
}
