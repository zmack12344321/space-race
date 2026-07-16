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

function StarLayers({ starsMode = "lean" }) {
  const group = useRef();
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    if (group.current) group.current.position.copy(camera.position);
  });

  return (
    <group ref={group} frustumCulled={false} renderOrder={-100}>
      {starsMode !== "off" && (
        <>
          <Stars radius={760} depth={260} count={starsMode === "full" ? 20000 : 12000} factor={starsMode === "full" ? 4.2 : 3.4} saturation={0} fade={false} speed={0} renderOrder={-100} />
          <Stars radius={1020} depth={360} count={starsMode === "full" ? 32000 : 18000} factor={starsMode === "full" ? 2.8 : 2.2} saturation={0} fade={false} speed={0} renderOrder={-101} />
          {starsMode === "full" && <Stars radius={1360} depth={480} count={42000} factor={1.8} saturation={0.05} fade={false} speed={0} renderOrder={-102} />}
        </>
      )}
    </group>
  );
}

export function NewMoonSky({ skyMode = "blue", starsMode = "lean" }) {
  const sky = SKYBOXES[skyMode] ?? SKYBOXES.blue;
  const showStars = skyMode !== "none" && starsMode !== "off";

  return (
    <>
      {skyMode !== "stars" && <Environment background="only" files={sky.files} path={sky.path} />}
      {showStars && <StarLayers starsMode={starsMode} />}
    </>
  );
}
