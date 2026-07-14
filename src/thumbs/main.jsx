import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { Rider } from "../components/vehicles/Rider.jsx";
import { VEHICLE_MODELS } from "../components/vehicles/vehicleConfig.js";

const SELECTOR_POSES = {
  longboard: { rotation: [0.08, 0.82, 0], camera: [0.28, 0.08, 1.16] },
  skateboard: { rotation: [-0.06, -0.84, 0], camera: [-0.28, 0.08, 1.16] },
  surfboard_lucid_sn1: { rotation: [0.16, 1.2, 0], camera: [0.1, 0.22, 1.22] },
  arcadiaBoard: { rotation: [0.06, 1.05, 0], camera: [0.18, 0.14, 1.12] },
  ufo: { rotation: [0, 0, 0], camera: [0.02, 0.24, 1.04] },
  goKart: { rotation: [0.1, 0.44, 0], camera: [0.06, 0.12, 1.14] },
};

const LOADING_POSES = {
  longboard: { rotation: [0.14, 0.35, 0], camera: [0.22, 0.06, 1.0], zoom: 1.16 },
  skateboard: { rotation: [-0.1, -0.52, 0], camera: [-0.22, 0.06, 1.0], zoom: 1.16 },
  surfboard_lucid_sn1: { rotation: [0.08, 0.72, 0], camera: [0.12, 0.18, 1.04], zoom: 1.12 },
  arcadiaBoard: { rotation: [0.04, 0.9, 0], camera: [0.16, 0.1, 0.98], zoom: 1.15 },
  ufo: { rotation: [0, 0, 0], camera: [0.01, 0.18, 0.9], zoom: 1.1 },
  goKart: { rotation: [0.08, 0.22, 0], camera: [0.06, 0.08, 0.96], zoom: 1.14 },
};

function setThumbReady(value) {
  window.__THUMB_READY__ = value;
}

function useSelectedModel() {
  return useMemo(() => {
    const model = new URLSearchParams(window.location.search).get("model");
    return VEHICLE_MODELS.includes(model) ? model : VEHICLE_MODELS[0];
  }, []);
}

function useVariant() {
  return useMemo(() => {
    const variant = new URLSearchParams(window.location.search).get("variant");
    return variant === "loading" ? "loading" : "selector";
  }, []);
}

function CameraFitter({ targetRef, pose, onReady }) {
  const { camera, invalidate } = useThree();
  const { active } = useProgress();
  const fitted = useRef(false);

  useLayoutEffect(() => {
    if (active || fitted.current || !targetRef.current) return;

    const box = new Box3().setFromObject(targetRef.current);
    if (box.isEmpty()) return;

    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const fov = (camera.fov * Math.PI) / 180;
    const distance = (maxSize / (2 * Math.tan(fov / 2))) * (pose.zoom ?? 1.45);
    const [dx, dy, dz] = pose.camera;

    camera.position.set(center.x + distance * dx, center.y + distance * dy, center.z + distance * dz);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 100;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    fitted.current = true;
    onReady();
    invalidate();
  }, [active, camera, invalidate, onReady, targetRef]);

  return null;
}

function ThumbScene({ model }) {
  const frameRef = useRef();
  const variant = useVariant();
  const pose = (variant === "loading" ? LOADING_POSES : SELECTOR_POSES)[model] ?? (variant === "loading" ? LOADING_POSES.longboard : SELECTOR_POSES.longboard);

  useEffect(() => {
    setThumbReady(false);
  }, [model]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "transparent" }}>
      <Canvas
        dpr={1}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 1, 8], fov: 35, near: 0.01, far: 1000 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[4, 8, 6]} intensity={2.2} />
        <directionalLight position={[-5, 3, 5]} intensity={0.9} />
        <directionalLight position={[0, -3, 4]} intensity={0.4} />
        <Suspense fallback={null}>
          <group ref={frameRef} rotation={pose.rotation}>
            <Rider model={model} preview={false} showDog={false} showVehicle />
          </group>
          <CameraFitter
            targetRef={frameRef}
            pose={pose}
            onReady={() => {
              setThumbReady(true);
            }}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

function App() {
  const model = useSelectedModel();

  useEffect(() => {
    setThumbReady(false);
  }, []);

  return <ThumbScene model={model} />;
}

window.__THUMB_READY__ = false;
createRoot(document.getElementById("root")).render(<App />);
