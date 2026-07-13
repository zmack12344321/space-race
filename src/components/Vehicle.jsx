import { useEffect, useRef } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import { VEHICLE_GLB_MODELS } from "./vehicleConfig";

// Loads + clones one vehicle model with NO transform of its own — placement/
// scale is owned by the literal <group> that wraps <Vehicle> in Rider.jsx
// (single source of truth, edited live in Triplex). This file exports exactly
// one component.
export const Vehicle = ({ model = "longboard", ...props }) => {
  const { scene } = useGLTF(`/models/vehicles/${model}-transformed.glb`, "/draco/");
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    ref.current.traverse((o) => {
      if (/collider/i.test(o.name)) o.visible = false;
    });
  }, [scene]);
  return (
    <group {...props} ref={ref}>
      <Clone object={scene} castShadow />
    </group>
  );
};

VEHICLE_GLB_MODELS.forEach((model) => {
  useGLTF.preload(`/models/vehicles/${model}-transformed.glb`, "/draco/");
});
