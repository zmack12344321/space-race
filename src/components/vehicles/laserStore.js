import { Vector3 } from "three";

// Module-level laser pool. NO React state here — lasers are mutated
// imperatively inside useFrame so firing/updating never triggers re-renders.
// One InstancedMesh draws all of them in a single call.

export const LASER_MAX = 96;
export const LASER_SPEED = 60; // world units / sec
export const LASER_TTL = 2.0; // sec before auto-expire
export const LASER_RADIUS = 0.06; // beam thickness
export const LASER_LENGTH = 1.2; // beam drawn length
export const FIRE_COOLDOWN = 0.12; // min sec between shots (stream rate)
export const HIT_RADIUS = 1.4; // sphere check vs other riders
export const LASER_DAMAGE = 12;
export const STUN_TIME = 0.6; // sec controls disabled on hit
export const KNOCKBACK = 14; // impulse magnitude on hit

function makeSlot() {
  return {
    active: false,
    ownerId: null,
    pos: new Vector3(),
    prev: new Vector3(),
    dir: new Vector3(),
    ttl: 0,
    speed: LASER_SPEED,
  };
}

const _pool = Array.from({ length: LASER_MAX }, makeSlot);

export function getLaserPool() {
  return _pool;
}

function freeSlot() {
  for (let i = 0; i < _pool.length; i++) {
    if (!_pool[i].active) return _pool[i];
  }
  return null;
}

export function fireLaser({ pos, dir, ownerId, ttl = LASER_TTL, speed = LASER_SPEED }) {
  const slot = freeSlot();
  if (!slot) return null;
  slot.active = true;
  slot.ownerId = ownerId;
  slot.pos.copy(pos);
  slot.dir.copy(dir).normalize();
  slot.ttl = ttl;
  slot.speed = speed;
  return slot;
}

// Remote lasers arriving over the network — same pool, ownerId differs so
// the local client never double-runs hit detection on them.
export function spawnRemoteLaser({ pos, dir, ownerId, ttl = LASER_TTL, speed = LASER_SPEED }) {
  return fireLaser({ pos, dir, ownerId, ttl, speed });
}
