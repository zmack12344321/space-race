import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ShaderSkyDome } from "./ShaderSkyDome";

export function ShaderPreview() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#02040a" }}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.72 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 100 }}
      >
        <color attach="background" args={["#02040a"]} />
        <ShaderSkyDome />
      </Canvas>
    </div>
  );
}
