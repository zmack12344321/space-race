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
import { myPlayer, usePlayersList, send } from "../../multiplayer/party";
import {
  getLaserPool,
  HIT_RADIUS,
  LASER_DAMAGE,
  LASER_LENGTH,
  LASER_RADIUS,
  LASER_TTL,
} from "./laserStore";

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
  const playerPos = useMemo(() => new Vector3(), []);

  const geometry = useMemo(() => {
    const geo = new CylinderGeometry(LASER_RADIUS, LASER_RADIUS, LASER_LENGTH, 6, 1, true);
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
          const pos = pl.getState ? pl.getState("pos") : pl.state?.pos;
          if (!pos) continue;
          playerPos.set(pos.x, pos.y, pos.z);
          // Distance from rider center to the segment travelled this frame,
          // so fast lasers can't tunnel past a target between frames.
          if (pointSegmentDistanceSq(playerPos, slot.prev, slot.pos) < HIT_RADIUS * HIT_RADIUS) {
            hit = true;
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
      dummy.scale.set(1, 1, 1);
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
