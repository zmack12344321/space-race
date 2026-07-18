import { Canvas } from "@react-three/fiber";
import { useAtom } from "jotai";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor, Preload } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, SMAA } from "@react-three/postprocessing";
import { Experience } from "./components/core/Experience";
import { UI } from "./components/ui/UI";
import { NetDebugOverlay } from "./components/ui/NetDebugOverlay";
import { PhysicsDebugAtom } from "./components/ui/debugState";
import { debugMetrics } from "./components/ui/debugMetrics";
import { useGameSettings } from "./components/ui/gameSettingsStore";
import { useMultiplayerState } from "./multiplayer/party";
import { ShaderPreview } from "./components/environment/ShaderPreview";
import { applyAudioSettings } from "./utils/AudioManager";

function App() {
  const isTestMode = window.location.pathname.startsWith("/test");
  const isShaderPreview = window.location.pathname.startsWith("/shader");
  useMultiplayerState("gameState", isTestMode || isShaderPreview ? "game" : "title");
  const [physicsDebug] = useAtom(PhysicsDebugAtom);
  const aaMode = useGameSettings((state) => state.aaMode);
  const dprCap = useGameSettings((state) => state.dprCap);
  const adaptiveDpr = useGameSettings((state) => state.adaptiveDpr);
  const starsMode = useGameSettings((state) => state.starsMode);
  const masterVolume = useGameSettings((state) => state.masterVolume);
  const sfxVolume = useGameSettings((state) => state.sfxVolume);
  const useRendererAA = aaMode === "renderer" || aaMode === "multisample4" || aaMode === "multisample8";
  const multisampling = aaMode === "multisample4" ? 4 : aaMode === "multisample8" ? 8 : 0;
  // Netcode debug overlay: on by default in /test, toggle anywhere with backtick (`).
  const [showNetDebug, setShowNetDebug] = useState(isTestMode);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "`" || e.code === "Backquote") {
        e.preventDefault();
        setShowNetDebug((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    applyAudioSettings({ masterVolume, sfxVolume });
  }, [masterVolume, sfxVolume]);

  if (isShaderPreview) {
    return <ShaderPreview />;
  }

  return (
    <>
      <UI />
      {showNetDebug && <NetDebugOverlay />}
      <div className="fixed inset-0">
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          dpr={[1, dprCap]}
          gl={{
            antialias: useRendererAA,
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
            {adaptiveDpr ? <AdaptiveDpr /> : null}
            <Preload all />
            <DebugMetricsBridge />
            {aaMode === "multisample4" || aaMode === "multisample8" ? <EffectComposer multisampling={multisampling} /> : null}
            {aaMode === "smaa" ? (
              <Suspense fallback={null}>
                <EffectComposer multisampling={0}>
                  <SMAA />
                </EffectComposer>
              </Suspense>
            ) : null}
            <Experience
              level={isTestMode ? "test" : "lunar"}
              physicsDebug={physicsDebug}
              debugMode={isTestMode}
              skyMode="purple"
              starsMode={starsMode}
            />
          </PerformanceMonitor>
        </Canvas>
      </div>
    </>
  );
}

export default App;

function DebugMetricsBridge() {
  const gl = useThree((state) => state.gl);
  const last = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const frameMs = Math.max(0, now - last.current);
    last.current = now;
    const fps = frameMs > 0 ? 1000 / frameMs : 0;
    const info = gl.info;

    debugMetrics.fps = fps;
    debugMetrics.frameMs = frameMs;
    debugMetrics.drawCalls = info.render.calls;
    debugMetrics.triangles = info.render.triangles;
    debugMetrics.lines = info.render.lines;
    debugMetrics.points = info.render.points;
    debugMetrics.geometries = info.memory.geometries;
    debugMetrics.textures = info.memory.textures;
  });

  return null;
}
