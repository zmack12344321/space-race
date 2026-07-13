import { Html, PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider, euler, quat, vec3 } from "@react-three/rapier";
import { useControls } from "leva";
import { myPlayer, usePlayerState } from "../multiplayer/party";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { clamp, randInt } from "three/src/math/MathUtils";
import { Rider } from "./Rider";
import { VEHICLE_SPEEDS } from "./vehicleConfig";

export const RiderController = ({ state, controls, getGroundHeight }) => {
  const rb = useRef();
  const me = myPlayer();
  const { rotationSpeed, rideSpeed } = useControls({
    rideSpeed: {
      value: 3,
      min: 0,
      max: 10,
      step: 0.1,
    },
    rotationSpeed: {
      value: 3,
      min: 0,
      max: 10,
      step: 0.01,
    },
  });

  const cameraRef = useRef();
  const zoom = useRef(1);
  const isLocal = me?.id === state.id;
  const keys = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    boost: false,
  });
  const cameraOrbit = useRef({ yaw: 0, pitch: 0.36, dragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    if (!isLocal) return;
    const onWheel = (e) => {
      zoom.current = clamp(zoom.current + e.deltaY * 0.001, 0.5, 3);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [isLocal]);

  useEffect(() => {
    if (!isLocal) return;

    const orbit = cameraOrbit.current;
    const onPointerDown = (event) => {
      if (event.button !== 0 || event.target?.closest?.("button,input,textarea")) return;
      orbit.dragging = true;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
    };
    const onPointerMove = (event) => {
      if (!orbit.dragging) return;
      const dx = event.clientX - orbit.lastX;
      const dy = event.clientY - orbit.lastY;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      orbit.yaw -= dx * 0.006;
      orbit.pitch = clamp(orbit.pitch + dy * 0.004, -0.2, 0.9);
    };
    const onPointerUp = () => {
      orbit.dragging = false;
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isLocal]);

  useEffect(() => {
    if (!isLocal) return;

    const isTypingTarget = (target) =>
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable;

    const setKey = (event, pressed) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") keys.current.forward = pressed;
      if (key === "s" || key === "arrowdown") keys.current.back = pressed;
      if (key === "a" || key === "arrowleft") keys.current.left = pressed;
      if (key === "d" || key === "arrowright") keys.current.right = pressed;
      if (key === "shift") keys.current.boost = pressed;
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

  const lookAt = useRef(new Vector3(0, 0, 0));
  useFrame(({ camera }, delta) => {
    if (!rb.current) {
      return;
    }
    const driveInput =
      (keys.current.forward ? 1 : 0) - (keys.current.back ? 1 : 0);
    const turnInput =
      (keys.current.left ? 1 : 0) - (keys.current.right ? 1 : 0);
    const boostInput = keys.current.boost && driveInput > 0;
    const speedBoost = boostInput ? 1.75 : 1;

    if (isLocal) {
      const orbit = cameraOrbit.current;
      const driving = driveInput || controls.isJoystickPressed();
      if (driving && !orbit.dragging) {
        orbit.yaw += (0 - orbit.yaw) * 0.08;
        orbit.pitch += (0.36 - orbit.pitch) * 0.08;
      }

      if (cameraRef.current) {
        const distance = 3 * zoom.current;
        const y = Math.sin(orbit.pitch) * distance + 0.55;
        const flat = Math.cos(orbit.pitch) * distance;
        const offset = new Vector3(
          Math.sin(orbit.yaw) * flat,
          y,
          -Math.cos(orbit.yaw) * flat
        );
        cameraRef.current.position.copy(offset);
        cameraRef.current.fov += ((boostInput ? 58 : 45) - cameraRef.current.fov) * 0.12;
        cameraRef.current.updateProjectionMatrix();
      }

      const targetLookAt = vec3(rb.current.translation());
      lookAt.current.lerp(targetLookAt, 0.1);
      camera.lookAt(lookAt.current);
    }
    const rotVel = rb.current.angvel();

    if (isLocal && controls.isJoystickPressed()) {
      const angle = controls.angle();
      const dir = angle > Math.PI / 2 ? 1 : -1;
      rotVel.y = -dir * Math.sin(angle) * rotationSpeed;
      const impulse = vec3({
        x: 0,
        y: 0,
        z: (VEHICLE_SPEEDS[vehicleModel] || rideSpeed) * delta * dir,
      });
      const eulerRot = euler().setFromQuaternion(quat(rb.current.rotation()));
      impulse.applyEuler(eulerRot);
      rb.current.applyImpulse(impulse, true);
    }
    if (isLocal && (driveInput || turnInput)) {
      const dir = driveInput || 1;
      rotVel.y = turnInput * dir * rotationSpeed;
      if (driveInput) {
        const impulse = vec3({
          x: 0,
          y: 0,
          z:
            (VEHICLE_SPEEDS[vehicleModel] || rideSpeed) *
            speedBoost *
            delta *
            driveInput,
        });
        const eulerRot = euler().setFromQuaternion(quat(rb.current.rotation()));
        impulse.applyEuler(eulerRot);
        rb.current.applyImpulse(impulse, true);
      }
    }
    rb.current.setAngvel(rotVel, true);
    if (isLocal) {
      state.setState("pos", rb.current.translation());
      state.setState("rot", rb.current.rotation());
      if (getGroundHeight) {
        const pos = rb.current.translation();
        if (pos.y < getGroundHeight(pos.x, pos.z) - 18) respawn();
      }
    } else {
      const pos = state.getState("pos");
      if (pos) {
        const current = rb.current.translation();
        rb.current.setTranslation({
          x: current.x + (pos.x - current.x) * 0.35,
          y: current.y + (pos.y - current.y) * 0.35,
          z: current.z + (pos.z - current.z) * 0.35,
        });
        const rot = state.getState("rot");
        if (rot) rb.current.setRotation(rot);
      }
    }
    if (controls.isPressed("Respawn")) {
      respawn();
    }
  });
  const respawn = () => {
    if (isLocal) {
      const x = randInt(-2, 2) * 4;
      const z = randInt(-2, 2) * 4;
      rb.current.setTranslation({
        x,
        y: getGroundHeight ? getGroundHeight(x, z) + 2 : 2,
        z,
      });
      rb.current.setLinvel({ x: 0, y: 0, z: 0 });
      rb.current.setRotation({ x: 0, y: 0, z: 0, w: 1 });
      rb.current.setAngvel({ x: 0, y: 0, z: 0 });
    }
  };
  const [vehicleModel] = usePlayerState(state, "vehicle");
  useEffect(() => {
    respawn();
  }, []);
  return (
    <group>
      <RigidBody
        ref={rb}
        colliders={false}
        position={vec3(state.getState("pos"))}
        rotation={euler().setFromQuaternion(quat(state.getState("rot")))}
        onIntersectionEnter={(e) => {
          if (e.other.rigidBodyObject.name === "void") {
            respawn();
          }
        }}
      >
        <CuboidCollider args={[0.42, 0.35, 0.85]} position={[0, 0.35, 0]} />
        <Html position-y={0.85}>
          <h1 className="text-center whitespace-nowrap text-white drop-shadow-md  backdrop-filter bg-slate-300 bg-opacity-30 backdrop-blur-lg rounded-md py-2 px-4 text-xl  transform -translate-x-1/2">
            {state.state.name || state.state.profile.name}
          </h1>
        </Html>
        <Rider model={vehicleModel} scale={0.6} preview={false} />
        {me?.id === state.id && (
          <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.5, -3]} fov={45} near={1} />
        )}
      </RigidBody>
    </group>
  );
};
