import { Joystick, onPlayerJoin } from "../../multiplayer/party";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { Environment, Gltf, Lightformer } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { GameArea } from "../environment/GameArea";
import { Skatepark } from "../environment/Skatepark";
import { SunLightRig } from "../environment/SunLightRig";
import { LunarWorld } from "../environment/LunarWorld";
import { useMultiplayerState } from "../../multiplayer/party";
import { useAtomValue } from "jotai";
import { GameMenuOpenAtom, GameInputFrozenAtom } from "../ui/UI";
import { useGameSettings } from "../ui/gameSettingsStore";
import { RiderController } from "../vehicles/RiderController";
import { LaserSystem } from "../vehicles/LaserSystem";
import { getLunarHeight } from "../../utils/lunarHeightfield";

// Minimal flat-plane test arena: two players spawn facing each other 10m apart
// so we can isolate netcode/lag/knockback without the full game world.
function TestArena({ shadowDistance }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <SunLightRig sunAngle={0.3} sunDist={220} intensity={2.5} color="white" shadowDistance={shadowDistance} shadowMapSize={1024} shadowNormalBias={0.02} minSunY={20} />
      <pointLight position={[0, 6, 0]} intensity={0.6} distance={40} />
      <color attach="background" args={["#0a0e1a"]} />
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#2a2f3a" />
        </mesh>
      </RigidBody>
      {/* Void catch so fallers respawn instead of flying forever */}
      <RigidBody type="fixed" sensor colliders={false} position={[0, -10, 0]} name="void">
        <CuboidCollider args={[40, 3, 40]} />
      </RigidBody>
    </>
  );
}

export const Game = ({ level = "lunar", physicsDebug = false, debugMode = false, skyMode = "blue", starsMode = "lean" }) => {
  const [players, setPlayers] = useState([]);
  const paused = useAtomValue(GameMenuOpenAtom);
  const inputFrozen = useAtomValue(GameInputFrozenAtom);
  const [sunAngle] = useMultiplayerState("sunAngle", 0.3);
  const [lunarSeed] = useMultiplayerState("lunarSeed", 1337);
  const [raceMode] = useMultiplayerState("raceMode", false);
  const renderDistance = useGameSettings((state) => state.renderDistance);
  const shadowDistance = useGameSettings((state) => state.shadowDistance);
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
        <LunarWorld
          seed={lunarSeed}
          sunAngle={sunAngle}
          skyMode={skyMode}
          starsMode={starsMode}
          raceMode={raceMode}
          renderDistance={renderDistance}
          shadowDistance={shadowDistance}
          paused={paused}
          physicsDebug={physicsDebug}
          debugMode={debugMode}
          players={players}
        />
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
          <SunLightRig
            sunAngle={sunAngle}
            sunDist={sunDist}
            intensity={sunIntensity}
            color={sunElevation > 0.5 ? "white" : "#d7deff"}
            shadowDistance={shadowDistance}
            shadowMapSize={1024}
            shadowNormalBias={0.02}
            minSunY={20}
          />
        </>
      )}
      <Physics key={lunarSeed} gravity={[0, 0, 0]} debug={physicsDebug} paused={paused || inputFrozen}>
        {level === "lunar" ? null : level === "skatepark" ? (
          <Skatepark />
        ) : level === "test" ? (
          <TestArena shadowDistance={shadowDistance} />
        ) : (
          <>
            <RigidBody type="fixed" colliders="hull" rotation={[0, Math.PI, 0]}>
              <GameArea />
            </RigidBody>
            <Gltf src="/models/map_road.glb" />
          </>
        )}
        {level !== "lunar" &&
          players.map(({ state, controls }) => (
            <RiderController
              key={state.id}
              state={state}
              controls={controls}
              getGroundHeight={level === "skatepark" ? () => 0 : level === "test" ? () => 0 : getLunarHeight}
              testSpawn={level === "test"}
              debugMode={debugMode}
            />
          ))}
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
        {level !== "lunar" && (
          <LaserSystem
            getGroundHeight={level === "skatepark" ? () => 0 : level === "test" ? () => 0 : getLunarHeight}
          />
        )}
      </Physics>
    </group>
  );
};
