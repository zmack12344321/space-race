import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getLatestTransform, myPlayer } from "../../multiplayer/party";
import { getLunarHeight, getLunarSpawnPoint } from "../../utils/lunarHeightfield";
import { useRaceCourseStore } from "./raceCourseStore";

const RING_RADIUS = 5;
const RING_TUBE = 0.5;
const RING_SPACING = 20;
const GATE_CLEARANCE = 13;
const RINGS_AHEAD = 4;
const COURSE_POINTS = 12;
const PASS_RADIUS = RING_RADIUS + 2.5;
const COLOR_AHEAD = "#5eead4";
const COLOR_PASSED = "#34d399";

function makePathGenerator(seed) {
  let h = (seed >>> 0) || 1;
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967295;
  };
  return { rand };
}

function generateCourse(seed) {
  const rand = makePathGenerator((seed * 2654435761 + 99) >>> 0);
  const anchor = getLunarSpawnPoint({ seed });
  const course = [];
  let x = anchor.x;
  let z = anchor.z;
  const y = anchor.y + 10;

  for (let i = 0; i < COURSE_POINTS; i++) {
    if (i > 0) {
      x = anchor.x;
      z = anchor.z + i * RING_SPACING;
    }
    course.push({ x, z, h: 0, y, passed: false });
  }

  return course;
}

export function RaceCourse({ seed = 1337, enabled = true }) {
  const camera = useThree((state) => state.camera);
  const camPos = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3(0, 0, 1));
  const course = useRef([]);
  const gateRefs = useRef([]);
  const setMarkers = useRaceCourseStore((state) => state.setMarkers);
  const ringGeo = useMemo(() => new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 14, 40), []);

  const placeY = (x, z, y) => Math.max(y, getLunarHeight(x, z, seed) + GATE_CLEARANCE);

  const readAnchor = () => {
    const me = myPlayer();
    const latest = me ? getLatestTransform(me.id) : null;
    if (latest?.pos) {
      camPos.current.set(latest.pos.x, latest.pos.y, latest.pos.z);
      const yaw = latest.rot
        ? Math.atan2(
            2 * (latest.rot.w * latest.rot.y + latest.rot.x * latest.rot.z),
            1 - 2 * (latest.rot.y * latest.rot.y + latest.rot.x * latest.rot.x)
          )
        : 0;
      forward.current.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      return;
    }

    camera.getWorldPosition(camPos.current);
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 0.0001) forward.current.set(0, 0, 1);
    forward.current.normalize();
  };

  useEffect(() => {
    course.current = generateCourse(seed);
    setMarkers(course.current.slice(0, 12).map((gate, index) => ({
      x: gate.x,
      z: gate.z,
      passed: gate.passed,
      active: index < RINGS_AHEAD,
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useFrame(() => {
    if (!course.current.length) return;

    if (!enabled) {
      for (const mesh of gateRefs.current) {
        if (mesh) mesh.visible = false;
      }
      return;
    }

    readAnchor();
    const cam = camPos.current;

    let nearest = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < course.current.length; i++) {
      const gate = course.current[i];
      const dx = gate.x - cam.x;
      const dz = gate.z - cam.z;
      const d = dx * dx + dz * dz;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }

      if (!gate.passed) {
        const along = dx * Math.sin(gate.h) + dz * Math.cos(gate.h);
        const lateral = Math.abs(-dx * Math.cos(gate.h) + dz * Math.sin(gate.h));
        if (along < 0 && Math.abs(along) < RING_SPACING * 0.25 && lateral < PASS_RADIUS) {
          gate.passed = true;
        }
      }
    }

    const start = Math.max(0, nearest);
    for (let i = 0; i < gateRefs.current.length; i++) {
      const mesh = gateRefs.current[i];
      const gate = course.current[start + i];
      if (!mesh) continue;
      if (!gate) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      mesh.position.set(gate.x, placeY(gate.x, gate.z, gate.y), gate.z);
      mesh.rotation.set(Math.PI / 2, gate.h, 0);

      const mat = mesh.material;
      if (mat) {
        const base = gate.passed ? COLOR_PASSED : COLOR_AHEAD;
        mat.color.set(base);
        mat.opacity = gate.passed ? 0.95 : 0.6;
        if (mat.emissive) {
          mat.emissive.set(base);
          mat.emissiveIntensity = gate.passed ? 2.0 : 1.4;
        }
      }
    }

  });

  return (
    <group name="RaceCourse">
      {Array.from({ length: RINGS_AHEAD }).map((_, slot) => (
        <mesh key={`gate-${slot}`} ref={(el) => (gateRefs.current[slot] = el)} geometry={ringGeo} visible={false}>
          <meshBasicMaterial
            color={COLOR_AHEAD}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
