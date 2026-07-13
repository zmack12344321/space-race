import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";

function App() {
  return (
    <>
      <UI />
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.65,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ position: [4.2, 1.5, 7.5], fov: 45, near: 0.5, far: 2500 }}
      >
        <color attach="background" args={["#02040a"]} />
        <Experience />
      </Canvas>
    </>
  );
}

export default App;
