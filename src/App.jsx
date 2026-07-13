import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Leva } from "leva";
import * as THREE from "three";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";

function App() {
  return (
    <>
      <UI />
      <Leva hidden />
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ position: [4.2, 1.5, 7.5], fov: 45, near: 0.5, far: 2500 }}
      >
        <color attach="background" args={["#02040a"]} />
        <Experience />
        <EffectComposer>
          <Bloom luminanceThreshold={1} intensity={1.22} />
        </EffectComposer>
      </Canvas>
    </>
  );
}

export default App;
