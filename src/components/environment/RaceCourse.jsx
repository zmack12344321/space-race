import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getLatestTransform, myPlayer, useMultiplayerState, usePlayerState } from "../../multiplayer/party";
import { getLunarHeight, getLunarSpawnPoint, nearestRockDistance, scoreSpawnPoint } from "../../utils/lunarHeightfield";
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
const DEFAULT_ROUTE_VARIETY = 0.55;
const DEFAULT_ARCH_BIAS = 0.3;
const DEFAULT_PEAK_BIAS = 0.3;
const DEFAULT_CANYON_BIAS = 0.25;

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

function sampleTerrainProfile(x, z, seed) {
  const h = getLunarHeight(x, z, seed);
  const samples = [
    [8, 0],
    [-8, 0],
    [0, 8],
    [0, -8],
    [12, 12],
    [-12, 12],
    [12, -12],
    [-12, -12],
  ];

  let min = h;
  let max = h;
  let slope = 0;

  for (const [dx, dz] of samples) {
    const sample = getLunarHeight(x + dx, z + dz, seed);
    min = Math.min(min, sample);
    max = Math.max(max, sample);
    slope += Math.abs(sample - h);
  }

  return {
    height: h,
    roughness: max - min,
    slope,
    rockDistance: nearestRockDistance(x, z, seed),
  };
}

function chooseRouteStyle(rand, weights) {
  const total = weights.arch + weights.peak + weights.canyon + weights.sky;
  const pick = rand.rand() * total;
  let cursor = weights.arch;
  if (pick < cursor) return "arch";
  cursor += weights.peak;
  if (pick < cursor) return "peak";
  cursor += weights.canyon;
  if (pick < cursor) return "canyon";
  return "sky";
}

function pickNextPoint({ prev, heading, seed, rand, liftState, segmentLength, turnStrength, gateClearance, routeStyle }) {
  const styleTurn = routeStyle === "arch" ? 0.85 : routeStyle === "canyon" ? 1.1 : routeStyle === "peak" ? 1.2 : 1;
  const candidates = [-1.4, -1, -0.65, -0.3, 0, 0.3, 0.65, 1, 1.4].map((n) => n * turnStrength * styleTurn);
  let best = null;

  for (const turn of candidates) {
    const nextHeading = heading + turn;
    const x = prev.x + Math.sin(nextHeading) * segmentLength;
    const z = prev.z + Math.cos(nextHeading) * segmentLength;
    const profile = sampleTerrainProfile(x, z, seed);
    const terrainScore = scoreSpawnPoint(x, z, getLunarHeight, prev, seed);
    const turnScore = Math.abs(turn) * (routeStyle === "arch" ? 4.5 : routeStyle === "peak" ? 7 : routeStyle === "canyon" ? 5.25 : 6);
    const liftScore = liftState.current * 0.06;

    let styleScore = 0;
    if (routeStyle === "arch") {
      styleScore += profile.slope * 1.6;
      styleScore += profile.roughness * 1.4;
      styleScore += Math.max(0, 18 - profile.rockDistance) * 0.85;
    } else if (routeStyle === "peak") {
      styleScore += Math.max(0, 4 - profile.roughness) * 4.5;
      styleScore += Math.max(0, 14 - profile.rockDistance) * 1.4;
      styleScore -= profile.height * 0.22;
    } else if (routeStyle === "canyon") {
      styleScore += Math.abs(profile.rockDistance - 16) * 0.8;
      styleScore += Math.max(0, 2.2 - profile.slope) * 1.7;
      styleScore += profile.roughness * 0.7;
    } else {
      styleScore += profile.slope * 0.85;
      styleScore += profile.roughness * 0.65;
    }

    const score = terrainScore + turnScore + liftScore + styleScore;

    if (!best || score < best.score) {
      best = { x, z, h: nextHeading, score, profile };
    }
  }

  const styleLift =
    routeStyle === "arch" ? -0.45 + (rand.rand() - 0.5) * 0.45 :
    routeStyle === "peak" ? 0.95 + (rand.rand() - 0.5) * 0.55 :
    routeStyle === "canyon" ? -0.15 + (rand.rand() - 0.5) * 0.4 :
    0.55 + (rand.rand() - 0.5) * 0.65;

  liftState.velocity += (rand.rand() - 0.5) * (routeStyle === "peak" ? 0.55 : 0.35);
  liftState.velocity = THREE.MathUtils.clamp(liftState.velocity, -0.45, 0.65);
  liftState.current = THREE.MathUtils.clamp(liftState.current + liftState.velocity + styleLift * 0.15, 0, routeStyle === "peak" ? 22 : 14);

  const clearance =
    routeStyle === "arch" ? Math.max(3, gateClearance * 0.35 + liftState.current * 0.2) :
    routeStyle === "peak" ? gateClearance * 1.35 + 10 + liftState.current :
    routeStyle === "canyon" ? gateClearance * 0.7 + 4 + liftState.current * 0.35 :
    gateClearance + 6 + liftState.current * 0.5;

  return {
    x: best.x,
    z: best.z,
    h: best.h,
    y: sampleGateHeight(best.x, best.z, seed) + clearance,
    passed: false,
    style: routeStyle,
  };
}

function generateCourse(seed, rand, anchor, segmentLength, gateClearance, turnStrength, routeVariety, archBias, peakBias, canyonBias) {
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
      style: "sky",
    },
  ];

  const liftState = { current: 0, velocity: 0 };
  let routeStyle = chooseRouteStyle(rand, {
    arch: 0.3 + archBias + routeVariety * 0.15,
    peak: 0.25 + peakBias + routeVariety * 0.12,
    canyon: 0.2 + canyonBias + routeVariety * 0.14,
    sky: Math.max(0.18, 0.8 - (archBias + peakBias + canyonBias) * 0.35),
  });
  let routeRemaining = 2 + Math.floor(rand.rand() * (2 + routeVariety * 6));

  while (course.length < GENERATED_AHEAD) {
    if (routeRemaining <= 0) {
      routeStyle = chooseRouteStyle(rand, {
        arch: 0.3 + archBias + routeVariety * 0.15,
        peak: 0.25 + peakBias + routeVariety * 0.12,
        canyon: 0.2 + canyonBias + routeVariety * 0.14,
        sky: Math.max(0.18, 0.8 - (archBias + peakBias + canyonBias) * 0.35),
      });
      routeRemaining = 2 + Math.floor(rand.rand() * (2 + routeVariety * 6));
    }

    const next = pickNextPoint({ prev: course[course.length - 1], heading: course[course.length - 1].h, seed, rand, liftState, segmentLength, turnStrength, gateClearance, routeStyle });
    course.push({ ...next, fade: 1, counted: false });
    routeRemaining -= 1;
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
  const [routeVariety] = useMultiplayerState("raceRouteVariety", DEFAULT_ROUTE_VARIETY);
  const [archBias] = useMultiplayerState("raceArchBias", DEFAULT_ARCH_BIAS);
  const [peakBias] = useMultiplayerState("racePeakBias", DEFAULT_PEAK_BIAS);
  const [canyonBias] = useMultiplayerState("raceCanyonBias", DEFAULT_CANYON_BIAS);
  const setMarkers = useRaceCourseStore((state) => state.setMarkers);
  const markGatePassed = useRaceCourseStore((state) => state.markGatePassed);
  const resetToken = useRaceCourseStore((state) => state.resetToken);
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
    course.current = generateCourse(seed, randRef.current, getStartAnchor(), segmentLength, gateClearance, turnStrength, routeVariety, archBias, peakBias, canyonBias);
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
  }, [seed, spawnPoint?.x, spawnPoint?.y, spawnPoint?.z, raceStartAt?.x, raceStartAt?.y, raceStartAt?.z, raceResetAt, resetToken, segmentLength, gateClearance, turnStrength, routeVariety, archBias, peakBias, canyonBias]);

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
