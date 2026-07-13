import { Environment, Gltf, Lightformer } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { Joystick, onPlayerJoin } from "../multiplayer/party";
import { useEffect, useState } from "react";
import { RiderController } from "./RiderController";
import { GameArea } from "./GameArea";
import { Skatepark } from "./Skatepark";

// "skatepark" = new Triplex-ready basic-shape playground; "buildings" = the
// original GLB map. Switch here (or later wire to a UI/state toggle).
const LEVEL = "skatepark";

export const Game = () => {
  const [players, setPlayers] = useState([]);

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
      <ambientLight intensity={0.4} />
      <Environment>
        <Lightformer
          position={[5, 5, 5]}
          form="rect" // circle | ring | rect (optional, default = rect)
          intensity={1} // power level (optional = 1)
          color="white" // (optional = white)
          scale={[10, 10]} // Scale it any way you prefer (optional = [1, 1])
          target={[0, 0, 0]} // Target position (optional = undefined)
        />
      </Environment>
      <pointLight position={[0, 5, 0]} intensity={2.5} distance={10} />
      <pointLight
        position={[5, 5, 0]}
        intensity={10.5}
        distance={10}
        color="pink"
      />
      <pointLight
        position={[-5, 5, 0]}
        intensity={10.5}
        distance={15}
        color="blue"
      />
      <directionalLight position={[10, 10, 10]} intensity={0.4} />
      <Physics>
        {players.map(({ state, controls }) => (
          <RiderController key={state.id} state={state} controls={controls} />
        ))}
        {LEVEL === "skatepark" ? (
          <RigidBody type="fixed" colliders="cuboid">
            <Skatepark />
          </RigidBody>
        ) : (
          <>
            <RigidBody type="fixed" colliders="hull" rotation={[0, Math.PI, 0]}>
              <GameArea />
            </RigidBody>
            <Gltf src="/models/map_road.glb" />
          </>
        )}
        <RigidBody
          type="fixed"
          sensor
          colliders={false}
          position={[0, -5, 0]}
          name="void"
        >
          <CuboidCollider args={[20, 3, 20]} />
        </RigidBody>
      </Physics>
    </group>
  );
};
