import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CSM } from "three/examples/jsm/csm/CSM.js";

function getSunDirection(sunAngle, sunDist, minY) {
  const theta = sunAngle * Math.PI;
  const sin = Math.sin(theta);

  return new THREE.Vector3(
    Math.cos(theta) * sunDist,
    -Math.max(minY, sin * sunDist),
    sin * (sunDist / 2)
  ).normalize();
}

function isCSMMaterial(material) {
  return Boolean(
    material &&
      (material.isMeshStandardMaterial ||
        material.isMeshPhysicalMaterial ||
        material.isMeshPhongMaterial ||
        material.isMeshLambertMaterial ||
        material.isMeshToonMaterial)
  );
}

export function SunLightRig({
  sunAngle,
  sunDist,
  intensity,
  color,
  shadowDistance,
  shadowMapSize = 2048,
  shadowBias = -0.0005,
  shadowNormalBias = 0.04,
  minSunY = 0.1,
  shadowFarMultiplier = 4,
  lightMargin = 80,
  cascades = 3,
}) {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const csmRef = useRef(null);
  const registeredMaterials = useRef(new WeakSet());
  const scanFrame = useRef(0);
  const sunDirection = useMemo(() => getSunDirection(sunAngle, sunDist, minSunY), [sunAngle, sunDist, minSunY]);

  const registerMaterials = (csm) => {
    scene.traverse((object) => {
      const material = object.material;
      if (!material) return;
      const materials = Array.isArray(material) ? material : [material];
      for (const mat of materials) {
        if (!isCSMMaterial(mat) || registeredMaterials.current.has(mat)) continue;

        const baseOnBeforeCompile = mat.onBeforeCompile;
        csm.setupMaterial(mat);
        const csmOnBeforeCompile = mat.onBeforeCompile;

        mat.onBeforeCompile = (shader, renderer) => {
          baseOnBeforeCompile?.call(mat, shader, renderer);
          csmOnBeforeCompile?.call(mat, shader, renderer);
        };

        registeredMaterials.current.add(mat);
        mat.needsUpdate = true;
      }
    });
  };

  useEffect(() => {
    if (!camera || !scene) return undefined;

    const csm = new CSM({
      camera,
      parent: scene,
      cascades,
      maxFar: shadowDistance,
      mode: "practical",
      shadowMapSize,
      shadowBias,
      lightDirection: sunDirection.clone(),
      lightIntensity: intensity,
      lightNear: 1,
      lightFar: shadowDistance * shadowFarMultiplier,
      lightMargin,
    });

    csm.fade = true;
    csm.lights.forEach((light) => {
      light.color.set(color);
      light.intensity = intensity;
      light.shadow.normalBias = shadowNormalBias;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = shadowDistance * shadowFarMultiplier;
      light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    });
    csmRef.current = csm;

    registerMaterials(csm);

    return () => {
      csm.remove();
      csm.dispose();
      csmRef.current = null;
      registeredMaterials.current = new WeakSet();
    };
  }, [camera, scene, cascades]);

  useEffect(() => {
    const csm = csmRef.current;
    if (!csm) return;

    csm.lightDirection.copy(sunDirection);
    csm.maxFar = shadowDistance;
    csm.lightMargin = lightMargin;
    csm.lightIntensity = intensity;
    csm.lightFar = shadowDistance * shadowFarMultiplier;
    csm.shadowMapSize = shadowMapSize;
    csm.shadowBias = shadowBias;
    csm.updateFrustums();

    csm.lights.forEach((light) => {
      light.color.set(color);
      light.intensity = intensity;
      light.shadow.bias = shadowBias;
      light.shadow.normalBias = shadowNormalBias;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = shadowDistance * shadowFarMultiplier;
      light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      light.shadow.camera.updateProjectionMatrix();
    });
  }, [color, intensity, shadowBias, shadowDistance, shadowFarMultiplier, shadowMapSize, shadowNormalBias, sunDirection, lightMargin]);

  useFrame(() => {
    const csm = csmRef.current;
    if (!csm) return;

    if ((scanFrame.current++ % 24) === 0) registerMaterials(csm);

    csm.update();
  });

  return null;
}
