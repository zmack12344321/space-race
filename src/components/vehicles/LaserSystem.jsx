import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";
import { myPlayer, usePlayersList, send, getLatestTransform } from "../../multiplayer/party";
import {
  getLaserPool,
  HIT_RADIUS,
  LASER_DAMAGE,
  LASER_TTL,
  BEAM_DAMAGE_PER_SEC,
  BEAM_TICK,
  KNOCKBACK_PREDICT_MAG,
} from "./laserStore";
import { predictKnockback } from "./knockbackPredict";

// Squared distance from point p to segment [a,b].
function pointSegmentDistanceSq(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const apz = p.z - a.z;
  const lenSq = abx * abx + aby * aby + abz * abz;
  let t = lenSq > 0 ? (apx * abx + apy * aby + apz * abz) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const cz = a.z + abz * t;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const dz = p.z - cz;
  return dx * dx + dy * dy + dz * dz;
}

// Renders every laser as one InstancedMesh (single draw call). All motion +
// hit detection happens imperatively here; no React state churn.
export function LaserSystem({ getGroundHeight }) {
  const meshRef = useRef();
  const players = usePlayersList();
  const me = myPlayer();
  const myId = me?.id;

  if (import.meta.env.DEV) {
    window.__getLaserPool = getLaserPool;
  }

  // Reused scratch objects — zero per-frame allocations.
  const dummy = useMemo(() => new Object3D(), []);
  const target = useMemo(() => new Vector3(), []);
  const center = useMemo(() => new Vector3(), []);
  const playerPos = useMemo(() => new Vector3(), []);
  const beamEnd = useMemo(() => new Vector3(), []);

  // Where a remote player is drawn this frame (interpolated), so hit tests line
  // up with what the shooter actually sees. Falls back to the latest network
  // pos if interpolation has no data yet.
  const getRemoteHitPos = (pl) => {
    if (pl.id === myId) return pl.getState ? pl.getState("pos") : pl.state?.pos;
    const latest = getLatestTransform(pl.id);
    return latest?.pos || (pl.getState ? pl.getState("pos") : pl.state?.pos);
  };

  const geometry = useMemo(() => {
    // Unit cylinder: radius 1, length 1 along +Z. Per-slot radius/length
    // are applied via instance scale so shots and beams share one geometry.
    const geo = new CylinderGeometry(1, 1, 1, 6, 1, true);
    geo.rotateX(Math.PI / 2); // length now runs along +Z
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color("#ff2d55"),
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const pool = getLaserPool();
    const dt = Math.min(delta, 0.05);

    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i];
      if (!slot.active) {
        // collapse inactive instances so they don't render
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const now = performance.now() / 1000;

      // Remote beams expire if syncs stop arriving.
      if (slot.isBeam && slot.ownerId !== myId) {
        if (now > slot.expireAt) {
          slot.active = false;
          dummy.position.set(0, -9999, 0);
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
      }

      if (slot.isBeam) {
        // Sustained beam: hit-test along its full length, throttled.
        if (slot.ownerId === myId) {
          const tick = BEAM_DAMAGE_PER_SEC * BEAM_TICK;
          if (now - slot.lastDamageAt >= BEAM_TICK) {
            slot.lastDamageAt = now;
            beamEnd.copy(slot.pos).addScaledVector(slot.dir, slot.beamLength);
            for (let p = 0; p < players.length; p++) {
              const pl = players[p];
              if (!pl || pl.id === myId) continue;
              const pos = getRemoteHitPos(pl);
              if (!pos) continue;
              playerPos.set(pos.x, pos.y, pos.z);
              if (
                pointSegmentDistanceSq(playerPos, slot.pos, beamEnd) <
                HIT_RADIUS * HIT_RADIUS
              ) {
                predictKnockback(pl.id, slot.dir, KNOCKBACK_PREDICT_MAG);
                send({
                  type: "damage",
                  targetId: pl.id,
                  amount: tick,
                  sourceId: myId,
                  knockDir: { x: slot.dir.x, y: slot.dir.y, z: slot.dir.z },
                });
              }
            }
          }
        }
        // Render: cylinder is centered, so shift back half-length so it
        // starts at the muzzle and extends forward.
        center.copy(slot.pos).addScaledVector(slot.dir, slot.beamLength * 0.5);
        target.copy(slot.pos).addScaledVector(slot.dir, slot.beamLength);
        dummy.position.copy(center);
        dummy.lookAt(target);
        dummy.scale.set(slot.radius, slot.radius, slot.length);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      slot.ttl -= dt;
      slot.prev.copy(slot.pos);
      slot.pos.addScaledVector(slot.dir, slot.speed * dt);

      // Ground cull via existing heightfield (cheap, no rapier raycast).
      if (getGroundHeight) {
        const ground = getGroundHeight(slot.pos.x, slot.pos.z);
        if (ground !== undefined && slot.pos.y < ground) slot.ttl = 0;
      }

      // Hit test only on lasers THIS client owns.
      let hit = false;
      if (slot.ownerId === myId) {
        for (let p = 0; p < players.length; p++) {
          const pl = players[p];
          if (!pl || pl.id === myId) continue;
          const pos = getRemoteHitPos(pl);
          if (!pos) continue;
          playerPos.set(pos.x, pos.y, pos.z);
          // Distance from rider center to the segment travelled this frame,
          // so fast lasers can't tunnel past a target between frames.
          if (pointSegmentDistanceSq(playerPos, slot.prev, slot.pos) < HIT_RADIUS * HIT_RADIUS) {
            hit = true;
            predictKnockback(pl.id, slot.dir, KNOCKBACK_PREDICT_MAG);
            send({
              type: "damage",
              targetId: pl.id,
              amount: LASER_DAMAGE,
              sourceId: myId,
              knockDir: { x: slot.dir.x, y: slot.dir.y, z: slot.dir.z },
            });
            break;
          }
        }
      }

      if (slot.ttl <= 0 || hit) {
        slot.active = false;
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      target.copy(slot.pos).add(slot.dir);
      dummy.position.copy(slot.pos);
      dummy.lookAt(target); // +Z aligned with travel dir
      dummy.scale.set(slot.radius, slot.radius, slot.length);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, getLaserPool().length]}
      frustumCulled={false}
    />
  );
}
