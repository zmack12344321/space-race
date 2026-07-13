import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, euler, quat, vec3 } from "@react-three/rapier";
import { EcctrlCameraControls } from "ecctrl/camera";
import { useButtonStore, useJoystickStore } from "ecctrl/input";
import { EcctrlVehicle, ShapeCastWheel, ThrustPropeller } from "ecctrl/vehicle";
import { myPlayer, usePlayerState } from "../multiplayer/party";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { randInt } from "three/src/math/MathUtils";
import { Rider } from "./Rider";
import {
  ECCTRL_CAR_CONFIG,
  ECCTRL_DRONE_CONFIG,
  ECCTRL_PROPELLER_PROPS,
  ECCTRL_VEHICLE_PRESETS,
} from "./ecctrlVehiclePresets";
import { useEcctrlTuningStore } from "./ecctrlTuningStore";

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
  return (
    <>
      <CuboidCollider args={[car.bodyHalfWidth, car.bodyHalfHeight, car.bodyHalfLength]} position={[0, car.bodyPosY, 0]} density={car.bodyDensity} />
      <ShapeCastWheel
        enable={!paused}
        steerWheel
        brakeWheel
        driveWheel
        position={[car.wheelOffsetX, car.wheelOffsetY, car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={car.maxBrakeTorque}
        tireGripFactor={car.tireGripFactor}
        debug={car.debugWheel}
      />
      <ShapeCastWheel
        enable={!paused}
        steerWheel
        brakeWheel
        driveWheel
        position={[-car.wheelOffsetX, car.wheelOffsetY, car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={car.maxBrakeTorque}
        tireGripFactor={car.tireGripFactor}
        debug={car.debugWheel}
      />
      <ShapeCastWheel
        enable={!paused}
        driveWheel
        brakeWheel
        position={[car.wheelOffsetX, car.wheelOffsetY, -car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={car.maxBrakeTorque}
        tireGripFactor={car.tireGripFactor}
        debug={car.debugWheel}
      />
      <ShapeCastWheel
        enable={!paused}
        driveWheel
        brakeWheel
        position={[-car.wheelOffsetX, car.wheelOffsetY, -car.wheelOffsetZ]}
        groundDetection="shapeCast"
        rayShapeR={car.rayShapeR}
        rayShapeH={car.rayShapeH}
        rayLength={car.rayLength}
        springK={car.springK}
        dampingC={car.dampingC}
        maxBrakeTorque={car.maxBrakeTorque}
        tireGripFactor={car.tireGripFactor}
        debug={car.debugWheel}
      />
    </>
  );
}

function DroneControllerBody({ drone, paused }) {
  return (
    <>
      <CuboidCollider args={[drone.bodyHalfWidth, drone.bodyHalfHeight, drone.bodyHalfLength]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[1, -0.15, 1]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[1, -0.15, -1]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[-1, -0.15, 1]} density={drone.bodyDensity} />
      <CylinderCollider args={[0.05, 0.65]} position={[-1, -0.15, -1]} density={drone.bodyDensity} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={drone.debugPropeller} invertTorque position={[drone.propellerOffsetX, drone.propellerOffsetY, drone.propellerOffsetZ]} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={drone.debugPropeller} position={[-drone.propellerOffsetX, drone.propellerOffsetY, drone.propellerOffsetZ]} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={drone.debugPropeller} position={[drone.propellerOffsetX, drone.propellerOffsetY, -drone.propellerOffsetZ]} />
      <ThrustPropeller {...ECCTRL_PROPELLER_PROPS} enable={!paused} maxThrust={drone.maxThrust} torqueRatio={drone.torqueRatio} showPropellerModel={drone.showPropellerModel} debug={drone.debugPropeller} invertTorque position={[-drone.propellerOffsetX, drone.propellerOffsetY, -drone.propellerOffsetZ]} />
    </>
  );
}

export const RiderController = ({ state, controls, getGroundHeight }) => {
  const vehicle = useRef();
  const cameraControls = useRef();
  const cameraUp = useRef(new Vector3(0, 1, 0));
  const cameraCurrDir = useRef(new Vector3());
  const cameraFinalDir = useRef(new Vector3());
  const cameraTurnCrossAxis = useRef(new Vector3());
  const me = myPlayer();
  const isLocal = me?.id === state.id;
  const [vehicleModel] = usePlayerState(state, "vehicle");
  const preset = ECCTRL_VEHICLE_PRESETS[vehicleModel] || ECCTRL_VEHICLE_PRESETS.sedanSports;
  const isDrone = preset.type === "drone";
  const isBoard = !isDrone && vehicleModel !== "goKart";
  const tuning = useEcctrlTuningStore((s) => s);
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
  const lastJumpAt = useRef(0);
  const jumpRequested = useRef(false);
  const ecctrlJoystick = useRef({ active: false, x: 0, y: 0 });
  const ecctrlButtons = useRef({ b1: false, b2: false, b3: false, b4: false });

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
    const x = randInt(-2, 2) * 4;
    const z = randInt(-2, 2) * 4;
    body.setTranslation({ x, y: getGroundHeight ? getGroundHeight(x, z) + 8 : 2, z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  };

  useEffect(() => {
    respawn();
  }, []);

  useFrame(({ camera }, delta) => {
    const handle = vehicle.current;
    if (!handle?.body) return;

    if (isLocal) {
      if (cameraControls.current) {
        cameraControls.current.moveTo(handle.currPos.x, handle.currPos.y + tuning.common.cameraHeight, handle.currPos.z, true);
        cameraUp.current.copy(handle.upAxis);
        camera.up.lerp(cameraUp.current, 0.1);
        cameraControls.current.setUp(camera.up);

        if (cameraControls.current.currentAction === 0) {
          camera.getWorldDirection(cameraCurrDir.current).projectOnPlane(cameraUp.current).normalize();
          cameraFinalDir.current.copy(handle.bodyZAxis).projectOnPlane(cameraUp.current).normalize();
          cameraTurnCrossAxis.current.crossVectors(cameraCurrDir.current, cameraFinalDir.current);
          let dot = Math.max(-1, Math.min(1, cameraCurrDir.current.dot(cameraFinalDir.current)));
          if (Math.abs(dot) < 1e-10) dot = 0;
          const angle = Math.atan2(cameraTurnCrossAxis.current.dot(cameraUp.current), dot);
          cameraControls.current.rotate(angle * tuning.common.cameraTurnSpeed * delta, 0, true);
        }
      }

      const joystickL = mergedJoystickInput(controls, ecctrlJoystick.current);
      if (isDrone) {
        handle.setMovement({
          throttleUp: keys.current.forward || ecctrlButtons.current.b3,
          throttleDown: keys.current.back || ecctrlButtons.current.b1,
          yawLeft: keys.current.left,
          yawRight: keys.current.right,
          pitchForward: keys.current.forward || ecctrlButtons.current.b3,
          pitchBackward: keys.current.back || ecctrlButtons.current.b1,
          rollLeft: keys.current.left,
          rollRight: keys.current.right,
          joystickL,
        });
      } else {
        handle.setMovement({
          forward: keys.current.forward || ecctrlButtons.current.b3 || (joystickL.y > 0.2),
          backward: keys.current.back || ecctrlButtons.current.b1 || (joystickL.y < -0.2),
          steerLeft: keys.current.left || (joystickL.x < -0.2),
          steerRight: keys.current.right || (joystickL.x > 0.2),
          joystickL,
          brake: keys.current.handbrake || ecctrlButtons.current.b4,
        });
        if (isBoard) {
          handle.body.setAngularDamping(7.5);
          handle.body.setLinearDamping(1.15);
        } else {
          handle.body.setAngularDamping(1.2);
          handle.body.setLinearDamping(0.2);
        }
      }

      if ((jumpRequested.current || ecctrlButtons.current.b2) && handle.isOnGround) {
        const now = performance.now();
        if (now - lastJumpAt.current > 650) {
          const lv = handle.body.linvel();
          const jumpVel = tuning.common.jumpVelocity * tuning.common.speedMultiplier;
          handle.body.setLinvel({ x: lv.x, y: Math.max(lv.y, jumpVel), z: lv.z }, true);
          lastJumpAt.current = now;
        }
        jumpRequested.current = false;
      } else if (jumpRequested.current) {
        jumpRequested.current = false;
      }

      const respawnAt = state.getState("_respawnAt") || 0;
      if (respawnAt > lastRespawnAt.current) {
        lastRespawnAt.current = respawnAt;
        respawn();
      }
      state.setState("pos", handle.body.translation());
      state.setState("rot", handle.body.rotation());
      if (getGroundHeight) {
        const pos = handle.body.translation();
        if (pos.y < getGroundHeight(pos.x, pos.z) - 120) respawn();
      }
    } else {
      const pos = state.getState("pos");
      if (pos) {
        const current = handle.body.translation();
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
        position={vec3(state.getState("pos"))}
        rotation={euler().setFromQuaternion(quat(state.getState("rot")))}
        carConfig={isDrone ? undefined : {
          ...ECCTRL_CAR_CONFIG,
          engineHorsepower: (isBoard ? tuning.board.engineHorsepower * tuning.board.speedMultiplier : tuning.car.engineHorsepower * tuning.common.speedMultiplier),
          engineMaxRPM: isBoard ? tuning.board.engineMaxRPM : tuning.car.engineMaxRPM,
          finalDriveRatio: isBoard ? tuning.board.finalDriveRatio : tuning.car.finalDriveRatio,
          transmissionMode: "auto",
          shiftUpRPM: isBoard ? tuning.board.shiftUpRPM : tuning.car.shiftUpRPM,
          shiftDownRPM: isBoard ? tuning.board.shiftDownRPM : tuning.car.shiftDownRPM,
          shiftCooldown: isBoard ? tuning.board.shiftCooldown : tuning.car.shiftCooldown,
          steerRate: isBoard ? tuning.board.steerRate : tuning.car.steerRate,
          maxSteerAngle: isBoard ? tuning.board.maxSteerAngle : tuning.car.maxSteerAngle,
          reverseTorqueScale: isBoard ? tuning.board.reverseTorqueScale : tuning.car.reverseTorqueScale,
          reverseRPMScale: isBoard ? tuning.board.reverseRPMScale : tuning.car.reverseRPMScale,
        }}
        droneConfig={isDrone ? {
          ...ECCTRL_DRONE_CONFIG,
          maxYawRate: tuning.drone.maxYawRate,
          maxHorizSpeed: tuning.drone.maxHorizSpeed * tuning.common.speedMultiplier,
          maxVertSpeed: tuning.drone.maxVertSpeed * tuning.common.speedMultiplier,
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
        } : undefined}
        enableCustomGravity
        enable={isLocal}
      >
        {isDrone ? <DroneControllerBody drone={tuning.drone} paused={!isLocal} /> : <CarControllerBody car={isBoard ? tuning.board : tuning.car} paused={!isLocal} />}
        <Html position-y={1.25}>
          <h1 className="text-center whitespace-nowrap text-white drop-shadow-md backdrop-filter bg-slate-300 bg-opacity-30 backdrop-blur-lg rounded-md py-2 px-4 text-xl transform -translate-x-1/2">
            {state.state.name || state.state.profile.name}
          </h1>
        </Html>
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
