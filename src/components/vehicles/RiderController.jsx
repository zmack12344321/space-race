import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, useBeforePhysicsStep, useRapier } from "@react-three/rapier";
import { EcctrlCameraControls } from "ecctrl/camera";
import { useButtonStore, useJoystickStore } from "ecctrl/input";
import { EcctrlVehicle, ShapeCastWheel, ThrustPropeller } from "ecctrl/vehicle";
import { myPlayer, usePlayerState, send, setDamageHandler, getLatestTransform, getInterpolatedTransform, getInterpDelayMs, setTransform, getPeerDebug, setRenderLag } from "../../multiplayer/party";
import {
  fireBeam,
  BEAM_LENGTH,
  OVERHEAT_TIME,
  COOL_RATE,
  KNOCKBACK,
  KNOCKBACK_PREDICT_MAG,
} from "./laserStore";
import { useHealthStore } from "./healthStore";
import { useHeatStore } from "./heatStore";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Quaternion, Vector3 } from "three";
import { randInt } from "three/src/math/MathUtils";
import { Rider } from "./Rider";
import { getLunarSpawnPoint } from "../../utils/lunarHeightfield";
import {
  ECCTRL_CAR_CONFIG,
  ECCTRL_DRONE_CONFIG,
  ECCTRL_PROPELLER_PROPS,
  ECCTRL_VEHICLE_PRESETS,
} from "./ecctrlVehiclePresets";
import { ECCTRL_VEHICLE_TUNING_PRESETS, getEcctrlTuningPreset, useEcctrlTuningStore } from "./ecctrlTuningStore";
import { GameMenuOpenAtom } from "../ui/UI";
import { GameReadyAtom } from "../ui/debugState";
import { useSetAtom } from "jotai";
import { PlayerNameTag, gameTagProps } from "../environment/PlayerNameTag";
import { useGamepadRef, getGamepadState, TRIGGER_DEADZONE } from "../ui/gamepadStore";
import { setBoost } from "../ui/boostStore";
import { usePlayerSettings } from "../ui/playerSettingsStore";
import { useRaceCourseStore } from "../environment/raceCourseStore";
import {
  fireLaser,
  LASER_TTL,
  LASER_SPEED,
  LASER_DAMAGE,
  HOLD_THRESHOLD,
  HEAT_PER_SHOT,
} from "./laserStore";

const ARCADE_JUMP_IMPULSE = 360;
const WORLD_UP = new Vector3(0, 1, 0);
const BOOST_DRAIN = 0.16;
const BOOST_RECHARGE = 0.34;
const BOOST_LOCK_THRESHOLD = 0.18;
// Slightly higher tilt while boosting => a bit faster ramp, but not so high
// it flips the drone.
const BOOST_TILT = Math.PI / 3.4;

// Reused temps to avoid per-frame allocations (GC stutter).
const _qPrev = new Quaternion();
const _qTarget = new Quaternion();

function hashStringToSlot(id, mod = 64) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}
// Test-arena spawns: two players facing each other 10m apart (z = -5 vs +5).
const TEST_SPAWNS = [
  { x: 0, y: 0.6, z: -5, ry: 0 },
  { x: 0, y: 0.6, z: 5, ry: Math.PI },
];
function getTestSpawn(index = 0) {
  return TEST_SPAWNS[index % TEST_SPAWNS.length];
}
function joystickToVehicleInput(controls) {
  if (!controls.isJoystickPressed()) return { x: 0, y: 0 };
  const angle = controls.angle();
  return {
    x: Math.cos(angle),
    y: -Math.sin(angle),
  };
}

function mergedJoystickInput(partyControls, ecctrlJoystick) {
  if (ecctrlJoystick.active) return { x: ecctrlJoystick.x, y: ecctrlJoystick.y };
  return joystickToVehicleInput(partyControls);
}

function CarControllerBody({ car, paused }) {
  const frontBrake = car.frontMaxBrakeTorque ?? car.maxBrakeTorque;
  const rearBrake = car.rearMaxBrakeTorque ?? car.maxBrakeTorque;
  const rearDriveTorqueWeight = car.rearDriveTorqueWeight ?? 1;
  const wheelDebug = Boolean(car.debugWheel || car.debugMode);

  return (
    <>
      <CuboidCollider args={[car.bodyHalfWidth, car.bodyHalfHeight, car.bodyHalfLength]} position={[0, car.bodyPosY, 0]} density={car.bodyDensity} />
      <ShapeCastWheel
        enable={!paused}
        steerWheel
        brakeWheel
        position={[car.wheelOffsetX, car.wheelOffsetY, car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={frontBrake}
        tireGripFactor={car.tireGripFactor}
        debug={wheelDebug}
      />
      <ShapeCastWheel
        enable={!paused}
        steerWheel
        brakeWheel
        position={[-car.wheelOffsetX, car.wheelOffsetY, car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={frontBrake}
        tireGripFactor={car.tireGripFactor}
        debug={wheelDebug}
      />
      <ShapeCastWheel
        enable={!paused}
        driveWheel
        brakeWheel
        driveTorqueWeight={rearDriveTorqueWeight}
        position={[car.wheelOffsetX, car.wheelOffsetY, -car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={rearBrake}
        tireGripFactor={car.tireGripFactor}
        debug={wheelDebug}
      />
      <ShapeCastWheel
        enable={!paused}
        driveWheel
        brakeWheel
        driveTorqueWeight={rearDriveTorqueWeight}
        position={[-car.wheelOffsetX, car.wheelOffsetY, -car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={rearBrake}
        tireGripFactor={car.tireGripFactor}
        debug={wheelDebug}
      />
    </>
  );
}

function DroneControllerBody({ drone, paused, boostMultiplier = 1 }) {
  const propDebug = Boolean(drone.debugPropeller || drone.debugMode);
  return (
    <>
      <CuboidCollider args={[drone.bodyHalfWidth, drone.bodyHalfHeight, drone.bodyHalfLength]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[1, -0.15, 1]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[1, -0.15, -1]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[-1, -0.15, 1]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[-1, -0.15, -1]} density={drone.bodyDensity} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust * boostMultiplier} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={propDebug} invertTorque position={[drone.propellerOffsetX, drone.propellerOffsetY, drone.propellerOffsetZ]} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust * boostMultiplier} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={propDebug} position={[-drone.propellerOffsetX, drone.propellerOffsetY, drone.propellerOffsetZ]} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust * boostMultiplier} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={propDebug} position={[drone.propellerOffsetX, drone.propellerOffsetY, -drone.propellerOffsetZ]} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust * boostMultiplier} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={propDebug} invertTorque position={[-drone.propellerOffsetX, drone.propellerOffsetY, -drone.propellerOffsetZ]} />
    </>
  );
}

export const RiderController = ({ state, controls, getGroundHeight, debugMode = false, onFire, testSpawn = false }) => {
  const vehicle = useRef();
  const cameraControls = useRef();
  const cameraUp = useRef(new Vector3(0, 1, 0));
  const cameraCurrDir = useRef(new Vector3());
  const cameraFinalDir = useRef(new Vector3());
  const cameraTurnCrossAxis = useRef(new Vector3());
  const yawCrossAxis = useRef(new Vector3());
  const boostDir = useRef(new Vector3());
  const mouseLook = useRef({ x: 0, y: 0 });
  const pointerLocked = useRef(false);
  const fireHeld = useRef(false);
  const triggerHeld = useRef(false);
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;
  const mouseButtonsConfigured = useRef(false);
  const gl = useThree((s) => s.gl);
  const me = myPlayer();
  const isLocal = me?.id === state.id;
  const [vehicleModel] = usePlayerState(state, "vehicle");
  const preset = ECCTRL_VEHICLE_PRESETS[vehicleModel] || ECCTRL_VEHICLE_PRESETS.longboard;
  const isDrone = preset.type === "drone";
  const { rapier, world } = useRapier();
  const setGameReady = useSetAtom(GameReadyAtom);
  const tuning = useEcctrlTuningStore((s) => s);
  const setTuning = useEcctrlTuningStore((s) => s.setTuning);
  const rideTuning = isDrone ? tuning.drone : tuning.board;
  const [boostActive, setBoostActive] = useState(false);
  const boostEnergy = useRef(1);
  const boostLocked = useRef(false);
  const boostMultiplier = boostActive ? tuning.common.boostMultiplier ?? 1.45 : 1;
  const BOOST_SPEED_MULT = tuning.drone.boostSpeedMult ?? 1.4;
  const BOOST_VERT_MULT = tuning.drone.boostSpeedMult ?? 1.4;
  const menuOpen = useAtomValue(GameMenuOpenAtom);
  const gamepadRef = useGamepadRef();
  const keys = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
    jump: false,
    handbrake: false,
  });
  const isDroneRef = useRef(isDrone);
  isDroneRef.current = isDrone;
  const lastRespawnAt = useRef(0);
  const spawnPoint = useRef(null);
  const lastJumpAt = useRef(0);
  // Smoothed remote position we drive the kinematic body toward (used for
  // first-sample snap; steady-state smoothing comes from the snapshot buffer).
  const remoteLerp = useRef({ x: 0, y: 0, z: 0, init: false });
  const lastDebugAt = useRef(0);
  const jumpRequested = useRef(false);
  const ecctrlJoystick = useRef({ active: false, x: 0, y: 0 });
  const ecctrlButtons = useRef({ b1: false, b2: false, b3: false, b4: false });
  const beamSlot = useRef(null);
  const heat = useRef(0);
  const overheated = useRef(false);
  const lastBeamSyncAt = useRef(0);
  const pressTime = useRef(0);
  const firedDiscrete = useRef(false);
  const cachedBodyState = useRef({
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0, w: 1 },
    linvel: { x: 0, y: 0, z: 0 },
    angvel: { x: 0, y: 0, z: 0 },
  });
  useBeforePhysicsStep(() => {
    const body = vehicle.current?.body;
    if (!body) return;

    const pos = body.translation();
    const rot = body.rotation();
    const linvel = body.linvel();
    const angvel = body.angvel();

    cachedBodyState.current = {
      pos: { x: pos.x, y: pos.y, z: pos.z },
      rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
      angvel: { x: angvel.x, y: angvel.y, z: angvel.z },
    };
  });

  const carConfig = useMemo(() => {
    if (isDrone) return undefined;
    return {
      ...ECCTRL_CAR_CONFIG,
      engineHorsepower: rideTuning.engineHorsepower * (rideTuning.speedMultiplier ?? 1) * boostMultiplier,
      engineMaxRPM: rideTuning.engineMaxRPM,
      finalDriveRatio: rideTuning.finalDriveRatio,
      transmissionMode: "auto",
      shiftUpRPM: rideTuning.shiftUpRPM,
      shiftDownRPM: rideTuning.shiftDownRPM,
      shiftCooldown: rideTuning.shiftCooldown,
      steerRate: rideTuning.steerRate,
      maxSteerAngle: rideTuning.maxSteerAngle,
      reverseTorqueScale: rideTuning.reverseTorqueScale,
      reverseRPMScale: rideTuning.reverseRPMScale,
    };
  }, [
    boostMultiplier,
    isDrone,
    rideTuning.engineHorsepower,
    rideTuning.engineMaxRPM,
    rideTuning.finalDriveRatio,
    rideTuning.reverseRPMScale,
    rideTuning.reverseTorqueScale,
    rideTuning.shiftCooldown,
    rideTuning.shiftDownRPM,
    rideTuning.shiftUpRPM,
    rideTuning.speedMultiplier,
    rideTuning.steerRate,
    rideTuning.maxSteerAngle,
  ]);

  const droneConfig = useMemo(() => {
    if (!isDrone) return undefined;
    return {
      ...ECCTRL_DRONE_CONFIG,
      maxYawRate: tuning.drone.maxYawRate,
      maxHorizSpeed: tuning.drone.maxHorizSpeed * tuning.common.speedMultiplier * (boostActive ? BOOST_SPEED_MULT : 1),
      maxVertSpeed: tuning.drone.maxVertSpeed * tuning.common.speedMultiplier * (boostActive ? BOOST_VERT_MULT : 1),
      maxTiltAngle: boostActive ? BOOST_TILT : tuning.drone.maxTiltAngle,
      airDragFactor: tuning.drone.airDragFactor,
      TILT_P: tuning.drone.TILT_P,
      TILT_D: tuning.drone.TILT_D,
      YAW_P: tuning.drone.YAW_P,
      VERT_POS_P: tuning.drone.VERT_POS_P,
      VERT_POS_D: tuning.drone.VERT_POS_D,
      HORIZ_POS_P: tuning.drone.HORIZ_POS_P,
      HORIZ_POS_D: tuning.drone.HORIZ_POS_D,
      HORIZ_VEL_P: tuning.drone.HORIZ_VEL_P,
      VERT_VEL_P: tuning.drone.VERT_VEL_P,
    };
  }, [
    boostMultiplier,
    isDrone,
    tuning.common.speedMultiplier,
    tuning.drone.HORIZ_POS_D,
    tuning.drone.HORIZ_POS_P,
    tuning.drone.HORIZ_VEL_P,
    tuning.drone.TILT_D,
    tuning.drone.TILT_P,
    tuning.drone.VERT_POS_D,
    tuning.drone.VERT_POS_P,
    tuning.drone.VERT_VEL_P,
    tuning.drone.YAW_P,
    tuning.drone.airDragFactor,
    tuning.drone.maxHorizSpeed,
    tuning.drone.maxTiltAngle,
    tuning.drone.maxVertSpeed,
    tuning.drone.maxYawRate,
  ]);

  useEffect(() => {
    if (!isLocal) return;
    const presetName = ECCTRL_VEHICLE_TUNING_PRESETS[vehicleModel] || "car";
    setTuning(getEcctrlTuningPreset(presetName));
  }, [isLocal, vehicleModel, setTuning]);

  useEffect(() => {
    if (!menuOpen) return;
    keys.current.forward = false;
    keys.current.back = false;
    keys.current.left = false;
    keys.current.right = false;
    keys.current.up = false;
    keys.current.down = false;
    keys.current.boost = false;
    keys.current.handbrake = false;
    setBoostActive(false);
    jumpRequested.current = false;
    ecctrlJoystick.current = { active: false, x: 0, y: 0 };
    ecctrlButtons.current = { b1: false, b2: false, b3: false, b4: false };
  }, [menuOpen]);

  useEffect(() => {
    const unsubscribeJoystick = useJoystickStore.subscribe((state) => state.joysticks.left, (joystick) => {
      if (!joystick) return;
      ecctrlJoystick.current = joystick;
    });
    const unsubscribeButtons = useButtonStore.subscribe(({ buttons }) => {
      ecctrlButtons.current = {
        b1: Boolean(buttons.b1),
        b2: Boolean(buttons.b2),
        b3: Boolean(buttons.b3),
        b4: Boolean(buttons.b4),
      };
    });
    return () => {
      unsubscribeJoystick();
      unsubscribeButtons();
    };
  }, []);

  useEffect(() => {
    if (!isLocal) return;
    const canvas = gl.domElement;

    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return;
      mouseLook.current.x += e.movementX;
      mouseLook.current.y += e.movementY;
    };
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement !== canvas) return;
      if (overheated.current || fireHeld.current || triggerHeld.current) return;
      fireHeld.current = true;
      pressTime.current = performance.now() / 1000;
      firedDiscrete.current = false;
    };
    const onMouseUp = (e) => {
      if (e.button !== 0) return;
      const quickTap = !firedDiscrete.current && !overheated.current && performance.now() / 1000 - pressTime.current < HOLD_THRESHOLD;
      fireHeld.current = false;
      if (quickTap) fireDiscreteShotRef.current();
    };
    const onCanvasClick = () => {
      if (menuOpen || gamepadRef.current.connected) return;
      if (document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock();
        } catch {
          /* pointer lock request can reject if called too soon after exit */
        }
      }
    };
    const onLockChange = () => {
      pointerLocked.current = document.pointerLockElement === canvas;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onCanvasClick);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onCanvasClick);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [isLocal, gl, menuOpen, gamepadRef]);

  useEffect(() => {
    if (menuOpen && document.pointerLockElement) document.exitPointerLock();
  }, [menuOpen]);

  const pack = (v) => ({ x: v.x, y: v.y, z: v.z });

  // Muzzle + forward direction of the dog/UFO in world space.
  const getMuzzleDir = () => {
    const handle = vehicle.current;
    const body = handle?.body;
    if (!body) return null;
    const t = body.translation();
    const fwd = handle.bodyZAxis;
    const muzzle = new Vector3(t.x, t.y, t.z).addScaledVector(fwd, 1.2);
    muzzle.y += 0.3;
    const dir = new Vector3(fwd.x, fwd.y, fwd.z).normalize();
    return { muzzle, dir };
  };

  // Single discrete shot (a quick click). Builds heat like the beam so spamming overheats.
  const fireDiscreteShot = () => {
    if (overheated.current) return;
    const md = getMuzzleDir();
    if (!md) return;
    const s = fireLaser({ pos: md.muzzle, dir: md.dir, ownerId: me.id, damage: LASER_DAMAGE, speed: LASER_SPEED, ttl: LASER_TTL });
    if (s) {
      send({ type: "laser", ownerId: me.id, pos: pack(md.muzzle), dir: pack(md.dir), speed: LASER_SPEED, ttl: LASER_TTL, damage: LASER_DAMAGE });
      onFireRef.current?.(md.muzzle, md.dir);
    }
    heat.current = Math.min(OVERHEAT_TIME, heat.current + HEAT_PER_SHOT);
    if (heat.current >= OVERHEAT_TIME) overheated.current = true;
    useHeatStore.getState().set({ heat: heat.current / OVERHEAT_TIME, overheated: overheated.current });
    firedDiscrete.current = true;
  };
  const fireDiscreteShotRef = useRef(fireDiscreteShot);
  fireDiscreteShotRef.current = fireDiscreteShot;

  useEffect(() => {
    if (!isLocal) return;
    setDamageHandler((kind, data) => {
      const body = vehicle.current?.body;
      if (!body) return;
      if (kind === "respawn") {
        respawn();
        return;
      }
      if (kind === "knockback" && data) {
        const lv = body.linvel();
        const k = new Vector3(data.x, data.y, data.z).normalize().multiplyScalar(KNOCKBACK);
        body.setLinvel(
          { x: lv.x + k.x, y: lv.y + KNOCKBACK * 0.4 + k.y, z: lv.z + k.z },
          true
        );
        body.setAngvel({ x: (Math.random() - 0.5) * 3, y: 0, z: (Math.random() - 0.5) * 3 }, true);
      }
    });
    return () => setDamageHandler(null);
  }, [isLocal]);

  useEffect(() => {
    if (!isLocal) return;

    const isTypingTarget = (target) =>
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable;

    const setKey = (event, pressed) => {
      if (isTypingTarget(event.target)) return;
      const code = event.code;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyC", "ShiftLeft", "ShiftRight", "KeyE"].includes(code)) {
        event.preventDefault();
      }
      if (code === "KeyW") keys.current.forward = pressed;
      if (code === "KeyS") keys.current.back = pressed;
      if (code === "KeyA") keys.current.left = pressed;
      if (code === "KeyD") keys.current.right = pressed;
      if (code === "Space") {
        keys.current.up = pressed;
        if (!isDroneRef.current) jumpRequested.current = true;
      }
      if (code === "KeyC") keys.current.down = pressed;
      if (code === "ShiftLeft" || code === "ShiftRight") keys.current.boost = pressed;
      if (code === "KeyE") keys.current.handbrake = pressed;
    };

    const onKeyDown = (event) => setKey(event, true);
    const onKeyUp = (event) => setKey(event, false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isLocal]);

  const respawn = () => {
    const body = vehicle.current?.body;
    if (!isLocal || !body) return;
    const slot = me.getState("slot");
    const slotIndex = typeof slot === "number" && Number.isFinite(slot) ? slot : hashStringToSlot(me.id);
    let point;
    let faceY = 0;
    if (testSpawn) {
      const ts = getTestSpawn(slotIndex);
      point = { x: ts.x, y: ts.y, z: ts.z };
      faceY = ts.ry;
    } else {
      point = getGroundHeight
        ? getLunarSpawnPoint({
          respawnIndex: slotIndex,
          groundHeight: getGroundHeight,
        })
        : {
          x: randInt(-10, 10) * 5,
          y: 2,
          z: randInt(-10, 10) * 5,
        };
    }

    spawnPoint.current = point;
    me.setState("spawnPoint", point);
    if (!testSpawn) {
      me.setState("raceStartAt", point);
      useRaceCourseStore.getState().resetRace();
    }

    body.setTranslation({ x: point.x, y: point.y, z: point.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setRotation({ x: 0, y: Math.sin(faceY / 2), z: 0, w: Math.cos(faceY / 2) }, true);

    // Clear any stale velocity snapshot so the next frame doesn't report
    // leftover momentum (which the camera align + network sync would echo).
    cachedBodyState.current.linvel = { x: 0, y: 0, z: 0 };
    cachedBodyState.current.angvel = { x: 0, y: 0, z: 0 };

    // Snap the camera directly behind the spawn facing forward (+Z) so the
    // character doesn't appear to face left while the camera slowly catches up.
    if (cameraControls.current) {
      const dist = cameraControls.current.minDistance + 7;
      cameraControls.current.setLookAt(point.x, point.y + tuning.common.cameraHeight, point.z - dist, point.x, point.y + tuning.common.cameraHeight, point.z, false);
    }

    // Reset cannon heat + drop any active beam on respawn.
    heat.current = 0;
    overheated.current = false;
    if (beamSlot.current) {
      beamSlot.current.active = false;
      beamSlot.current.isBeam = false;
      beamSlot.current = null;
    }
    useHeatStore.getState().set({ heat: 0, overheated: false });
  };

  const [isSpawned, setIsSpawned] = useState(true);

  useEffect(() => {
    if (!isLocal) return;
    respawn();
    setGameReady(true);
  }, [isLocal, setGameReady]);

  useFrame(({ camera }, delta) => {
    const handle = vehicle.current;
    if (!handle?.body) return;

    const stunned = isLocal && useHealthStore.getState().isStunned(performance.now() / 1000);
    if (menuOpen || stunned) {
      handle.setMovement({
        forward: false,
        backward: false,
        steerLeft: false,
        steerRight: false,
        brake: true,
        joystickL: { x: 0, y: 0 },
      });
      mouseLook.current.x = 0;
      mouseLook.current.y = 0;
      return;
    }

    const pad = getGamepadState();
    const nowS = performance.now() / 1000;
    // Controller trigger (analog RT axis or digital button). Treat it exactly
    // like the mouse hold: a quick pull = discrete shot, holding = sustained
    // beam. The rising edge starts a press; the falling edge ends it.
    const padDown = isLocal && (pad.axes.rt > TRIGGER_DEADZONE || pad.buttons.rt);
    if (padDown && !triggerHeld.current) {
      if (!fireHeld.current && !overheated.current) {
        triggerHeld.current = true;
        pressTime.current = nowS;
        firedDiscrete.current = false;
      }
    } else if (!padDown && triggerHeld.current) {
      const quickTap = !firedDiscrete.current && !overheated.current && nowS - pressTime.current < HOLD_THRESHOLD;
      triggerHeld.current = false;
      if (quickTap) fireDiscreteShotRef.current();
    }

    const heldFire = isLocal && (fireHeld.current || triggerHeld.current) && nowS - pressTime.current >= HOLD_THRESHOLD;
    const beamActive = heldFire && !overheated.current;

    // --- Sustained beam + overheat ---
    const md = getMuzzleDir();
    if (md) {
      if (beamActive) {
        heat.current = Math.min(OVERHEAT_TIME, heat.current + delta);
        if (heat.current >= OVERHEAT_TIME) overheated.current = true;
      } else {
        heat.current = Math.max(0, heat.current - delta * COOL_RATE);
        if (overheated.current && heat.current <= 0) overheated.current = false;
      }

      if (beamActive) {
        if (!beamSlot.current) {
          beamSlot.current = fireBeam({ pos: md.muzzle, dir: md.dir, ownerId: me.id, beamLength: BEAM_LENGTH });
          send({ type: "beam", ownerId: me.id, pos: pack(md.muzzle), dir: pack(md.dir), beamLength: BEAM_LENGTH, active: true });
          onFireRef.current?.(md.muzzle, md.dir);
        } else {
          beamSlot.current.pos.copy(md.muzzle);
          beamSlot.current.prev.copy(md.muzzle);
          beamSlot.current.dir.copy(md.dir);
          beamSlot.current.ttl = 0.2;
          const nowS = performance.now() / 1000;
          if (nowS - lastBeamSyncAt.current >= 0.08) {
            lastBeamSyncAt.current = nowS;
            send({ type: "beam", ownerId: me.id, pos: pack(md.muzzle), dir: pack(md.dir), beamLength: BEAM_LENGTH, active: true });
          }
        }
      } else if (beamSlot.current) {
        beamSlot.current.active = false;
        beamSlot.current.isBeam = false;
        beamSlot.current = null;
        send({ type: "beam", ownerId: me.id, pos: pack(md.muzzle), dir: pack(md.dir), beamLength: BEAM_LENGTH, active: false });
      }
    }

    useHeatStore.getState().set({ heat: heat.current / OVERHEAT_TIME, overheated: overheated.current });
    const joystickL = mergedJoystickInput(controls, ecctrlJoystick.current);
    const gamepadForward = pad.axes.rt > 0.12;
    const gamepadBack = pad.axes.lt > 0.12;
    const settings = usePlayerSettings.getState();
    const gamepadSteer = pad.axes.lx;
    const boostHeld = keys.current.boost || ecctrlButtons.current.b4 || pad.axes.lt > 0.12;
    const linvel = cachedBodyState.current.linvel;
    const bodyForwardSpeed = linvel.x * handle.bodyZAxis.x + linvel.y * handle.bodyZAxis.y + linvel.z * handle.bodyZAxis.z;
    const backPressed = keys.current.back || ecctrlButtons.current.b1 || gamepadBack || joystickL.y < -0.2;
    const backIsBrake = backPressed && bodyForwardSpeed > 1.2;

    if (isLocal && isSpawned) {
      if (boostLocked.current && boostEnergy.current > BOOST_LOCK_THRESHOLD) boostLocked.current = false;
      const canBoost = boostHeld && !boostLocked.current && boostEnergy.current > 0.001;
      if (canBoost) {
        boostEnergy.current = Math.max(0, boostEnergy.current - BOOST_DRAIN * delta);
        if (boostEnergy.current <= 0.001) boostLocked.current = true;
      } else {
        boostEnergy.current = Math.min(1, boostEnergy.current + BOOST_RECHARGE * delta);
      }
      if (canBoost !== boostActive) setBoostActive(canBoost);
      setBoost(boostEnergy.current, canBoost, boostLocked.current);

      // Boost is driven entirely through ecctrl's own smoothed inputs (same
      // path Space uses), so it feels natural instead of jerky. While boosting
      // we inject an analog pitch/roll demand and lift the speed caps. No raw
      // velocity injection — ecctrl's PD controller eases it like normal input.

      if (cameraControls.current) {
        cameraControls.current.moveTo(handle.currPos.x, handle.currPos.y + tuning.common.cameraHeight, handle.currPos.z, true);
        cameraUp.current.copy(isDrone ? WORLD_UP : handle.upAxis);
        camera.up.lerp(cameraUp.current, 0.1);
        cameraControls.current.setUp(camera.up);

        const turn = tuning.common.cameraTurnSpeed * 0.4 * delta * (settings.lookSensitivity ?? 1);
        if (Math.abs(pad.axes.rx) > 0.08) {
          cameraControls.current.rotate((settings.invertLookX ? -pad.axes.rx : pad.axes.rx) * turn, 0, true);
        }
        if (Math.abs(pad.axes.ry) > 0.08) {
          cameraControls.current.rotate(0, (settings.invertLookY ? pad.axes.ry : -pad.axes.ry) * turn, true);
        }

        // D-pad up/down zooms the camera in/out. We drive it exactly like the
        // scroll wheel does: a one-shot dollyTo() from the LIVE camera distance,
        // computed only while the button is held. We never re-assert it every
        // frame (that would fight/clobber the wheel's own dolly). camera-controls
        // persist the radius natively, so distance survives moveTo()/setUp().
        // dollyTo(d): larger d = farther away. UP = zoom IN (closer).
        // D-pad zoom — same dolly() the scroll wheel uses.
        if (typeof window !== "undefined" && window.__z) { console.log("[Z] up", pad.dpadUp, "down", pad.dpadDown, "keys", Object.keys(pad).filter((k) => k.startsWith("dpad")).join(","), "dist", cameraControls.current.distance); }
        if (pad.dpadUp) cameraControls.current.dolly(15 * delta, true);
        if (pad.dpadDown) cameraControls.current.dolly(-15 * delta, true);

        if (!mouseButtonsConfigured.current && cameraControls.current) {
          cameraControls.current.mouseButtons.left = -1;
          mouseButtonsConfigured.current = true;
        }

        if (mouseLook.current.x !== 0 || mouseLook.current.y !== 0) {
          const sens = settings.lookSensitivity ?? 1;
          const k = 0.0025;
          const mx = (settings.invertLookX ? -mouseLook.current.x : mouseLook.current.x) * k * sens;
          const my = (settings.invertLookY ? mouseLook.current.y : -mouseLook.current.y) * k * sens;
          cameraControls.current.rotate(mx, my, true);
          mouseLook.current.x = 0;
          mouseLook.current.y = 0;
        }

        const forwardInput = !isDrone && (keys.current.forward || ecctrlButtons.current.b3 || gamepadForward || joystickL.y > 0.2);

        if (cameraControls.current.currentAction === 0 && forwardInput && bodyForwardSpeed > 0.15) {
          camera.getWorldDirection(cameraCurrDir.current).projectOnPlane(cameraUp.current).normalize();
          cameraFinalDir.current.copy(handle.bodyZAxis).projectOnPlane(cameraUp.current).normalize();
          cameraTurnCrossAxis.current.crossVectors(cameraCurrDir.current, cameraFinalDir.current);
          let dot = Math.max(-1, Math.min(1, cameraCurrDir.current.dot(cameraFinalDir.current)));
          if (Math.abs(dot) < 1e-10) dot = 0;
          const angle = Math.atan2(cameraTurnCrossAxis.current.dot(cameraUp.current), dot);
          cameraControls.current.rotate(angle * tuning.common.cameraTurnSpeed * 0.28 * delta, 0, true);
        }

      }

      if (isDrone) {
        const stickFwd = -pad.axes.ly;
        const stickStrafe = pad.axes.lx;
        const mobile = ecctrlJoystick.current.active ? joystickL : { x: 0, y: 0 };

        const pitchForward = keys.current.forward || stickFwd > 0.2 || mobile.y > 0.2;
        const pitchBackward = keys.current.back || stickFwd < -0.2 || mobile.y < -0.2;
        const throttleUp = keys.current.up || pad.buttons.a;
        const rollLeft = keys.current.left || stickStrafe < -0.2 || mobile.x < -0.2;
        const rollRight = keys.current.right || stickStrafe > 0.2 || mobile.x > 0.2;
        const throttleDown = keys.current.down || pad.buttons.b;

        // Boost is just a smoothed analog pitch/roll demand fed through ecctrl's
        // own drone controller (same path Space uses). It follows your current
        // tilt, scales with BOOST_SPEED_MULT, and never forces a direction on its
        // own. Throttle is left to the player's own Up key so boost won't launch
        // you straight up when holding W.
        let boostRx = 0;
        let boostRy = 0;
        if (canBoost) {
          if (pitchForward) boostRy += 1;
          if (pitchBackward) boostRy -= 1;
          if (rollRight) boostRx += 1;
          if (rollLeft) boostRx -= 1;
          if (boostRx === 0 && boostRy === 0) boostRy = 1;
          boostRx *= BOOST_SPEED_MULT;
          boostRy *= BOOST_SPEED_MULT;
        }

        let autoYaw = 0;
        if (cameraControls.current) {
          camera.getWorldDirection(cameraCurrDir.current).projectOnPlane(WORLD_UP).normalize();
          cameraFinalDir.current.copy(handle.bodyZAxis).projectOnPlane(WORLD_UP).normalize();
          const cross = yawCrossAxis.current.crossVectors(cameraFinalDir.current, cameraCurrDir.current).dot(WORLD_UP);
          const dot = Math.max(-1, Math.min(1, cameraFinalDir.current.dot(cameraCurrDir.current)));
          const yawError = Math.atan2(cross, dot);
          autoYaw = Math.max(-1, Math.min(1, yawError * 1.5));
        }

        handle.setMovement({
          throttleUp,
          throttleDown,
          yawLeft: false,
          yawRight: false,
          pitchForward,
          pitchBackward,
          rollLeft,
          rollRight,
          joystickL: { x: -autoYaw, y: 0 },
          joystickR: { x: mobile.x + boostRx, y: mobile.y + boostRy },
        });
      } else {
        handle.setMovement({
          forward: keys.current.forward || ecctrlButtons.current.b3 || gamepadForward || (joystickL.y > 0.2),
          backward: backIsBrake ? false : backPressed,
          steerLeft: keys.current.left || (gamepadSteer < -0.2) || (joystickL.x < -0.2),
          steerRight: keys.current.right || (gamepadSteer > 0.2) || (joystickL.x > 0.2),
          joystickL,
          brake: keys.current.handbrake || ecctrlButtons.current.b4 || pad.buttons.b || backIsBrake,
        });
      }

      if (!isDroneRef.current && (jumpRequested.current || ecctrlButtons.current.b2 || pad.justPressed.a) && handle.isOnGround) {
        const now = performance.now();
        if (now - lastJumpAt.current > 650) {
          const lv = cachedBodyState.current.linvel;
          const jumpVel = tuning.common.jumpVelocity * tuning.common.speedMultiplier;
          handle.body.setLinvel({ x: lv.x, y: Math.max(lv.y, jumpVel), z: lv.z }, true);
          lastJumpAt.current = now;
        }
        jumpRequested.current = false;
      } else if (jumpRequested.current) {
        jumpRequested.current = false;
      }

      if (pad.justPressed.x) respawn();

      const respawnAt = state.getState("_respawnAt") || 0;
      if (respawnAt > lastRespawnAt.current) {
        lastRespawnAt.current = respawnAt;
        respawn();
      }
      // Publish transform as ONE phase-aligned message (pos/rot/vel together)
      // so the receiver's interpolation buffer never gets out-of-phase partial
      // snapshots. setTransform also updates local state.
      setTransform(state, {
        pos: cachedBodyState.current.pos,
        rot: cachedBodyState.current.rot,
        vel: cachedBodyState.current.linvel,
      });
      if (getGroundHeight) {
        const pos = cachedBodyState.current.pos;
        if (pos.y < getGroundHeight(pos.x, pos.z) - 120) respawn();
      }

      if (debugMode) {
        const now = performance.now();
        if (now - lastDebugAt.current > 120) {
          lastDebugAt.current = now;
          const lv = cachedBodyState.current.linvel;
          const av = cachedBodyState.current.angvel;
          const pos = cachedBodyState.current.pos;
          const wheels = Object.values(handle.wheelsInfo || {});
          const wheelSummary = wheels.map((wheel) => ({
            id: wheel.id,
            slip: Number(wheel.slipStrength ?? 0),
            lngSlip: Number(wheel.lngSlipRatio ?? 0),
            latSlip: Number(wheel.latSlipRatio ?? 0),
            angVel: Number(wheel.wheelAngVel ?? 0),
            driveTorque: Number(wheel.driveTorque ?? 0),
            brakeTorque: Number(wheel.brakeTorque ?? 0),
            steerAngle: Number(wheel.steerAngle ?? 0),
            onPlatform: Boolean(wheel.isOnPlatform),
            hit: Boolean(wheel.rayHitBody),
          }));
          state.setState("_debug", {
            vehicleModel,
            presetName: preset.type,
            speed: Math.hypot(lv.x, lv.z),
            verticalSpeed: lv.y,
            boosting: canBoost,
            engineRPM: handle.engineRPM,
            gearIndex: handle.gearIndex,
            driveRatio: handle.driveRatio,
            isOnGround: Boolean(handle.isOnGround),
            wheelsOnGround: wheels.filter((wheel) => Boolean(wheel.rayHitBody)).length,
            position: pos,
            linvel: lv,
            angvel: av,
            lastJumpAt: lastJumpAt.current,
            lastRespawnAt: lastRespawnAt.current,
            wheelSummary,
            // D-pad zoom diagnostic — tells us if input reaches the zoom code
            // and whether dolly() actually changes the camera distance.
            dpadUp: Boolean(pad.dpadUp),
            dpadDown: Boolean(pad.dpadDown),
            camDist: cameraControls.current ? Number(cameraControls.current.distance?.toFixed?.(2)) : null,
            camMin: cameraControls.current ? cameraControls.current.minDistance : null,
            camMax: cameraControls.current ? cameraControls.current.maxDistance : null,
          });
        }
      }
    } else if (!isLocal) {
      // Remote players: snapshot interpolation. We render the avatar at
      // (now - getInterpDelayMs()) by sampling a buffer of received transforms
      // and interpolating between the two snapshots that bracket that time.
      // Deliberately drawing slightly in the past guarantees we always have a
      // "future" sample to interpolate toward, so motion is smooth under
      // variable/lossy latency (the standard Valve/Gambetta approach) instead
      // of lagging toward the single latest packet.
      const renderTime = performance.now() - getInterpDelayMs();
      const snap = getInterpolatedTransform(state.id, renderTime);
      if (snap && snap.pos && Number.isFinite(snap.pos.x)) {
        const lerpPos = remoteLerp.current;
        // On the very first sample (or after a gap), snap directly to avoid a
        // long slide from origin. The buffer handles steady-state smoothing.
        if (!lerpPos.init) {
          lerpPos.x = snap.pos.x; lerpPos.y = snap.pos.y; lerpPos.z = snap.pos.z;
          lerpPos.init = true;
        }
        // Debug: how far the rendered pose trails the newest known sample,
        // plus the configured interpolation delay. Pure measurement.
        const latest = getLatestTransform(state.id);
        if (latest && isLocal) {
          const dx = latest.pos.x - snap.pos.x;
          const dy = latest.pos.y - snap.pos.y;
          const dz = latest.pos.z - snap.pos.z;
          const gap = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const peer = getPeerDebug(state.id);
          const lag = getInterpDelayMs() + (peer ? peer.ageMs : 0) * 0 + gap; // ms delay + residual snap gap
          setRenderLag(lag);
        }
        // Rapier traps (wasm "unreachable") on non-finite transforms. Guard.
        if (Number.isFinite(snap.pos.x) && Number.isFinite(snap.pos.y) && Number.isFinite(snap.pos.z)) {
          handle.body.setNextKinematicTranslation({ x: snap.pos.x, y: snap.pos.y, z: snap.pos.z });
          if (snap.rot && Number.isFinite(snap.rot.x) && Number.isFinite(snap.rot.w)) {
            handle.body.setNextKinematicRotation({ x: snap.rot.x, y: snap.rot.y, z: snap.rot.z, w: snap.rot.w });
          }
        } else {
          console.warn("[RiderController] dropped non-finite remote transform for", state.id);
        }
      } else {
        remoteLerp.current.init = false;
      }
    }

    if (controls.isPressed("Respawn")) respawn();
  });

  // Always-on transform broadcast for the LOCAL player. This intentionally
  // runs regardless of stun/menu state: when the rider is knocked back, their
  // physics body keeps moving, but the main control useFrame early-returns
  // while stunned and stops calling setTransform — so remote clients freeze the
  // avatar at the pre-hit spot until the stun ends (the "frozen ~1s then snaps"
  // bug). Publishing every frame from the always-fresh cachedBodyState fixes it.
  const lastSendAt = useRef(0);
  // Mirror of POSITION_UPDATE_MS in party.js — how often we broadcast transform.
  const LOCAL_SEND_MS = 15;
  useFrame(() => {
    if (!isLocal) return;
    const now = performance.now();
    if (now - lastSendAt.current < LOCAL_SEND_MS) return;
    lastSendAt.current = now;
    const b = cachedBodyState.current;
    if (!b?.pos) return;
    setTransform(state, { pos: b.pos, rot: b.rot, vel: b.linvel });
  });

  return (
    <group>
      <EcctrlVehicle
        ref={vehicle}
        canSleep
        carConfig={carConfig}
        droneConfig={droneConfig}
        enableCustomGravity
        enable={isLocal}
        type={isLocal ? undefined : "kinematicPosition"}
      >
        {isDrone ? <DroneControllerBody drone={tuning.drone} paused={!isLocal || !isSpawned || menuOpen} boostMultiplier={boostMultiplier} /> : <CarControllerBody car={tuning.board} paused={!isLocal || !isSpawned || menuOpen} />}
        <PlayerNameTag
          {...gameTagProps}
          name={state.state.name || state.state.profile.name}
          isMe={isLocal}
        />
        <group position={[0, -0.25, 0]}>
          <Rider model={vehicleModel} scale={0.6} preview={false} />
        </group>
      </EcctrlVehicle>
      {isLocal && (
        <EcctrlCameraControls
          ref={cameraControls}
          makeDefault
          minDistance={5}
          maxDistance={35}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI - 0.1}
          smoothTime={tuning.common.cameraSmoothTime}
        />
      )}
    </group>
  );

}
