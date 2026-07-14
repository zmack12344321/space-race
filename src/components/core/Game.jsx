import * as THREE from "three";
import { Environment, Gltf, Lightformer } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { useCustomGravity } from "ecctrl/gravity";
import { Joystick, onPlayerJoin } from "../../multiplayer/party";
import { useEffect, useRef, useState } from "react";
import { Vector3 } from "three";
import { RiderController } from "../vehicles/RiderController";
import { GameArea } from "../environment/GameArea";
import { Skatepark } from "../environment/Skatepark";
import { LunarSky, LunarTerrain } from "../environment/LunarTerrain";
import { LunarRocks } from "../environment/LunarRocks";
import { LunarEnvironment } from "../environment/LunarEnvironment";
import { getLunarHeight, getLunarSpawnCenter } from "../../utils/lunarHeightfield";
import { useMultiplayerState } from "../../multiplayer/party";
import { useFrame, useThree } from "@react-three/fiber";


function GravitySetup() {
  const setGravityField = useCustomGravity((state) => state.setGravityField);
  const gravity = useRef(new Vector3(0, -9.81, 0));

  useEffect(() => {
    setGravityField(() => gravity.current);
  }, [setGravityField]);

  return null;
}

export const Game = ({ level = "lunar", physicsDebug = false, debugMode = false }) => {
  const [players, setPlayers] = useState([]);
  const [sunAngle] = useMultiplayerState("sunAngle", 0.3);
  const mountainsRef = useRef();
  const lightRef = useRef();
  const lightTargetRef = useRef(new THREE.Object3D());
  const sunDist = 220;
  const sunX = Math.cos(sunAngle * Math.PI) * sunDist;
  const sunY = Math.max(20, Math.sin(sunAngle * Math.PI) * sunDist);
  const sunZ = Math.sin(sunAngle * Math.PI) * (sunDist / 2);
  const sunElevation = Math.max(0, Math.sin(sunAngle * Math.PI));
  const sunIntensity = THREE.MathUtils.lerp(0.6, 7.5, sunElevation);
  const fillIntensity = THREE.MathUtils.lerp(0.45, 0.08, sunElevation);

  useEffect(() => {
    const activeControls = new Map();
    const unsubscribe = onPlayerJoin((state) => {
      const controls = new Joystick(state, {
        type: "angular",
        buttons: [{ id: "Respawn", label: "Spawn" }],
      });
      activeControls.set(state.id, controls);
      const newPlayer = { state, controls };
      setPlayers((players) => [
        ...players.filter((p) => p.state.id !== state.id),
        newPlayer,
      ]);
      state.onQuit(() => {
        controls.cleanup?.();
        activeControls.delete(state.id);
        setPlayers((players) => players.filter((p) => p.state.id !== state.id));
      });
    });
    return () => {
      unsubscribe();
      activeControls.forEach((controls) => controls.cleanup?.());
    };
  }, []);

  return (
    <group>
      {level === "lunar" ? (
        <LunarEnvironment />
      ) : (
        <>
          <ambientLight intensity={fillIntensity} color="#7f8bad" />
          <Environment>
            <Lightformer
              position={[sunX, sunY, sunZ]}
              form="rect"
              intensity={sunIntensity}
              color={sunElevation > 0.5 ? "white" : "#9aa6cc"}
              scale={[18, 18]}
              target={[0, 0, 0]}
            />
          </Environment>
          <pointLight position={[0, 5, 0]} intensity={1.2} distance={30} />
          <directionalLight
            position={[sunX, sunY, sunZ]}
            intensity={sunIntensity}
            color={sunElevation > 0.5 ? "white" : "#d7deff"}
            castShadow
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
            shadow-mapSize={[2048, 2048]}
          />
        </>
      )}
      <Physics gravity={[0, 0, 0]} debug={physicsDebug}>
        <GravitySetup />
        {level === "lunar" && <LunarTerrain />}
        {level === "lunar" && <LunarRocks />}
        {players.map(({ state, controls }) => (
          <RiderController
            key={state.id}
            state={state}
            controls={controls}
            getGroundHeight={level === "lunar" ? getLunarHeight : level === "skatepark" ? () => 0 : undefined}
            debugMode={debugMode}
          />
        ))}
        {level === "lunar" ? null : level === "skatepark" ? (
          <Skatepark />
        ) : (
          <>
            <RigidBody type="fixed" colliders="hull" rotation={[0, Math.PI, 0]}>
              <GameArea />
            </RigidBody>
            <Gltf src="/models/map_road.glb" />
          </>
        )}
        {level !== "lunar" && (
          <RigidBody
            type="fixed"
            sensor
            colliders={false}
            position={[0, -5, 0]}
            name="void"
          >
            <CuboidCollider args={[20, 3, 20]} />
          </RigidBody>
        )}
      </Physics>
    </group>
  );
};
