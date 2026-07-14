import { Canvas } from "@react-three/fiber";
import { useAtom } from "jotai";
import * as THREE from "three";
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from "@react-three/drei";
import { Experience } from "./components/core/Experience";
import { UI } from "./components/ui/UI";
import { PhysicsDebugAtom } from "./components/ui/debugState";
import { useMultiplayerState } from "./multiplayer/party";

function App() {
  const isTestMode = window.location.pathname.startsWith("/test");
  useMultiplayerState("gameState", isTestMode ? "game" : "title");
  const [physicsDebug] = useAtom(PhysicsDebugAtom);

  return (
    <>
      <UI />
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 2]}
        gl={{
          antialias: window.devicePixelRatio <= 1,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.65,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ position: [4.2, 1.5, 7.5], fov: 45, near: 0.5, far: 2500 }}
      >
        <color attach="background" args={["#02040a"]} />
        <PerformanceMonitor>
          <AdaptiveEvents />
          <AdaptiveDpr pixelated />
          <Experience level={isTestMode ? "skatepark" : "lunar"} physicsDebug={physicsDebug} debugMode={isTestMode} />
        </PerformanceMonitor>
      </Canvas>
    </>
  );
}

export default App;
