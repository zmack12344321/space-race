import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMultiplayerState } from "../../multiplayer/party";
import { DistantMountains } from "./DistantMountains";
import { LunarSky } from "./LunarTerrain";

export function LunarEnvironment({ sunAngle: sunAngleProp, skyMode = "blue", starsMode = "lean" } = {}) {
  const [roomSunAngle] = useMultiplayerState("sunAngle", 0.94);
  const sunAngle = sunAngleProp ?? roomSunAngle;
  
  const sunDist = 500;
  const sunX = Math.cos(sunAngle * Math.PI) * sunDist;
  const sunY = Math.max(0.1, Math.sin(sunAngle * Math.PI) * sunDist);
  const sunZ = Math.sin(sunAngle * Math.PI) * (sunDist / 2);

  // Dynamic Apollo Lighting calculations
  const elevation = Math.max(0, Math.sin(sunAngle * Math.PI));
  
  // Stark bright sun at noon, dim at horizon
  const sunIntensity = THREE.MathUtils.lerp(0.5, 12.0, elevation);
  
  // Pitch black shadows at noon (no atmosphere), spooky blue fill at horizon
  const fillIntensity = THREE.MathUtils.lerp(0.6, 0.02, elevation);
  
  const sunColor = React.useMemo(() => {
    return new THREE.Color("#8c9cb5").lerp(new THREE.Color("#ffffff"), elevation);
  }, [elevation]);

  const mountainsRef = useRef();
  const lightRef = useRef();
  const lightTargetRef = useRef(new THREE.Object3D());

  useFrame((state) => {
    if (mountainsRef.current) {
      mountainsRef.current.position.x = state.camera.position.x;
      mountainsRef.current.position.z = state.camera.position.z;
    }
    if (lightRef.current && lightTargetRef.current) {
      // Texel Snapping to prevent shadow shimmering
      const shadowCameraSize = 700; // shadow camera width (350 * 2)
      const shadowMapSize = 4096;
      const texelSize = shadowCameraSize / shadowMapSize;

      const snappedX = Math.round(state.camera.position.x / texelSize) * texelSize;
      const snappedY = Math.round(state.camera.position.y / texelSize) * texelSize;
      const snappedZ = Math.round(state.camera.position.z / texelSize) * texelSize;

      lightTargetRef.current.position.set(snappedX, snappedY, snappedZ);
      lightRef.current.position.set(
        snappedX + sunX,
        snappedY + sunY,
        snappedZ + sunZ
      );
    }
  });

  return (
    <>
      <ambientLight name="Fill" intensity={fillIntensity} color="#7f8bad" />
      <ambientLight intensity={0.02} />
      <primitive object={lightTargetRef.current} />
      <directionalLight
        ref={lightRef}
        target={lightTargetRef.current}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera 
          attach="shadow-camera" 
          args={[-350, 350, 350, -350, 0.1, 4000]} 
        />
      </directionalLight>
      <group ref={mountainsRef}>
        <DistantMountains />
      </group>
      <LunarSky skyMode={skyMode} starsMode={starsMode} />
    </>
  );
}
