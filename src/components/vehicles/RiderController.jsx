import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, useBeforePhysicsStep, useRapier } from "@react-three/rapier";
import { EcctrlCameraControls } from "ecctrl/camera";
import { useButtonStore, useJoystickStore } from "ecctrl/input";
import { EcctrlVehicle, ShapeCastWheel, ThrustPropeller } from "ecctrl/vehicle";
import { myPlayer, usePlayerState } from "../../multiplayer/party";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
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
import { PlayerNameTag } from "../environment/PlayerNameTag";
import { useGamepadRef } from "../ui/gamepadStore";
import { usePlayerSettings } from "../ui/playerSettingsStore";

const ARCADE_JUMP_IMPULSE = 360;
const WORLD_UP = new Vector3(0, 1, 0);
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

export const RiderController = ({ state, controls, getGroundHeight, debugMode = false, onFire }) => {
  const vehicle = useRef();
  const cameraControls = useRef();
  const cameraUp = useRef(new Vector3(0, 1, 0));
  const cameraCurrDir = useRef(new Vector3());
  const cameraFinalDir = useRef(new Vector3());
  const cameraTurnCrossAxis = useRef(new Vector3());
  const yawCrossAxis = useRef(new Vector3());
  const mouseLook = useRef({ x: 0, y: 0 });
  const pointerLocked = useRef(false);
  const fireHeld = useRef(false);
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
  const boostMultiplier = boostActive ? tuning.common.boostMultiplier ?? 1 : 1;
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
  const respawnIndex = useRef(0);
  const spawnPoint = useRef(null);
  const lastJumpAt = useRef(0);
  const lastDebugAt = useRef(0);
  const jumpRequested = useRef(false);
  const ecctrlJoystick = useRef({ active: false, x: 0, y: 0 });
  const ecctrlButtons = useRef({ b1: false, b2: false, b3: false, b4: false });
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
      maxHorizSpeed: tuning.drone.maxHorizSpeed * tuning.common.speedMultiplier * boostMultiplier,
      maxVertSpeed: tuning.drone.maxVertSpeed * tuning.common.speedMultiplier * boostMultiplier,
      maxTiltAngle: tuning.drone.maxTiltAngle,
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
      fireHeld.current = true;
      onFireRef.current?.();
    };
    const onMouseUp = (e) => {
      if (e.button === 0) fireHeld.current = false;
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
    const point = getGroundHeight
      ? getLunarSpawnPoint({
          lastSpawn: spawnPoint.current,
          respawnIndex: respawnIndex.current,
          groundHeight: getGroundHeight,
        })
      : {
          x: randInt(-10, 10) * 5,
          y: 2,
          z: randInt(-10, 10) * 5,
        };

    respawnIndex.current += 1;
    spawnPoint.current = point;

    body.setTranslation({ x: point.x, y: point.y, z: point.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
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

    if (menuOpen) {
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

    const pad = gamepadRef.current;
    const joystickL = mergedJoystickInput(controls, ecctrlJoystick.current);
    const gamepadForward = pad.axes.rt > 0.12;
    const gamepadBack = pad.axes.lt > 0.12;
    const settings = usePlayerSettings.getState();
    const gamepadSteer = settings.invertSteering ? -pad.axes.lx : pad.axes.lx;
    const boostHeld = keys.current.boost || ecctrlButtons.current.b4 || pad.buttons.y;
    if (boostHeld !== boostActive) setBoostActive(boostHeld);
    const linvel = cachedBodyState.current.linvel;
    const bodyForwardSpeed = linvel.x * handle.bodyZAxis.x + linvel.y * handle.bodyZAxis.y + linvel.z * handle.bodyZAxis.z;
    const backPressed = keys.current.back || ecctrlButtons.current.b1 || gamepadBack || joystickL.y < -0.2;
    const backIsBrake = backPressed && bodyForwardSpeed > 1.2;

      if (isLocal && isSpawned) {
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
        const stickStrafe = settings.invertSteering ? -pad.axes.lx : pad.axes.lx;
        const mobile = ecctrlJoystick.current.active ? joystickL : { x: 0, y: 0 };

        const pitchForward = keys.current.forward || stickFwd > 0.2 || mobile.y > 0.2;
        const pitchBackward = keys.current.back || stickFwd < -0.2 || mobile.y < -0.2;
        const rollLeft = keys.current.left || stickStrafe < -0.2 || mobile.x < -0.2;
        const rollRight = keys.current.right || stickStrafe > 0.2 || mobile.x > 0.2;
        const throttleUp = keys.current.up || pad.buttons.a;
        const throttleDown = keys.current.down || pad.buttons.b;

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
          joystickR: mobile,
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
      state.setState("pos", cachedBodyState.current.pos);
      state.setState("rot", cachedBodyState.current.rot);
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
            boosting: boostHeld,
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
          });
        }
      }
    } else {
      const pos = state.getState("pos");
      if (pos) {
        const current = cachedBodyState.current.pos;
        handle.body.setTranslation({
          x: current.x + (pos.x - current.x) * 0.35,
          y: current.y + (pos.y - current.y) * 0.35,
          z: current.z + (pos.z - current.z) * 0.35,
        }, true);
        const rot = state.getState("rot");
        if (rot) handle.body.setRotation(rot, true);
        handle.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        handle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }

    if (controls.isPressed("Respawn")) respawn();
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
      >
        {isDrone ? <DroneControllerBody drone={tuning.drone} paused={!isLocal || !isSpawned || menuOpen} boostMultiplier={boostMultiplier} /> : <CarControllerBody car={tuning.board} paused={!isLocal || !isSpawned || menuOpen} />}
        <PlayerNameTag
          name={state.state.name || state.state.profile.name}
          isMe={isLocal}
          hideSelf
          position={[0, 2.45, 0]}
          fontSize={0.26}
        />
        <group position={[0, -0.25, 0]}>
          <Rider model={vehicleModel} scale={0.6} preview={false} />
        </group>
      </EcctrlVehicle>
      {isLocal && (
        <EcctrlCameraControls
          ref={cameraControls}
          makeDefault
          minDistance={2}
          maxDistance={35}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI - 0.1}
          smoothTime={tuning.common.cameraSmoothTime}
        />
      )}
    </group>
  );
};
