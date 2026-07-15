import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { myPlayer, usePlayersList } from "../../multiplayer/party";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { Lobby as LunarLobby } from "../environment/Lobby";
import { LunarPreview } from "../environment/LunarPreview";
import { Physics } from "@react-three/rapier";
import { getLobbyCameraLookAt, sortLobbyPlayers } from "../environment/lobbyLayout";

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
  const players = sortLobbyPlayers(usePlayersList(true), me?.id);
  const playerCount = players.length;
  const isPreviewMode = typeof window !== "undefined" && new URL(window.location.href).searchParams.get("preview") === "1";

  const viewport = useThree((state) => state.viewport);
  const adjustCamera = () => {
    const distFactor = 10 / viewport.getCurrentViewport(cameraReference.current, new Vector3(0, 0, 0)).width;
    const pose = getLobbyCameraLookAt(playerCount);
    controls.current.setLookAt(
      pose.position[0] * distFactor,
      pose.position[1] * distFactor,
      pose.position[2] * distFactor,
      pose.target[0],
      pose.target[1],
      pose.target[2],
      true
    );
  };

  useEffect(() => {
    adjustCamera();
  }, [playerCount]);

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
      <Physics paused>
        {isPreviewMode ? <LunarPreview players={players} me={me} /> : <LunarLobby players={players} me={me} />}
      </Physics>
    </>
  );
};
