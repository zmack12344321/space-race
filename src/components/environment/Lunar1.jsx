import { Billboard, Gltf, BakeShadows, Preload } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom } from "jotai";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AdditiveBlending, Color, DoubleSide, FogExp2, MathUtils, ShaderMaterial } from "three";
import { audios, playAudio } from "../../utils/AudioManager";
import { LunarEnvironment } from "./LunarEnvironment";
import { Rider } from "../vehicles/Rider";
import { NameEditingAtom } from "../ui/UI";
import { getLobbySlotPosition } from "./lobbyLayout";
import { PlayerNameTag } from "./PlayerNameTag";

const SWITCH_DURATION = 600;
const FROZEN_BAKE = {
  seed: 1544803905,
  sunAngle: 0.87,
  surfaceY: 0.701851020602,
};

// Mock data so Triplex can render this scene standalone (no live PlayroomKit
// room). The production Lobby passes the REAL players/me via props, so any
// transform you drag here is written into this file and ships in the build —
// exactly like Rider.jsx. This is NOT a sandbox: Lobby renders <Lobby/>.
const MOCK_PLAYERS = [
  {
    id: "me",
    state: { name: "You", vehicle: "longboard" },
    getState: (key) => ({ name: "You", vehicle: "longboard" })[key],
  },
];

// SINGLE exported component = the one Triplex scene (no Component Switcher
// clutter) AND the production lunar lobby used by Lobby.
//
// SCALING: authored at a consistent real-world-ish scale (1 unit ~= 1 metre),
// root scale 1, environment scale 1, riders at a clean ~1.2-unit size.
//
// All the ground "look" knobs are exposed as props with explicit JSDoc types
// so Triplex reliably renders them as Component Controls (number inputs).
/**
 * @typedef {Object} LobbyProps
 * @property {any} [players] - Roster of riders to display.
 * @property {any} [me] - The local player.
 * @property {boolean} [showUi=true] - Show name billboards / edit affordances.
 * @property {number} [groundRepeat=60] - Base colour-tile size for the ground.
 * @property {number} [normalRepeat=240] - Bump/pebble density (tiny tiles).
 * @property {number} [dispRepeat=24] - Crater/relief density (large tiles).
 * @property {number} [normalScale=2.5] - Bump-map strength.
 * @property {number} [displacementScale=1.3] - Crater depth (pushes surface down).
 * @property {number} [roughness=1] - Surface matte-ness.
 */

export function Lobby(props) {
  const {
    players = MOCK_PLAYERS,
    me = MOCK_PLAYERS[0],
    showUi = true,
    hostId = me?.id,
  } = props;
  const [, setNameEditing] = useAtom(NameEditingAtom);

  const billboardRefs = useRef([]);
  const billboardBaseY = useRef([]);
  const crystalRef = useRef();
  const crystalBaseY = useRef();
  useFrame(({ clock }) => {
    billboardRefs.current.forEach((el, idx) => {
      if (!el) return;
      if (billboardBaseY.current[idx] === undefined) {
        billboardBaseY.current[idx] = el.position.y;
      }
      const isMe = players[idx]?.id === me?.id;
      el.position.y = billboardBaseY.current[idx] + bobOffset(clock, isMe);
    });
    if (crystalRef.current) {
      if (crystalBaseY.current === undefined) {
        crystalBaseY.current = crystalRef.current.position.y;
      }
      const t = clock.getElapsedTime();
      crystalRef.current.position.y = crystalBaseY.current + Math.sin(t * 1.6) * 0.12;
      crystalRef.current.rotation.y = t * 0.6;
    }
  });

  return (
    <group>
      <LunarEnvironment sunAngle={FROZEN_BAKE.sunAngle} />

      {/* Baked GLB lobby ground. */}
      <group name="Ground">
        <Gltf src="/models/lunar1-baked.glb" />
      </group>

      {/* Baked rock field. */}
      <group name="Rocks" position={[0, -FROZEN_BAKE.surfaceY, 0]}>
        <Gltf src="/models/lunar1-rocks.glb" />
      </group>

      <BakeShadows />
      <Preload all />
      {players.map((player, idx) => (
        <group
          key={player.id}
          name={`Player_${player.id}`}
          position={getLobbySlotPosition(idx)}
          scale={[1, 1, 1]}
        >
          {showUi && (
            <PlayerNameTag
              position={[0.29, 3.07, 0]}
              name={player.state.name || player.state.profile.name}
              isMe={player.id === me?.id}
              onEdit={() => setNameEditing(true)}
              editable
            />
          )}

          {/* Crown floating above the party leader (host). */}
          {player.id === hostId && (
            <group name="Crown" position={[0, 2.5, 0]}>
              <Crown />
            </group>
          )}

          {/* Rider — floats with a soft bob while customizing in the lobby */}
          <FloatingRider
            player={player}
            isMe={player.id === me?.id}
            onEdit={() => setNameEditing(true)}
          />

          {/* Uplight from below + glowing floor ring that lights the rider
              from underneath — every player gets their own. */}
          <pointLight
            position={[-0.03, 0.46, 0.2]}
            intensity={3}
            distance={4.5}
            decay={2}
            color="#cfe0ff" visible={true}
          />
          <mesh
            name="UplightRing"
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, 0]}
            receiveShadow
          >
            <ringGeometry args={[1.65, 2.0, 64]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#bcd4ff"
              emissiveIntensity={0.7}
              toneMapped={false}
              side={DoubleSide}
            />
          </mesh>

          {player.id === me?.id && (
            <group name="Platform">
              {/* Focused beam blasting up out of the ring — drag to reposition */}
              <group name="PodiumBeam" position={[0, 0.02, 0]}>
                <spotLight
                  position={[0, 4.5, 0]}
                  target-position={[0, 0, 0]}
                  intensity={5}
                  distance={7}
                  angle={0.42}
                  penumbra={0.85}
                  decay={2}
                  color="#cfe0ff"
                />
              </group>

              {/* Floating, clickable blue crystal on the left, lit by a blue
                  uplight rising from the ground. Drag the group or the light. */}
              <group name="Crystal" position={[-5.67, 0, 0]}>
                {/* Sharp white uplight rising out of the ground under the
                    crystal — mirrors the podium's uplight ring. */}
                <pointLight
                  name="CrystalUplight"
                  position={[5.72, 2.74, 1.95]}
                  intensity={1.54}
                  distance={4}
                  decay={2}
                  color="#ffffff" rotation={[-2.434878148559774, 0.9054646307249138, -0.28523647598641283]} visible={true}
                />
                <mesh
                  name="CrystalRing"
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[0, 0.02, 0]}
                  receiveShadow
                >
                  <ringGeometry args={[0.32, 0.48, 48]} />
                  <meshStandardMaterial
                    color="#ffffff"
                    emissive="#ffffff"
                    emissiveIntensity={0.8}
                    toneMapped={false}
                    side={DoubleSide}
                  />
                </mesh>
                <mesh
                  ref={crystalRef}
                  name="CrystalGem"
                  position={[-0.0300000000000002, 1.2, 0]}
                  castShadow
                  onClick={() => setNameEditing(true)}
                >
                  <octahedronGeometry args={[0.26, 0]} />
                  <meshStandardMaterial
                    color="#9fd8ff"
                    emissive="#2a7fff"
                    emissiveIntensity={0.8}
                    toneMapped={false}
                    roughness={0.2}
                    metalness={0.1}
                  />
                </mesh>
              </group>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

export { Lobby as Lunar1 };

// Focused, "Hollywood spotlight" volumetric cone that shoots straight up.
//
// It's a translucent frustum whose alpha softens toward the silhouette edges
// (via the view/normal dot, `anglePower`) and fades along its length. Because
// it's plain translucent geometry — NOT a bright emissive surface — you get a
// crisp beam that reads as glowing without ever tripping the Bloom
// `luminanceThreshold` (1.0), so it never washes the camera out. Crank
// `opacity`/`anglePower` freely for a tighter or brighter beam.
function LightBeam({
  color = "#cfe0ff",
  radiusTop = 1.7,
  radiusBottom = 0.28,
  height = 6,
  opacity = 0.55,
  anglePower = 6,
}) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: {
          uColor: { value: new Color(color) },
          uOpacity: { value: opacity },
          uAnglePower: { value: anglePower },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormalV;
          varying vec3 vViewPos;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vNormalV = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewPos = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uAnglePower;
          varying vec3 vNormalV;
          varying vec3 vViewPos;
          varying vec2 vUv;
          void main() {
            vec3 viewDir = normalize(-vViewPos);
            float edge = pow(abs(dot(viewDir, normalize(vNormalV))), uAnglePower);
            float lengthFade = pow(1.0 - vUv.y, 1.5);
            float alpha = edge * lengthFade * uOpacity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      }),
    []
  );
  material.uniforms.uColor.value.set(color);
  material.uniforms.uOpacity.value = opacity;
  material.uniforms.uAnglePower.value = anglePower;

  return (
    <mesh position={[0, height / 2, 0]} raycast={() => null}>
      <cylinderGeometry args={[radiusTop, radiusBottom, height, 64, 1, true]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// Golden crown that hovers above the party leader (host) in the lobby.
function Crown() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.8;
      ref.current.position.y = 2.5 + Math.sin(clock.getElapsedTime() * 2) * 0.08;
    }
  });
  return (
    <group ref={ref} name="CrownModel" scale={[0.22, 0.22, 0.22]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.55, 0.7, 0.35, 6]} />
        <meshStandardMaterial color="#ffd34d" emissive="#a8791a" emissiveIntensity={0.4} metalness={0.9} roughness={0.25} toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} castShadow position={[Math.cos(angle) * 0.6, 0.3, Math.sin(angle) * 0.6]}>
            <coneGeometry args={[0.12, 0.32, 4]} />
            <meshStandardMaterial color="#ffd34d" emissive="#a8791a" emissiveIntensity={0.4} metalness={0.9} roughness={0.25} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// Shared bob so the rider and its name label float in sync.
function bobOffset(clock, isMe) {
  const baseY = isMe ? 0.15 : 0;
  return baseY + Math.sin(clock.getElapsedTime() * 1.8 + (isMe ? 0 : 1)) * 0.12;
}

// Rider that gently bobs in the air while you customize it in the lobby.
function FloatingRider({ player, isMe, onEdit }) {
  const ref = useRef();
  const baseY = isMe ? 0.15 : 0;
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = bobOffset(clock, isMe);
    }
  });
  return (
    <group
      ref={ref}
      name="Rider"
      position={[0, baseY, 0]}
      scale={[0.6, 0.6, 0.6]}
    >
      <VehicleSwitcher player={player} onEdit={onEdit} />
    </group>
  );
}

function VehicleSwitcher({ player, onEdit }) {
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
