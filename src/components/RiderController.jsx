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

export const RiderController = ({ state, controls }) => {
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

  useEffect(() => {
    if (!isLocal) return;
    const onWheel = (e) => {
      zoom.current = clamp(zoom.current + e.deltaY * 0.001, 0.5, 3);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [isLocal]);

  const lookAt = useRef(new Vector3(0, 0, 0));
  useFrame(({ camera }, delta) => {
    if (!rb.current) {
      return;
    }
    if (isLocal) {
      if (cameraRef.current) {
        cameraRef.current.position.set(0, 1.5 * zoom.current, -3 * zoom.current);
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
    rb.current.setAngvel(rotVel, true);
    if (isLocal) {
      state.setState("pos", rb.current.translation());
      state.setState("rot", rb.current.rotation());
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
      rb.current.setTranslation({
        x: randInt(-2, 2) * 4,
        y: 2,
        z: randInt(-2, 2) * 4,
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
        <CuboidCollider args={[0.4, 0.6, 0.75]} position={[0, 0.6, 0]} />
        <Html position-y={0.85}>
          <h1 className="text-center whitespace-nowrap text-white drop-shadow-md  backdrop-filter bg-slate-300 bg-opacity-30 backdrop-blur-lg rounded-md py-2 px-4 text-xl  transform -translate-x-1/2">
            {state.state.name || state.state.profile.name}
          </h1>
        </Html>
        <Rider model={vehicleModel} scale={0.6} preview={false} />
        {me?.id === state.id && (
          <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.5, -3]} near={1} />
        )}
      </RigidBody>
    </group>
  );
};
