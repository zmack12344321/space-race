import { useRef } from "react";
import * as THREE from "three";

// TEMPORARY lightweight thruster: a single emissive cylinder + a white
// point light. Used on the UFO + go-kart to save memory/perf until
// the full <HoverThruster> design is re-enabled there.
export const SimpleThruster = ({
  color = "#39ff88",
  scale = 1,
  intensity = 3,
  radius = 0.12,
  height = 0.5,
  opacity = 0.5,
  ...props
}) => {
  const groupRef = useRef();
  return (
    <group {...props} ref={groupRef} scale={scale}>
      <mesh position={[0, -height / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        position={[0, -0.02, 0]}
        color="white"
        intensity={intensity}
        distance={2.6}
        decay={2}
      />
    </group>
  );
};
