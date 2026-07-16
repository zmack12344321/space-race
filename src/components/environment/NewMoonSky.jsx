import { Stars, Environment } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";

const SKYBOXES = {
  blue: {
    path: "/_assets-to-import/skybox-blue/",
    files: ["right-512.jpg", "left-512.jpg", "top-512.jpg", "bottom-512.jpg", "front-512.jpg", "back-512.jpg"],
  },
  purple: {
    path: "/_assets-to-import/skybox-purple/",
    files: ["right-512.jpg", "left-512.jpg", "top-512.jpg", "bottom-512.jpg", "front-512.jpg", "back-512.jpg"],
  },
};

function StarLayers() {
  const group = useRef();
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    if (group.current) group.current.position.copy(camera.position);
  });

  return (
    <group ref={group} frustumCulled={false} renderOrder={-100}>
      <Stars radius={760} depth={260} count={20000} factor={4.2} saturation={0} fade={false} speed={0} renderOrder={-100} />
      <Stars radius={1020} depth={360} count={32000} factor={2.8} saturation={0} fade={false} speed={0} renderOrder={-101} />
      <Stars radius={1360} depth={480} count={42000} factor={1.8} saturation={0.05} fade={false} speed={0} renderOrder={-102} />
    </group>
  );
}

export function NewMoonSky({ skyMode = "blue" }) {
  const sky = SKYBOXES[skyMode] ?? SKYBOXES.blue;
  const showStars = skyMode !== "none";

  return (
    <>
      {skyMode !== "stars" && <Environment background="only" files={sky.files} path={sky.path} />}
      {showStars && <StarLayers />}
    </>
  );
}
