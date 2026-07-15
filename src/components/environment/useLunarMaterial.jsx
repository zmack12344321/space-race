import { useTexture } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

const cachedMaterial = new THREE.MeshStandardMaterial({
  color: "#7f8bad", // Cool lunar grey to perfectly match the rocks
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0,
});
cachedMaterial.normalScale = new THREE.Vector2(3.5, 3.5);
cachedMaterial.userData = { diffA: null, diffB: null, norA: null, norB: null };

cachedMaterial.onBeforeCompile = (shader) => {
  cachedMaterial.userData.shader = shader;
  shader.uniforms.diffA = { value: cachedMaterial.userData.diffA };
  shader.uniforms.diffB = { value: cachedMaterial.userData.diffB };
  shader.uniforms.norA = { value: cachedMaterial.userData.norA };
  shader.uniforms.norB = { value: cachedMaterial.userData.norB };

  shader.vertexShader = `
    varying vec3 vWorldPos;
    ${shader.vertexShader}
  `.replace(
    '#include <worldpos_vertex>',
    `
    #include <worldpos_vertex>
    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `
  );

  shader.fragmentShader = `
    uniform sampler2D diffA;
    uniform sampler2D diffB;
    uniform sampler2D norA;
    uniform sampler2D norB;
    varying vec3 vWorldPos;

    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    ${shader.fragmentShader}
  `;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `
    #ifdef USE_MAP
      {
        // Multi-scale blending (Texture Bombing / Detail Mapping) to destroy tiling!
        vec2 uv1 = vWorldPos.xz * 0.04;
        vec2 uv1b = vec2(-uv1.y, uv1.x) + 0.45; // rotated macro
        vec2 uv2 = vWorldPos.xz * 0.13 + vec2(0.123, 0.456);
        vec2 uv3 = vWorldPos.xz * 0.37 + vec2(0.789, 0.123);
        
        vec4 col1 = texture2D(diffA, uv1);
        vec4 col1b = texture2D(diffA, uv1b);
        vec4 col2 = texture2D(diffB, uv2);
        vec4 col3 = texture2D(diffA, uv3);
        
        // Destroy tiling inside the macro patches by mixing rotated version
        float bombBlend = smoothstep(-0.1, 0.1, snoise(vWorldPos.xz * 0.15));
        vec4 col1Final = mix(col1, col1b, bombBlend);
        
        // Blend using noise to create organic sweeping patches
        float blend1 = smoothstep(-0.2, 0.2, snoise(vWorldPos.xz * 0.015));
        float blend2 = smoothstep(-0.2, 0.2, snoise(vWorldPos.xz * 0.05));
        
        vec4 blendedColor = mix(col1Final, col2, blend1);
        blendedColor = mix(blendedColor, col3, blend2);
        
        // Desaturate to pure grayscale to remove the natural beige/brown tint
        float luminance = dot(blendedColor.rgb, vec3(0.299, 0.587, 0.114));
        blendedColor.rgb = vec3(luminance);
        
        diffuseColor *= blendedColor;
      }
    #endif
    `
  ).replace(
    '#include <normal_fragment_maps>',
    `
    #ifdef USE_NORMALMAP
      {
        // Build a mathematically perfect Tangent space directly from our smooth analytical normal
        vec3 worldTangent = vec3(1.0, 0.0, 0.0);
        vec3 viewTangent = normalize( (viewMatrix * vec4(worldTangent, 0.0)).xyz );
        vec3 customT = normalize(viewTangent - normal * dot(viewTangent, normal));
        vec3 customB = cross(normal, customT);
        mat3 tbn = mat3(customT, customB, normal);
        
        vec2 uv1 = vWorldPos.xz * 0.04;
        vec2 uv1b = vec2(-uv1.y, uv1.x) + 0.45; // rotated macro
        vec2 uv2 = vWorldPos.xz * 0.13 + vec2(0.123, 0.456);
        vec2 uv3 = vWorldPos.xz * 0.37 + vec2(0.789, 0.123);
        
        vec3 n1 = texture2D(norA, uv1).xyz * 2.0 - 1.0;
        vec3 n1b = texture2D(norA, uv1b).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(norB, uv2).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(norA, uv3).xyz * 2.0 - 1.0;
        
        // Destroy macro tiling
        float bombBlend = smoothstep(-0.1, 0.1, snoise(vWorldPos.xz * 0.15));
        vec3 n1Final = mix(n1, n1b, bombBlend);
        
        float blend1 = smoothstep(-0.2, 0.2, snoise(vWorldPos.xz * 0.015));
        float blend2 = smoothstep(-0.2, 0.2, snoise(vWorldPos.xz * 0.05));
        
        vec3 mapN = mix(n1Final, n2, blend1);
        
        // ALWAYS add micro detail instead of replacing it, so it's perfectly sharp up close!
        mapN = mapN + n3 * 0.6;
        mapN = normalize(mapN);
        
        mapN.xy *= normalScale;
        normal = normalize( tbn * mapN );
      }
    #endif
    `
  );
};

export function useLunarMaterial() {
  const [diffA, diffB, norA, norB] = useTexture([
    "/moon_01_diff_1k.jpg",
    "/moon_02_diff_1k.jpg",
    "/moon_01_nor_gl_1k.jpg",
    "/moon_02_nor_gl_1k.jpg",
  ]);

  useLayoutEffect(() => {
    [diffA, diffB, norA, norB].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = t === diffA || t === diffB ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      t.needsUpdate = true;
    });

    cachedMaterial.map = diffA;
    cachedMaterial.normalMap = norA;
    cachedMaterial.userData.diffA = diffA;
    cachedMaterial.userData.diffB = diffB;
    cachedMaterial.userData.norA = norA;
    cachedMaterial.userData.norB = norB;
    
    // If the shader is already compiled, update uniforms directly
    if (cachedMaterial.userData.shader) {
      cachedMaterial.userData.shader.uniforms.diffA.value = diffA;
      cachedMaterial.userData.shader.uniforms.diffB.value = diffB;
      cachedMaterial.userData.shader.uniforms.norA.value = norA;
      cachedMaterial.userData.shader.uniforms.norB.value = norB;
    }
  }, [diffA, diffB, norA, norB]);

  return cachedMaterial;
}
