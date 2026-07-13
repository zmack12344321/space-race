import {
  Billboard,
  Environment,
  Image,
  Stars,
  Text,
  useTexture,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  FogExp2,
  MathUtils,
  ShaderMaterial,
} from "three";
import { audios, playAudio } from "../utils/AudioManager";
import { createMoonGroundTextures } from "../utils/moonGround";
import { DistantMountains } from "./DistantMountains";
import { Rider } from "./Rider";
import { NameEditingAtom } from "./UI";

const CAR_SPACING = 2.5;
const SWITCH_DURATION = 600;
const GROUND_SIZE = 160; // detailed play-area plane (centred on the riders)
const GROUND_REPEAT = 60; // base tile size for the colour map
const NORMAL_REPEAT = 240; // tiny tiles → visible pebbles / regolith
const DISP_REPEAT = 24; // large tiles → craters / rolling terrain
const FAR_SIZE = 2000; // huge dusty plain reaching the horizon
const DISPLACEMENT = 1.3; // surface stays within y=0..-DISPLACEMENT
const FOG_DENSITY = 0.003; // spooky depth haze (tuned so ranges stay readable)

// Mock data so Triplex can render this scene standalone (no live PlayroomKit
// room). The production Lobby passes the REAL players/me via props, so any
// transform you drag here is written into this file and ships in the build —
// exactly like Rider.jsx. This is NOT a sandbox: Lobby renders <Lunar1/>.
const MOCK_PLAYERS = [
  {
    id: "me",
    state: { name: "You", vehicle: "sedanSports" },
    getState: (key) => ({ name: "You", vehicle: "sedanSports" })[key],
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
 * @typedef {Object} Lunar1Props
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

/**
 * @param {Lunar1Props} props
 */
export function Lunar1(props) {
  const {
    players = MOCK_PLAYERS,
    me = MOCK_PLAYERS[0],
    showUi = true,
    groundRepeat = GROUND_REPEAT,
    normalRepeat = NORMAL_REPEAT,
    dispRepeat = DISP_REPEAT,
    normalScale = 2.5,
    displacementScale = DISPLACEMENT,
    roughness = 1,
  } = props;
  const [, setNameEditing] = useAtom(NameEditingAtom);
  const scene = useThree((s) => s.scene);

  // Spooky depth haze so the distant mountains melt into the night horizon.
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = new FogExp2(0x0a0e1a, FOG_DENSITY);
    return () => {
      scene.fog = prev;
    };
  }, [scene]);

  // Blended lunar-surface ground (moon_01 + moon_02) built once the textures load.
  const [diffA, diffB, norA, norB] = useTexture([
    "/moon_01_diff_1k.jpg",
    "/moon_02_diff_1k.jpg",
    "/moon_01_nor_gl_1k.jpg",
    "/moon_02_nor_gl_1k.jpg",
  ]);
  const ground = useMemo(
    () =>
      createMoonGroundTextures(diffA, diffB, norA, norB, {
        repeat: groundRepeat,
        normalRepeat,
        dispRepeat,
      }),
    [diffA, diffB, norA, norB, groundRepeat, normalRepeat, dispRepeat]
  );

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

  const shadowMapSize = 2048;

  return (
    <group>
      {/* Night-sky HDRI — shown as the background at a low intensity so it
          stays a deep, un-washed horizon. IBL is kept very low so the scene
          remains a spooky lunar night rather than a bright studio. These
          props require three >= 0.163 (now installed) to take effect. */}
      <Environment
        files="/NightSkyHDRI002_2K_HDR.exr"
        environmentIntensity={0}
      />

      {/* Dim, cool "moonlight" key light — the only shadow caster. */}
      <directionalLight
        name="Moonlight"
        position={[6, 10, 4]}
        intensity={1.2}
        color="#aebfff"
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30} visible={true}
      />
      {/* Cool ambient fill so the scene reads on its own (the neon accent
          point lights were removed). Kept moderate so it stays a moody lunar
          night — Triplex adds its own editor lights, so always sanity-check
          brightness in the running app, not just the editor. */}
      <ambientLight name="Fill" intensity={0.5} color="#7f8bad" />


      {/* Lunar ground — blended moon_01/moon_02 albedo (recolored to lunar
          grey) + high-freq pebble normal + low-freq crater displacement. The
          displacement is biased so the surface never rises above y=0, so the
          podium/rider never get buried. Drag the group to reposition. */}
      <group name="Ground" position={[0, 0, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
        {/* Detailed play-area plane (fine segments so craters show) */}
        <mesh name="MoonSurface" rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0.02, 0, 0]}>
          <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 400, 400]} />
          <meshStandardMaterial
            map={ground.map}
            normalMap={ground.normalMap}
            normalScale={[normalScale, normalScale]}
            displacementMap={ground.displacementMap}
            displacementScale={displacementScale}
            displacementBias={-displacementScale}
            roughness={roughness}
            metalness={0}
            envMapIntensity={0}
          />
        </mesh>
        {/* Vast plain reaching the horizon (no displacement, sits just below) */}
        <mesh name="FarSurface" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
          <planeGeometry args={[FAR_SIZE, FAR_SIZE, 1, 1]} />
          <meshStandardMaterial
            map={ground.map}
            normalMap={ground.normalMap}
            normalScale={[1, 1]}
            roughness={1}
            metalness={0}
            envMapIntensity={0}
          />
        </mesh>
      </group>

      {/* Distant mountain horizon — layered ridge silhouettes in a ring, hazed
          into the far distance so they read like 100 miles out. */}
      <DistantMountains />

      {/* Crisp, GPU-rendered starfield layered over the dimmed HDRI. Shader
          points stay razor-sharp at any resolution (no pixelation like the
          2K equirect), giving the space lobby a high-quality deep-space sky. */}
      <Stars
        radius={900}
        depth={400}
        count={9000}
        factor={4}
        saturation={0}
        fade
        speed={0.4}
      />

      {players.map((player, idx) => (
        <group
          key={player.id}
          name={`Player_${player.id}`}
          position={[
            idx * CAR_SPACING - ((players.length - 1) * CAR_SPACING) / 2,
            0,
            0,
          ]}
          scale={[1, 1, 1]}
        >
          {showUi && (
            <Billboard
              ref={(el) => (billboardRefs.current[idx] = el)}
              position={[0.29, 3.07, 0]}
            >
              <Text fontSize={0.34} anchorX={"right"}>
                {player.state.name || player.state.profile.name}
                <meshBasicMaterial color="white" />
              </Text>
              <Text
                fontSize={0.34}
                anchorX={"right"}
                position={[0.02, -0.02, -0.01]}
              >
                {player.state.name || player.state.profile.name}
                <meshBasicMaterial color="black" transparent opacity={0.8} />
              </Text>
              {player.id === me?.id && (
                <>
                  <Image
                    onClick={() => setNameEditing(true)}
                    position={[0.2, 0, 0]}
                    scale={0.3}
                    url="images/edit.png"
                    transparent
                  />
                  <Image
                    position={[0.22, -0.02, -0.01]}
                    scale={0.3}
                    url="images/edit.png"
                    transparent
                    color="black"
                  />
                </>
              )}
            </Billboard>
          )}

          {/* Rider — floats with a soft bob while customizing in the lobby */}
          <FloatingRider
            player={player}
            isMe={player.id === me?.id}
            onEdit={() => setNameEditing(true)}
          />

          {player.id === me?.id && (
            <group name="Platform">
              {/* Uplight from below + glowing floor ring that lights the dog
                  from underneath. */}
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
  const container = useRef();
  const [vehicleModel, setCurrentVehicleModel] = useState(player.getState("vehicle"));
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
  const newVehicle = player.getState("vehicle");
  if (newVehicle !== vehicleModel) {
    playAudio(audios.ride_start);
    changedVehicleAt.current = Date.now();
    setTimeout(() => {
      setCurrentVehicleModel(newVehicle);
    }, SWITCH_DURATION / 2);
  }
  return (
    <>
      <Rider model={vehicleModel} preview={false} showVehicle={false} />
      <group ref={container}>
        <Rider model={vehicleModel} preview={false} showDog={false} />
      </group>
    </>
  );
}
