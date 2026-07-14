import { Billboard, Box, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom } from "jotai";
import { startTransition, useEffect, useRef, useState } from "react";
import { MathUtils } from "three";
import { audios, playAudio } from "../../utils/AudioManager";
import { Rider } from "../vehicles/Rider";
import { NameEditingAtom } from "../ui/UI";
import { PlayerNameTag } from "./PlayerNameTag";

const CAR_SPACING = 2.5;
const SWITCH_DURATION = 600;

// Mock data so Triplex can render this scene standalone (no live PlayroomKit
// room). The production Lobby passes the REAL players/me via props, so any
// transform you drag here is written into this file and ships in the build —
// exactly like Rider.jsx. This is NOT a sandbox: Lobby renders <Garage/>.
const MOCK_PLAYERS = [
  {
    id: "me",
    state: { name: "You", vehicle: "longboard" },
    getState: (key) => ({ name: "You", vehicle: "longboard" })[key],
  },
];

// SINGLE exported component = the one Triplex scene (no Component Switcher
// clutter) AND the production garage used by Lobby. Every object worth moving
// is wrapped in a named literal group so Triplex can select/drag it.
export function Garage({
  players = MOCK_PLAYERS,
  me = MOCK_PLAYERS[0],
  showUi = true,
}) {
  const [, setNameEditing] = useAtom(NameEditingAtom);
  const animatedLight = useRef();

  const { scene } = useGLTF("/models/garage.glb");
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  useFrame(({ clock }) => {
    if (animatedLight.current) {
      animatedLight.current.position.x = Math.sin(clock.getElapsedTime() * 0.5) * 2;
    }
  });

  const shadowBias = -0.005;
  const shadowMapSize = 2048;

  return (
    <group scale={[0.66, 0.66, 0.66]}>
      {/* Garage model — drag this to reposition the whole garage */}
      <group name="GarageModel" position={[0, 0, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
        <primitive object={scene} />
      </group>

      <group name="BlueLight" position={[5.5, 0.5, -1.2]}>
        <pointLight intensity={3} distance={15} decay={3} color="#4124c9" />
        <Box scale={[0.1, 0.1, 0.1]} visible={false}>
          <meshBasicMaterial color="white" />
        </Box>
      </group>
      <group name="PurpleLight" position={[-3, 3, -2]}>
        <pointLight intensity={3} decay={3} distance={6} color="#a5adff" />
        <Box scale={[0.1, 0.1, 0.1]} visible={false}>
          <meshBasicMaterial color="white" />
        </Box>
      </group>
      <group name="OrangeLight" position={[0, 2.5, 0.5]} ref={animatedLight}>
        <pointLight
          intensity={0.9}
          decay={2}
          distance={10}
          castShadow
          color="#f7d216"
          shadow-bias={shadowBias}
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
        />
        <Box scale={[0.1, 0.1, 0.1]} visible={false}>
          <meshBasicMaterial color="white" />
        </Box>
      </group>
      <directionalLight name="DirLight" position={[6, 4, 6]} intensity={0.4} color="white" />

      {players.map((player, idx) => (
        <group
          key={player.id}
          name={`Player_${player.id}`}
          position={[
            idx * CAR_SPACING - ((players.length - 1) * CAR_SPACING) / 2,
            0,
            0,
          ]}
          scale={[0.8, 0.8, 0.8]}
        >
          {showUi && (
            <PlayerNameTag
              position={[0.86, 2.34, 0]}
              name={player.state.name || player.state.profile.name}
              isMe={player.id === me?.id}
              onEdit={() => setNameEditing(true)}
              editable
            />
          )}

          <group
            name="Rider"
            position={[0, player.id === me?.id ? 0.15 : 0, 0]}
            scale={[0.46, 0.46, 0.46]}
          >
            <VehicleSwitcher player={player} />
          </group>

          {player.id === me?.id && (
            <group name="Platform">
              <pointLight position={[1, 2, 0]} intensity={2} distance={3} />
              <group rotation={[-1.5708, 0, 0]} position={[0, 0.01, 0]}>
                <mesh receiveShadow>
                  <circleGeometry args={[2.2, 64]} />
                  <meshStandardMaterial
                    color="pink"
                    toneMapped={false}
                    emissive={"pink"}
                    emissiveIntensity={1.2}
                  />
                </mesh>
              </group>
              <mesh position={[0, 0.1, 0]} receiveShadow>
                <cylinderGeometry args={[2, 2, 0.2, 64]} />
                <meshStandardMaterial color="#8572af" />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

function VehicleSwitcher({ player }) {
  const changedVehicleAt = useRef(0);
  const swapTimeout = useRef();
  const container = useRef();
  const [vehicleModel, setCurrentVehicleModel] = useState(player.getState("vehicle"));
  const newVehicle = player.getState("vehicle");

  useEffect(() => {
    if (newVehicle === vehicleModel) return;

    playAudio(audios.ride_start);
    changedVehicleAt.current = Date.now();
    clearTimeout(swapTimeout.current);
    swapTimeout.current = setTimeout(() => {
      startTransition(() => {
        setCurrentVehicleModel(newVehicle);
      });
    }, SWITCH_DURATION / 2);

    return () => clearTimeout(swapTimeout.current);
  }, [newVehicle, vehicleModel]);

  useFrame(() => {
    const timeSinceChange = Date.now() - changedVehicleAt.current;
    if (timeSinceChange < SWITCH_DURATION / 2) {
      container.current.rotation.y += 2 * (timeSinceChange / SWITCH_DURATION / 2);
      container.current.scale.x =
        container.current.scale.y =
        container.current.scale.z =
        1 - timeSinceChange / SWITCH_DURATION / 2;
    } else if (timeSinceChange < SWITCH_DURATION) {
      container.current.rotation.y += 4 * (1 - timeSinceChange / SWITCH_DURATION);
      container.current.scale.x =
        container.current.scale.y =
        container.current.scale.z =
        timeSinceChange / SWITCH_DURATION;
      if (container.current.rotation.y > Math.PI * 2) {
        container.current.rotation.y -= Math.PI * 2;
      }
    }
    if (timeSinceChange >= SWITCH_DURATION) {
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        Math.PI * 2,
        0.1
      );
    }
  }, []);
  return (
    <>
      <Rider model={vehicleModel} preview={false} showVehicle={false} />
      <group ref={container}>
        <Rider model={vehicleModel} preview={false} showDog={false} />
      </group>
    </>
  );
}

useGLTF.preload("/models/garage.glb");
