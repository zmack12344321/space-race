import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { myPlayer, usePlayersList } from "../multiplayer/party";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { Lunar1 } from "./Lunar1";

export const Lobby = () => {
  const controls = useRef();
  const cameraReference = useRef();
  const me = myPlayer();
  const players = usePlayersList(true);
  players.sort((a, b) => a.id.localeCompare(b.id));

  useFrame(({ clock }) => {
    if (!controls.current) return;
    controls.current.camera.position.x +=
      Math.cos(clock.getElapsedTime() * 0.5) * 0.25;
    controls.current.camera.position.y +=
      Math.sin(clock.getElapsedTime() * 1) * 0.125;
  });

  const viewport = useThree((state) => state.viewport);
  const adjustCamera = () => {
    const distFactor =
      10 /
      viewport.getCurrentViewport(cameraReference.current, new Vector3(0, 0, 0))
        .width;
    controls.current.setLookAt(
      9.5 * distFactor,
      4.5 * distFactor,
      17.5 * distFactor,
      0,
      0.3,
      0,
      true
    );
  };

  useEffect(() => {
    adjustCamera();
  }, [players]);

  useEffect(() => {
    const onResize = () => {
      adjustCamera();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <PerspectiveCamera ref={cameraReference} position={[0, 1, 10]} />
      <CameraControls
        ref={controls}
        mouseButtons={{
          left: 0,
          middle: 0,
          right: 0,
          wheel: 16, // ACTION.ZOOM -> true zoom in/out with mousewheel
        }}
        touches={{
          one: 0,
          two: 0,
        }}
      />
      <Lunar1 players={players} me={me} />
    </>
  );
};
