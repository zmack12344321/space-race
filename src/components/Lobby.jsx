import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { myPlayer, usePlayersList } from "../multiplayer/party";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { Lunar1 } from "./Lunar1";

const CAMERA_ACTION = {
  ROTATE: 1,
  DOLLY: 16,
  TOUCH_ROTATE: 32,
  TOUCH_DOLLY: 512,
};

export const Lobby = () => {
  const controls = useRef();
  const cameraReference = useRef();
  const me = myPlayer();
  const players = usePlayersList(true);
  players.sort((a, b) => a.id.localeCompare(b.id));

  const viewport = useThree((state) => state.viewport);
  const adjustCamera = () => {
    const distFactor =
      10 /
      viewport.getCurrentViewport(cameraReference.current, new Vector3(0, 0, 0))
        .width;
    controls.current.setLookAt(
      7.4 * distFactor,
      3.1 * distFactor,
      12.2 * distFactor,
      0,
      0.75,
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
      <PerspectiveCamera ref={cameraReference} position={[0, 1, 10]} fov={40} />
      <CameraControls
        ref={controls}
        minDistance={5}
        maxDistance={55}
        mouseButtons={{
          left: CAMERA_ACTION.ROTATE,
          middle: 0,
          right: 0,
          wheel: CAMERA_ACTION.DOLLY,
        }}
        touches={{
          one: CAMERA_ACTION.TOUCH_ROTATE,
          two: CAMERA_ACTION.TOUCH_DOLLY,
        }}
      />
      <Lunar1 players={players} me={me} />
    </>
  );
};
