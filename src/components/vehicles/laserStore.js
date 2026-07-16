import { Vector3 } from "three";

// Module-level laser pool. NO React state here — lasers are mutated
// imperatively inside useFrame so firing/updating never triggers re-renders.
// One InstancedMesh draws all of them in a single call.

export const LASER_MAX = 96;
export const LASER_SPEED = 60; // world units / sec (discrete shots)
export const LASER_TTL = 2.0; // sec before auto-expire (discrete shots)
export const SHOT_RADIUS = 0.06; // discrete shot thickness (original thin look)
export const SHOT_LENGTH = 1.2; // discrete shot drawn length (original)
export const BEAM_RADIUS = 0.14; // sustained beam thickness (chunky)
export const HIT_RADIUS = 1.4; // sphere check vs other riders
export const LASER_DAMAGE = 12; // per discrete hit
export const STUN_TIME = 0.6; // sec controls disabled on hit
export const KNOCKBACK = 7; // impulse magnitude on hit (gentler)
export const KNOCKBACK_PREDICT_MAG = 7; // predicted knockback VELOCITY on the shooter's screen (≈ real impulse)

// Continuous beam (hold-to-fire).
export const BEAM_LENGTH = 80; // world units the sustained beam reaches
export const BEAM_DAMAGE_PER_SEC = 45; // DPS while a rider is in the beam
export const BEAM_TICK = 0.1; // damage application interval while beaming
export const OVERHEAT_TIME = 3.0; // sec of continuous fire before overheating
export const COOL_RATE = 1.5; // heat units (of OVERHEAT_TIME) recovered per sec
export const HEAT_PER_SHOT = 0.35; // heat added per discrete (click) shot
export const HOLD_THRESHOLD = 0.18; // sec a press must exceed to become a beam

function makeSlot() {
  return {
    active: false,
    ownerId: null,
    isBeam: false,
    beamLength: 0,
    expireAt: 0, // for remote beams: last sync time + grace
    lastDamageAt: 0,
    pos: new Vector3(),
    prev: new Vector3(),
    dir: new Vector3(),
    ttl: 0,
    speed: LASER_SPEED,
    radius: SHOT_RADIUS,
    length: SHOT_LENGTH,
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

function resetSlot(slot, { pos, dir, ownerId }) {
  slot.active = true;
  slot.ownerId = ownerId;
  slot.isBeam = false;
  slot.expireAt = 0;
  slot.lastDamageAt = 0;
  slot.pos.copy(pos);
  slot.prev.copy(pos);
  slot.dir.copy(dir).normalize();
}

export function fireLaser({ pos, dir, ownerId, ttl = LASER_TTL, speed = LASER_SPEED }) {
  const slot = freeSlot();
  if (!slot) return null;
  resetSlot(slot, { pos, dir, ownerId });
  slot.ttl = ttl;
  slot.speed = speed;
  slot.radius = SHOT_RADIUS;
  slot.length = SHOT_LENGTH;
  return slot;
}

// Sustained beam slot — kept alive and repositioned every frame by its owner.
export function fireBeam({ pos, dir, ownerId, beamLength = BEAM_LENGTH }) {
  const slot = freeSlot();
  if (!slot) return null;
  resetSlot(slot, { pos, dir, ownerId });
  slot.isBeam = true;
  slot.beamLength = beamLength;
  slot.radius = BEAM_RADIUS;
  slot.length = beamLength;
  slot.ttl = 0.2; // refreshed each frame while held
  slot.speed = 0;
  return slot;
}

// Remote lasers / beams arriving over the network — same pool, ownerId differs
// so the local client never double-runs hit detection on them.
export function spawnRemoteLaser({ pos, dir, ownerId, ttl = LASER_TTL, speed = LASER_SPEED }) {
  return fireLaser({ pos, dir, ownerId, ttl, speed });
}

// Remote beams: keyed by owner so repeated syncs refresh one slot.
const _remoteBeams = new Map();

export function upsertRemoteBeam({ ownerId, pos, dir, beamLength, active }) {
  const now = performance.now() / 1000;
  if (!active) {
    const idx = _remoteBeams.get(ownerId);
    if (idx != null && _pool[idx]) _pool[idx].active = false;
    _remoteBeams.delete(ownerId);
    return null;
  }
  let idx = _remoteBeams.get(ownerId);
  let slot = idx != null ? _pool[idx] : null;
  if (!slot || !slot.active) {
    slot = fireBeam({ pos, dir, ownerId, beamLength });
    if (!slot) return null;
    idx = _pool.indexOf(slot);
    _remoteBeams.set(ownerId, idx);
  } else {
    slot.pos.copy(pos);
    slot.prev.copy(pos);
    slot.dir.copy(dir).normalize();
    slot.beamLength = beamLength;
    slot.radius = BEAM_RADIUS;
    slot.length = beamLength;
    slot.isBeam = true;
    slot.ttl = 0.2;
  }
  slot.expireAt = now + 0.2;
  return slot;
}
