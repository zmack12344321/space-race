import { AdaptiveDpr, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";
import { ShaderSkyDome } from "./ShaderSkyDome";

const DEFAULTS = {
  megaScale: 920,
  planetScaleMultiplier: 1,
  brightnessMultiplier: 1,
  driftMultiplier: 1,
  glowMultiplier: 1,
};

const PRESETS = {
  halo: {
    megaScale: 1300,
    planetScaleMultiplier: 1.15,
    brightnessMultiplier: 0.82,
    driftMultiplier: 0.7,
    glowMultiplier: 0.55,
  },
  moody: {
    megaScale: 1100,
    planetScaleMultiplier: 0.95,
    brightnessMultiplier: 0.65,
    driftMultiplier: 0.5,
    glowMultiplier: 0.35,
  },
  huge: {
    megaScale: 1800,
    planetScaleMultiplier: 1.25,
    brightnessMultiplier: 0.7,
    driftMultiplier: 0.8,
    glowMultiplier: 0.45,
  },
};

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.86)" }}>
        <span>{label}</span>
        <span>{Number(value).toFixed(step < 0.1 ? 2 : 0)}</span>
      </div>
      <input className="game-slider" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function ShaderPreview() {
  const [settings, setSettings] = useState(DEFAULTS);

  const panelStyle = useMemo(
    () => ({
      position: "fixed",
      left: 16,
      bottom: 16,
      width: 340,
      maxWidth: "calc(100vw - 32px)",
      padding: 14,
      borderRadius: 16,
      background: "rgba(8, 12, 22, 0.78)",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
      backdropFilter: "blur(14px)",
      color: "white",
      zIndex: 10,
      pointerEvents: "auto",
    }),
    []
  );

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));
  const applyPreset = (name) => setSettings((prev) => ({ ...prev, ...PRESETS[name] }));
  const reset = () => setSettings(DEFAULTS);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#02040a" }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1.5, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.62 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ position: [0, 0, 8], fov: 45, near: 0.5, far: 6000 }}
      >
        <color attach="background" args={["#02040a"]} />
        <ShaderSkyDome
          megaScale={settings.megaScale}
          planetScale={settings.planetScaleMultiplier}
          brightness={settings.brightnessMultiplier}
          glow={settings.glowMultiplier}
          motion={settings.driftMultiplier}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={true}
          minDistance={4}
          maxDistance={14}
          rotateSpeed={0.5}
          target={[0, 1.6, 0]}
        />
      </Canvas>

      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "Passion One, sans-serif", fontSize: 22, letterSpacing: 0.5 }}>Shader Preview</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>localhost/shader</div>
          </div>
          <button className="ui-button" style={{ padding: "8px 10px", borderRadius: 10, background: "#f4f4f4", color: "#111", fontWeight: 800 }} onClick={reset}>
            Reset
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button className="ui-button" style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: "#1f2a44", color: "white", fontWeight: 700 }} onClick={() => applyPreset("halo")}>
            Halo
          </button>
          <button className="ui-button" style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: "#1f2a44", color: "white", fontWeight: 700 }} onClick={() => applyPreset("moody")}>
            Moody
          </button>
          <button className="ui-button" style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: "#1f2a44", color: "white", fontWeight: 700 }} onClick={() => applyPreset("huge")}>
            Huge
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <Slider label="Mega planet" value={settings.megaScale} min={600} max={2600} step={10} onChange={(v) => update("megaScale", v)} />
          <Slider label="Planet size" value={settings.planetScaleMultiplier} min={0.5} max={2} step={0.01} onChange={(v) => update("planetScaleMultiplier", v)} />
          <Slider label="Brightness" value={settings.brightnessMultiplier} min={0.2} max={1.2} step={0.01} onChange={(v) => update("brightnessMultiplier", v)} />
          <Slider label="Glow" value={settings.glowMultiplier} min={0} max={1} step={0.01} onChange={(v) => update("glowMultiplier", v)} />
          <Slider label="Motion" value={settings.driftMultiplier} min={0} max={2} step={0.01} onChange={(v) => update("driftMultiplier", v)} />
        </div>
      </div>
    </div>
  );
}
