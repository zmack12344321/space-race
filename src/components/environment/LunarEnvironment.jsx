import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMultiplayerState } from "../../multiplayer/party";
import { DistantMountains } from "./DistantMountains";
import { LunarSky } from "./LunarTerrain";
import { useGameSettings } from "../ui/gameSettingsStore";
import { SunLightRig } from "./SunLightRig";

export function LunarEnvironment({ seed, sunAngle: sunAngleProp, skyMode = "blue", starsMode = "lean" } = {}) {
  const [roomSunAngle] = useMultiplayerState("sunAngle", 0.94);
  const sunAngle = sunAngleProp ?? roomSunAngle;
  const shadowDistance = useGameSettings((state) => state.shadowDistance);
  const mountainsRef = useRef();

  // Dynamic Apollo Lighting calculations
  const elevation = Math.max(0, Math.sin(sunAngle * Math.PI));
  
  // Stark bright sun at noon, dim at horizon
  const sunIntensity = THREE.MathUtils.lerp(0.5, 12.0, elevation);
  
  // Pitch black shadows at noon (no atmosphere), spooky blue fill at horizon
  const fillIntensity = THREE.MathUtils.lerp(0.6, 0.02, elevation);
  
  const sunColor = useMemo(() => {
    return new THREE.Color("#8c9cb5").lerp(new THREE.Color("#ffffff"), elevation);
  }, [elevation]);

  useFrame((state) => {
    if (!mountainsRef.current) return;
    mountainsRef.current.position.x = state.camera.position.x;
    mountainsRef.current.position.z = state.camera.position.z;
  });

  return (
    <>
      <ambientLight name="Fill" intensity={fillIntensity} color="#7f8bad" />
      <ambientLight intensity={0.02} />
      <SunLightRig
        sunAngle={sunAngle}
        sunDist={500}
        intensity={sunIntensity}
        color={sunColor}
        shadowDistance={shadowDistance}
        shadowMapSize={2048}
        shadowNormalBias={0.04}
      />
      <group ref={mountainsRef}>
        <DistantMountains seed={seed ?? 1} />
      </group>
      <LunarSky skyMode={skyMode} starsMode={starsMode} />
    </>
  );
}
