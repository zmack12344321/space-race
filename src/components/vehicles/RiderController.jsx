import { useFrame } from "@react-three/fiber";
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

const ARCADE_JUMP_IMPULSE = 360;
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

export const RiderController = ({ state, controls, getGroundHeight, debugMode = false }) => {
  const vehicle = useRef();
  const cameraControls = useRef();
  const cameraUp = useRef(new Vector3(0, 1, 0));
  const cameraCurrDir = useRef(new Vector3());
  const cameraFinalDir = useRef(new Vector3());
  const cameraTurnCrossAxis = useRef(new Vector3());
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
    boost: false,
    jump: false,
    handbrake: false,
  });
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

    const isTypingTarget = (target) =>
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable;

      const setKey = (event, pressed) => {
        if (isTypingTarget(event.target)) return;
        const code = event.code;
        if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight", "KeyE"].includes(code)) {
          event.preventDefault();
        }
        if (code === "KeyW" || code === "ArrowUp") keys.current.forward = pressed;
        if (code === "KeyS" || code === "ArrowDown") keys.current.back = pressed;
        if (code === "KeyA" || code === "ArrowLeft") keys.current.left = pressed;
        if (code === "KeyD" || code === "ArrowRight") keys.current.right = pressed;
        if (code === "ShiftLeft" || code === "ShiftRight") keys.current.boost = pressed;
        if (code === "Space" && pressed) jumpRequested.current = true;
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
      return;
    }

    const pad = gamepadRef.current;
    const joystickL = mergedJoystickInput(controls, ecctrlJoystick.current);
    const gamepadForward = pad.axes.rt > 0.12;
    const gamepadBack = pad.axes.lt > 0.12;
    const gamepadSteer = pad.axes.lx;
    const boostHeld = keys.current.boost || ecctrlButtons.current.b4 || pad.buttons.y;
    if (boostHeld !== boostActive) setBoostActive(boostHeld);
    const linvel = cachedBodyState.current.linvel;
    const bodyForwardSpeed = linvel.x * handle.bodyZAxis.x + linvel.y * handle.bodyZAxis.y + linvel.z * handle.bodyZAxis.z;
    const backPressed = keys.current.back || ecctrlButtons.current.b1 || gamepadBack || joystickL.y < -0.2;
    const backIsBrake = backPressed && bodyForwardSpeed > 1.2;

      if (isLocal && isSpawned) {
        if (cameraControls.current) {
          cameraControls.current.moveTo(handle.currPos.x, handle.currPos.y + tuning.common.cameraHeight, handle.currPos.z, true);
          cameraUp.current.copy(handle.upAxis);
          camera.up.lerp(cameraUp.current, 0.1);
          cameraControls.current.setUp(camera.up);

          if (Math.abs(pad.axes.rx) > 0.08) {
            cameraControls.current.rotate(pad.axes.rx * tuning.common.cameraTurnSpeed * 0.4 * delta, 0, true);
          }
          if (Math.abs(pad.axes.ry) > 0.08) {
            cameraControls.current.rotate(0, -pad.axes.ry * tuning.common.cameraTurnSpeed * 0.4 * delta, true);
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
        handle.setMovement({
          throttleUp: keys.current.forward || ecctrlButtons.current.b3 || gamepadForward,
          throttleDown: backIsBrake ? false : backPressed,
          yawLeft: keys.current.left,
          yawRight: keys.current.right,
          pitchForward: keys.current.forward || ecctrlButtons.current.b3 || gamepadForward,
          pitchBackward: backIsBrake ? false : backPressed,
          rollLeft: keys.current.left || gamepadSteer < -0.2,
          rollRight: keys.current.right || gamepadSteer > 0.2,
          joystickL,
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

      if ((jumpRequested.current || ecctrlButtons.current.b2 || pad.justPressed.a) && handle.isOnGround) {
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
