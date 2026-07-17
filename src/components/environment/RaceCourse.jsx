import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getLatestTransform, myPlayer, useMultiplayerState, usePlayerState } from "../../multiplayer/party";
import { getLunarHeight, getLunarSpawnPoint, scoreSpawnPoint } from "../../utils/lunarHeightfield";
import { useRaceCourseStore } from "./raceCourseStore";

const RING_RADIUS = 5;
const RING_TUBE = 0.5;
const DEFAULT_SEGMENT_LENGTH = 32;
const VISIBLE_RINGS = 4;
const GENERATED_AHEAD = 64;
const PASS_RADIUS = RING_RADIUS + 2.5;
const DEFAULT_GATE_CLEARANCE = 14;
const GATE_HEIGHT_TOLERANCE = 6;
const DEFAULT_TURN_STRENGTH = 0.58;

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

function sampleGateHeight(x, z, seed) {
  const sampleRadius = RING_RADIUS + RING_TUBE + 1.5;
  let highest = getLunarHeight(x, z, seed);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    const sx = x + Math.cos(a) * sampleRadius;
    const sz = z + Math.sin(a) * sampleRadius;
    highest = Math.max(highest, getLunarHeight(sx, sz, seed));
  }
  return highest;
}

function pickNextPoint({ prev, heading, seed, rand, liftState, segmentLength, turnStrength, gateClearance }) {
  const candidates = [-1, -0.6, -0.3, 0, 0.3, 0.6, 1].map((n) => n * turnStrength);
  let best = null;

  for (const turn of candidates) {
    const nextHeading = heading + turn;
    const x = prev.x + Math.sin(nextHeading) * segmentLength;
    const z = prev.z + Math.cos(nextHeading) * segmentLength;
    const terrainScore = scoreSpawnPoint(x, z, getLunarHeight, prev, seed);
    const turnScore = Math.abs(turn) * 6;
    const liftScore = liftState.current * 0.05;
    const score = terrainScore + turnScore + liftScore;

    if (!best || score < best.score) {
      best = { x, z, h: nextHeading, score };
    }
  }

  liftState.velocity += (rand.rand() - 0.5) * 0.35;
  liftState.velocity = THREE.MathUtils.clamp(liftState.velocity, -0.25, 0.25);
  if (rand.rand() < 0.16) liftState.velocity -= 0.3;
  liftState.current = THREE.MathUtils.clamp(liftState.current + liftState.velocity, 0, 8);

  return {
    x: best.x,
    z: best.z,
    h: best.h,
    y: sampleGateHeight(best.x, best.z, seed) + gateClearance + liftState.current,
    passed: false,
  };
}

function generateCourse(seed, rand, anchor, segmentLength, gateClearance, turnStrength) {
  const heading = anchor.heading ?? 0;
  const baseY = sampleGateHeight(anchor.x, anchor.z, seed) + gateClearance;
  const firstX = anchor.x + Math.sin(heading) * segmentLength;
  const firstZ = anchor.z + Math.cos(heading) * segmentLength;

  const course = [
    {
      x: firstX,
      z: firstZ,
      h: heading,
      y: baseY,
      passed: false,
      fade: 1,
      counted: false,
    },
  ];

  const liftState = { current: 0, velocity: 0 };
  while (course.length < GENERATED_AHEAD) {
    const next = pickNextPoint({ prev: course[course.length - 1], heading: course[course.length - 1].h, seed, rand, liftState, segmentLength, turnStrength, gateClearance });
    course.push({ ...next, fade: 1, counted: false });
  }

  for (let i = 0; i < course.length; i++) {
    const current = course[i];
    const next = course[Math.min(i + 1, course.length - 1)];
    const dx = next.x - current.x;
    const dz = next.z - current.z;
    const len = Math.hypot(dx, dz) || 1;
    current.dir = { x: dx / len, z: dz / len };
  }

  return course;
}

export function RaceCourse({ seed = 1337, enabled = true }) {
  const camera = useThree((state) => state.camera);
  const camPos = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3(0, 0, 1));
  const course = useRef([]);
  const gateRefs = useRef([]);
  const liftState = useRef({ current: 0, velocity: 0 });
  const randRef = useRef(null);
  const progressIndex = useRef(0);
  const lastMarkerKey = useRef("");
  const me = myPlayer();
  const [spawnPoint] = usePlayerState(me, "spawnPoint");
  const [raceStartAt] = usePlayerState(me, "raceStartAt");
  const [raceResetAt] = useMultiplayerState("raceResetAt", 0);
  const [segmentLength] = useMultiplayerState("raceSegmentLength", DEFAULT_SEGMENT_LENGTH);
  const [gateClearance] = useMultiplayerState("raceGateClearance", DEFAULT_GATE_CLEARANCE);
  const [turnStrength] = useMultiplayerState("raceTurnStrength", DEFAULT_TURN_STRENGTH);
  const setMarkers = useRaceCourseStore((state) => state.setMarkers);
  const markGatePassed = useRaceCourseStore((state) => state.markGatePassed);
  const ringGeo = useMemo(() => {
    return new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 14, 40);
  }, []);
  const axisFrom = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const axisTo = useMemo(() => new THREE.Vector3(), []);

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

  const getStartAnchor = () => {
    if (raceStartAt?.x != null && raceStartAt?.y != null && raceStartAt?.z != null) {
      const latest = me ? getLatestTransform(me.id) : null;
      const yaw = latest?.rot
        ? Math.atan2(
            2 * (latest.rot.w * latest.rot.y + latest.rot.x * latest.rot.z),
            1 - 2 * (latest.rot.y * latest.rot.y + latest.rot.x * latest.rot.x)
          )
        : 0;
      return { x: raceStartAt.x, y: raceStartAt.y, z: raceStartAt.z, heading: yaw };
    }
    if (spawnPoint?.x != null && spawnPoint?.y != null && spawnPoint?.z != null) {
      const latest = me ? getLatestTransform(me.id) : null;
      const yaw = latest?.rot
        ? Math.atan2(
            2 * (latest.rot.w * latest.rot.y + latest.rot.x * latest.rot.z),
            1 - 2 * (latest.rot.y * latest.rot.y + latest.rot.x * latest.rot.x)
          )
        : 0;
      return { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z, heading: yaw };
    }
    const spawn = getLunarSpawnPoint({ seed });
    return { x: spawn.x, y: spawn.y, z: spawn.z, heading: 0 };
  };

  useEffect(() => {
    randRef.current = makePathGenerator((seed * 2654435761 + 99) >>> 0);
    progressIndex.current = 0;
    course.current = generateCourse(seed, randRef.current, getStartAnchor(), segmentLength, gateClearance, turnStrength);
    lastMarkerKey.current = "";
    setMarkers(
      course.current.slice(0, 12).map((gate, index) => ({
        x: gate.x,
        z: gate.z,
        passed: gate.passed,
        active: index < VISIBLE_RINGS,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, spawnPoint?.x, spawnPoint?.y, spawnPoint?.z, raceStartAt?.x, raceStartAt?.y, raceStartAt?.z, raceResetAt, segmentLength, gateClearance, turnStrength]);

  useEffect(() => {
    liftState.current = { current: 0, velocity: 0 };
  }, [seed]);

  useFrame(() => {
    if (!course.current.length) return;

    if (!enabled) {
      for (const mesh of gateRefs.current) {
        if (mesh) mesh.visible = false;
      }
      if (lastMarkerKey.current !== "off") {
        lastMarkerKey.current = "off";
        setMarkers([]);
      }
      return;
    }

    readAnchor();
    const cam = camPos.current;

    let highestPassed = -1;

    for (let i = 0; i < course.current.length; i++) {
      const gate = course.current[i];
      const dx = gate.x - cam.x;
      const dz = gate.z - cam.z;

      if (!gate.passed) {
        const along = dx * Math.sin(gate.h) + dz * Math.cos(gate.h);
        const lateral = Math.abs(-dx * Math.cos(gate.h) + dz * Math.sin(gate.h));
        const vertical = Math.abs(cam.y - gate.y);
        if (along < 0 && Math.abs(along) < segmentLength * 0.4 && lateral < PASS_RADIUS && vertical < GATE_HEIGHT_TOLERANCE) {
          gate.passed = true;
          gate.fade = 1;
          if (!gate.counted) {
            gate.counted = true;
            markGatePassed();
          }
          if (i > highestPassed) highestPassed = i;
        }
      } else {
        gate.fade = Math.max(0, gate.fade - 0.02);
        if (i > highestPassed) highestPassed = i;
      }
    }

    if (highestPassed >= 0) progressIndex.current = Math.max(progressIndex.current, highestPassed + 1);
    const start = Math.max(0, progressIndex.current - 1);
    for (let i = 0; i < gateRefs.current.length; i++) {
      const mesh = gateRefs.current[i];
      const gate = course.current[start + i];
      if (!mesh) continue;
      if (!gate) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      mesh.position.set(gate.x, gate.y, gate.z);
      axisTo.set(gate.dir?.x ?? 0, 0, gate.dir?.z ?? 1).normalize();
      mesh.quaternion.setFromUnitVectors(axisFrom, axisTo);

      const mat = mesh.material;
      if (mat) {
        const base = gate.passed ? COLOR_PASSED : COLOR_AHEAD;
        mat.color.set(base);
        mat.opacity = gate.passed ? 0.95 * gate.fade : 0.6;
        if (mat.emissive) {
          mat.emissive.set(base);
          mat.emissiveIntensity = gate.passed ? 2.0 * gate.fade : 1.4;
        }
      }
    }

    const markerKey = `${start}|${course.current
      .slice(0, 12)
      .map((gate, index) => `${index}:${gate.passed ? 1 : 0}`)
      .join("|")}`;
    if (markerKey !== lastMarkerKey.current) {
      lastMarkerKey.current = markerKey;
      const activeMarkers = course.current.slice(0, 12).filter((gate, index) => index >= start && index < start + VISIBLE_RINGS);
      setMarkers(
        activeMarkers.map((gate) => ({
          x: gate.x,
          z: gate.z,
          passed: gate.passed,
          active: true,
        }))
      );
    }
  });

  return (
    <group name="RaceCourse">
      {Array.from({ length: VISIBLE_RINGS }).map((_, slot) => (
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
