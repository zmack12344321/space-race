import PartySocket from "partysocket";
import { useEffect, useSyncExternalStore } from "react";
import { Vector3 } from "three";
import { getLunarSpawnPoint, setLunarSeed } from "../utils/lunarHeightfield";
import { spawnRemoteLaser, upsertRemoteBeam, STUN_TIME, BEAM_LENGTH } from "../components/vehicles/laserStore";
import { useHealthStore } from "../components/vehicles/healthStore";

const DEFAULT_ROOM_STATE = { gameState: "title" };
const JOIN_HANDLERS = new Set();
const LISTENERS = new Set();
const TRANSIENT_KEYS = new Set(["pos", "rot", "vel", "_controls"]);
// Outbound position/rotation rate. Higher = smoother remote view (more
// bandwidth). 20ms ≈ 50Hz, which makes remote avatars track closely to the
// local 60fps view once interpolated.
const POSITION_UPDATE_MS = 15;
const DEFAULT_VEHICLE = "longboard";

// Remote players are rendered with a simple "lerp toward latest network
// position" model (the standard R3F multiplayer approach, e.g. Wawa Sensei /
// balazsfarago examples): each frame the remote kinematic body is driven toward
// the most recent position/rotation we received, smoothed by a per-frame lerp.
// Snapshot interpolation buffer. Each remote player keeps a short ring of
// received transforms stamped with BOTH the sender time (t, for RTT) and the
// local receive time (recvAt). On render we sample the buffer at
// (now - INTERP_DELAY_MS): i.e. we deliberately render slightly in the past so
// we always have two snapshots to interpolate between. This is the standard
// technique ( Valve "Shadow Buffer", Gabriel Gambetta ) and gives smooth,
// jitter-free remote motion under real (variable, lossy) network latency —
// unlike lerp-to-latest, which visibly lags and reacts late to every packet.
//
// INTERP_DELAY_MS is ADAPTIVE but tuned for a CLIENT-AUTHORITATIVE relay (not
// server-simulated). In this model the remote client has ALREADY simulated and
// sent its transform — we only need to bridge the gap between two of its
// packets, so the delay should track the (RTT + one send interval), NOT be a
// large multiple of RTT (that would just add needless latency on good links).
// On localhost (RTT ~0-5ms) it settles at the floor (~30ms ≈ 2 snapshots at
// 15ms send rate): tight and instant, while still smoothing packet jitter. On a
// 120ms link it grows to ~150ms so motion stays smooth instead of stuttering.
const INTERP_DELAY_FLOOR_MS = 30; // never render closer than this to "now"
const INTERP_DELAY_MAX_MS = 250; // cap so bad links don't feel frozen
let interpDelayMs = INTERP_DELAY_FLOOR_MS;

// Recompute the interpolation delay from the latest smoothed RTT. We render
// (RTT + floor) in the past: enough that a newer snapshot always exists to
// interpolate toward, scaled gently with latency. Called on each RTT sample.
function updateInterpDelay() {
  const target = INTERP_DELAY_FLOOR_MS + netDebug.rttMs;
  const clamped = Math.max(INTERP_DELAY_FLOOR_MS, Math.min(INTERP_DELAY_MAX_MS, target));
  // Smooth the delay itself so it doesn't jump when RTT spikes briefly.
  interpDelayMs = interpDelayMs * 0.9 + clamped * 0.1;
}

export function getInterpDelayMs() {
  return interpDelayMs;
}
// Kept for any direct references / overlay title; resolves live value.
export const INTERP_DELAY_MS = getInterpDelayMs();

const transformBuffers = new Map(); // id -> [{ t, recvAt, pos, rot, vel }]

function pushTransformSnapshot(id, snap) {
  let buf = transformBuffers.get(id);
  if (!buf) {
    buf = [];
    transformBuffers.set(id, buf);
  }
  buf.push(snap);
  // Keep ~1s of history (enough to cover INTERP_DELAY + jitter).
  const cutoff = performance.now() - 1000;
  while (buf.length > 2 && buf[0].recvAt < cutoff) buf.shift();
}

// Sample the buffer at renderTime (ms, local clock). Returns interpolated
// { pos, rot, vel } or null if no usable snapshots.
export function getInterpolatedTransform(id, renderTime) {
  const buf = transformBuffers.get(id);
  if (!buf || buf.length === 0) {
    const player = players.get(id);
    if (!player) return null;
    return { pos: player.state.pos, rot: player.state.rot, vel: player.state.vel };
  }
  if (buf.length === 1) {
    const s = buf[0];
    return { pos: s.pos, rot: s.rot, vel: s.vel };
  }
  // Find the two snapshots bracketing renderTime.
  let older = buf[0];
  let newer = buf[buf.length - 1];
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].recvAt <= renderTime && buf[i + 1].recvAt >= renderTime) {
      older = buf[i];
      newer = buf[i + 1];
      break;
    }
  }
  // Clamp to buffer edges if renderTime is outside [oldest, newest].
  if (renderTime <= buf[0].recvAt) {
    return { pos: buf[0].pos, rot: buf[0].rot, vel: buf[0].vel };
  }
  if (renderTime >= buf[buf.length - 1].recvAt) {
    const s = buf[buf.length - 1];
    return { pos: s.pos, rot: s.rot, vel: s.vel };
  }
  const span = newer.recvAt - older.recvAt;
  const a = span > 0 ? (renderTime - older.recvAt) / span : 0;
  const lerp = (p, q) => ({
    x: p.x + (q.x - p.x) * a,
    y: p.y + (q.y - p.y) * a,
    z: p.z + (q.z - p.z) * a,
  });
  const slerp = (p, q) => {
    // nlerp is fine for small per-snapshot rotation deltas.
    const r = {
      x: p.x + (q.x - p.x) * a,
      y: p.y + (q.y - p.y) * a,
      z: p.z + (q.z - p.z) * a,
      w: p.w + (q.w - p.w) * a,
    };
    const len = Math.hypot(r.x, r.y, r.z, r.w) || 1;
    return { x: r.x / len, y: r.y / len, z: r.z / len, w: r.w / len };
  };
  return {
    pos: lerp(older.pos, newer.pos),
    rot: slerp(older.rot, newer.rot),
    vel: lerp(older.vel, newer.vel),
  };
}

// Backwards-compatible accessor: returns the newest snapshot (used by non-
// interpolated consumers / tests).
export function getLatestTransform(id) {
  const buf = transformBuffers.get(id);
  if (buf && buf.length) {
    const s = buf[buf.length - 1];
    return { pos: s.pos, rot: s.rot, vel: s.vel };
  }
  const player = players.get(id);
  if (!player) return null;
  return {
    pos: player.state.pos,
    rot: player.state.rot,
    vel: player.state.vel,
  };
}

let socket = null;
let localPlayer = null;
let hostId = null;
let roomState = { ...DEFAULT_ROOM_STATE };
let players = new Map();
let version = 0;
let lastSentAt = new Map();

function getPreferredVehicle() {
  try {
    const value = window.localStorage.getItem("space-race.vehicle");
    return value || DEFAULT_VEHICLE;
  } catch {
    return DEFAULT_VEHICLE;
  }
}

function setPreferredVehicle(value) {
  try {
    window.localStorage.setItem("space-race.vehicle", value);
  } catch {
    // Ignore storage failures.
  }
}

function emit() {
  version += 1;
  LISTENERS.forEach((listener) => listener());
}

function subscribe(listener) {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
}

function snapshot() {
  return version;
}

let sendQueue = [];

export function send(event) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  } else {
    // Buffer until the socket is open so messages sent during connect/reconnect
    // (e.g. the "lobby" gameState) are not dropped.
    sendQueue.push(event);
  }
}

function flushQueue() {
  if (!sendQueue.length) return;
  const queued = sendQueue;
  sendQueue = [];
  for (const event of queued) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  }
}

function getOrCreateRoomId() {
  const url = new URL(window.location.href);
  const existing = url.searchParams.get("room");
  if (existing) return existing;

  const room = crypto.randomUUID().slice(0, 8);
  url.searchParams.set("room", room);
  window.history.replaceState(null, "", url);
  return room;
}

function getHost() {
  const configuredHost = import.meta.env.VITE_PARTYKIT_HOST;
  if (configuredHost) return configuredHost.replace(/^https?:\/\//, "");
  if (window.location.hostname === "localhost") return "localhost:1999";
  return window.location.host;
}

function makePlayer(raw) {
  const player = {
    id: raw.id,
    state: raw.state || {},
    getState(key) {
      return player.state[key];
    },
    setState(key, value) {
      player.state[key] = value;
      if (key === "vehicle" && typeof value === "string") setPreferredVehicle(value);
      if (!TRANSIENT_KEYS.has(key)) emit();

      if (key === "pos" || key === "rot" || key === "vel") {
        const throttleKey = `${player.id}:${key}`;
        const now = performance.now();
        if (now - (lastSentAt.get(throttleKey) || 0) < POSITION_UPDATE_MS) return;
        lastSentAt.set(throttleKey, now);
      }

      send({ type: "playerState", id: player.id, key, value });
    },
    onQuit(callback) {
      player.onQuitCallback = callback;
    },
  };
  return player;
}

function upsertPlayer(raw, notifyJoin = false) {
  const existing = players.get(raw.id);
  if (existing) {
    existing.state = { ...existing.state, ...raw.state };
    emit();
    return existing;
  }

  const player = makePlayer(raw);
  players.set(player.id, player);
  if (player.id === localPlayer?.id) localPlayer = player;
  emit();
  if (notifyJoin) JOIN_HANDLERS.forEach((handler) => handler(player));
  return player;
}

// Send pos/rot/vel together as ONE throttled message so the receiver's snapshot
// buffer stays phase-aligned (no pos-from-this-tick / rot-from-last-tick seams).
// --- Netcode debug (test map only) -------------------------------------------
// Tracks round-trip time and per-peer freshness so we can SEE where latency
// lives instead of guessing. Written by setTransform/send and handleMessage,
// read by the test overlay.
export const netDebug = {
  rttMs: 0,
  sendHz: 0,
  lastSendAt: 0,
  peers: {}, // id -> { lastRecvAt, ageMs, recvHz }
  renderLagMs: 0, // how far behind "now" the remote avatar is drawn
  _sendTimes: [],
  _recvTimes: {},
};

// Compute derived debug stats (recv Hz + age) for a peer.
export function getPeerDebug(id) {
  const peer = netDebug.peers[id];
  if (!peer) return null;
  const now = performance.now();
  const recvs = peer._recvs || [];
  let hz = 0;
  if (recvs.length >= 2) {
    const span = recvs[recvs.length - 1] - recvs[0];
    if (span > 0) hz = ((recvs.length - 1) / span) * 1000;
  }
  return { ageMs: now - peer.lastRecvAt, recvHz: hz };
}

export function setRenderLag(ms) {
  netDebug.renderLagMs = ms;
}

export function setTransform(player, transform) {
  if (!player) return;
  if (transform.pos) player.state.pos = transform.pos;
  if (transform.rot) player.state.rot = transform.rot;
  if (transform.vel) player.state.vel = transform.vel;
  const throttleKey = `${player.id}:transform`;
  const now = performance.now();
  if (now - (lastSentAt.get(throttleKey) || 0) < POSITION_UPDATE_MS) return;
  lastSentAt.set(throttleKey, now);
  // Stamp the send so the receiver can echo it back for RTT.
  const t = Math.round(now);
  netDebug.lastSendAt = t;
  netDebug._sendTimes.push(t);
  if (netDebug._sendTimes.length > 30) netDebug._sendTimes.shift();
  send({
    type: "playerState",
    id: player.id,
    key: "transform",
    value: { pos: transform.pos, rot: transform.rot, vel: transform.vel, _t: t },
  });
}

function handleMessage(event) {
  const message = JSON.parse(event.data);

  if (message.type === "snapshot") {
    if (typeof message.seed === "number") setLunarSeed(message.seed, { persist: false });
    roomState = { ...DEFAULT_ROOM_STATE, ...message.roomState };
    hostId = message.hostId;
    players = new Map();
    message.players.forEach((player) => upsertPlayer(player));
    if (localPlayer) upsertPlayer(localPlayer, true);
    emit();
    return;
  }

  if (message.type === "playerJoined") {
    if (typeof message.seed === "number") setLunarSeed(message.seed, { persist: false });
    hostId = message.hostId;
    upsertPlayer(message.player, true);
    return;
  }

  if (message.type === "playerLeft") {
    const player = players.get(message.id);
    hostId = message.hostId;
    players.delete(message.id);
    player?.onQuitCallback?.();
    emit();
    return;
  }

  if (message.type === "playerState") {
    const player = players.get(message.id);
    if (!player) return;
    // Combined transform message: pos/rot/vel in one update. Stored as the
    // latest network state; remote rendering lerps toward it each frame.
    if (message.key === "transform" && message.value) {
      const t = message.value;
      if (t.pos) player.state.pos = t.pos;
      if (t.rot) player.state.rot = t.rot;
      if (t.vel) player.state.vel = t.vel;
      // Debug: RTT + receive freshness.
      const now = performance.now();
      if (typeof t._t === "number") {
        const rtt = now - t._t;
        if (rtt >= 0 && rtt < 5000) {
          netDebug.rttMs = netDebug.rttMs * 0.9 + rtt * 0.1;
          const st = netDebug._sendTimes.shift();
          void st;
          updateInterpDelay();
        }
      }
      // Store snapshot for interpolation buffer (recvAt = local arrival time).
      pushTransformSnapshot(message.id, {
        t: typeof t._t === "number" ? t._t : now,
        recvAt: now,
        pos: t.pos,
        rot: t.rot,
        vel: t.vel,
      });
      const peer = netDebug.peers[message.id] || { lastRecvAt: 0, _recvs: [] };
      peer.lastRecvAt = now;
      peer._recvs.push(now);
      if (peer._recvs.length > 30) peer._recvs.shift();
      netDebug.peers[message.id] = peer;
      return;
    }
    player.state[message.key] = message.value;
    if (!TRANSIENT_KEYS.has(message.key)) emit();
    return;
  }

  if (message.type === "roomState") {
    roomState[message.key] = message.value;
    if (message.key === "lunarSeed" && typeof message.value === "number") {
      setLunarSeed(message.value, { persist: false });
    }
    emit();
  }

  if (message.type === "laser") {
    // Ignore our own echo — we already spawned it locally on fire.
    if (message.ownerId === localPlayer?.id) return;
    spawnRemoteLaser({
      ownerId: message.ownerId,
      pos: new Vector3(message.pos.x, message.pos.y, message.pos.z),
      dir: new Vector3(message.dir.x, message.dir.y, message.dir.z),
      ttl: message.ttl,
      speed: message.speed,
    });
    return;
  }

  if (message.type === "beam") {
    // Remote sustained beam: ignore our own; refresh the shared slot.
    if (message.ownerId === localPlayer?.id) return;
    upsertRemoteBeam({
      ownerId: message.ownerId,
      pos: new Vector3(message.pos.x, message.pos.y, message.pos.z),
      dir: new Vector3(message.dir.x, message.dir.y, message.dir.z),
      beamLength: message.beamLength ?? BEAM_LENGTH,
      active: message.active,
    });
    return;
  }

  if (message.type === "damage") {
    const me = localPlayer;
    if (me && message.targetId === me.id) {
      const store = useHealthStore.getState();
      const next = store.applyDamage(message.amount);
      send({ type: "playerState", id: me.id, key: "health", value: next });
      if (next <= 0) {
        store.reset();
        send({ type: "playerState", id: me.id, key: "health", value: 100 });
        damageHandler?.("respawn");
      } else {
        store.setStunUntil(performance.now() / 1000 + STUN_TIME);
        damageHandler?.("knockback", message.knockDir);
      }
    }
    return;
  }
}

// RiderController registers this so incoming damage can apply knockback /
// respawn against the actual physics body.
let damageHandler = null;
export function setDamageHandler(fn) {
  damageHandler = fn;
}

function connect() {
  socket = new PartySocket({
    host: getHost(),
    room: getOrCreateRoomId(),
    id: localPlayer.id,
  });

  socket.addEventListener("message", handleMessage);
  // Send join on every (re)connect so auto-reconnects re-establish the session.
  socket.addEventListener("open", () => {
    send({
      type: "join",
      id: localPlayer.id,
      name: localPlayer.state.name || localPlayer.state.profile?.name,
      vehicle: localPlayer.state.vehicle,
      pos: localPlayer.state.pos,
      rot: localPlayer.state.rot,
    });
    flushQueue();
  });
}

export async function insertCoin({ offline = false } = {}) {
  const id = crypto.randomUUID();
  const fallbackName = `Rider ${id.slice(0, 4)}`;
  const isTestMode = window.location.pathname.startsWith("/test");
  const spawnPoint = isTestMode ? { x: 0, y: 8, z: 0 } : getLunarSpawnPoint();
  const vehicle = getPreferredVehicle();
  localPlayer = makePlayer({
    id,
    state: {
      profile: { name: fallbackName },
      name: fallbackName,
      vehicle,
      pos: spawnPoint,
      rot: { x: 0, y: 0, z: 0, w: 1 },
    },
  });
  players.set(id, localPlayer);
  hostId = id;

  if (!offline) {
    connect();
  }
  emit();
}

// Leave the current room locally: close the socket and reset local view state
// WITHOUT broadcasting. The room keeps running for everyone else.
export function leaveRoom() {
  if (socket) {
    try {
      socket.close();
    } catch {
      // Ignore close errors.
    }
    socket = null;
  }
  players = new Map();
  roomState = { ...DEFAULT_ROOM_STATE };
  hostId = null;
  emit();
}

// Reconnect to the room we left (keeps the same local player identity).
export function rejoin() {
  if (!localPlayer) return;
  // Skip if we already have a live (or in-flight) socket.
  if (socket && socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED) {
    return;
  }
  connect();
  emit();
}

// Set the local game view without telling the server (used when entering the
// lobby after a local quit, so we don't yank the whole room).
export function setLocalGameState(value) {
  roomState.gameState = value;
  emit();
}

export function myPlayer() {
  return localPlayer;
}

export function getHostId() {
  return hostId;
}

export function isHost() {
  return Boolean(localPlayer?.id && (!hostId || localPlayer.id === hostId));
}

export function usePlayersList() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return Array.from(players.values());
}

export function useMultiplayerState(key, initialValue) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  if (roomState[key] === undefined) roomState[key] = initialValue;
  return [
    roomState[key],
    (value) => {
      roomState[key] = value;
      emit();
      send({ type: "roomState", key, value });
    },
  ];
}

export function usePlayerState(player, key) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return [
    player?.getState(key),
    (value) => {
      player?.setState(key, value);
    },
  ];
}

export function onPlayerJoin(callback) {
  JOIN_HANDLERS.add(callback);
  players.forEach(callback);
  return () => JOIN_HANDLERS.delete(callback);
}

export async function startMatchmaking() {
  return Promise.resolve();
}

export class Joystick {
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.pressed = false;
    this.currentAngle = 0;
    this.buttons = new Set();
    this.cleanup = () => {};

    // Touch input is owned by ecctrl/input. This class remains as a small
    // compatibility adapter for controller consumers and remote state reads.
  }

  isJoystickPressed() {
    return this.state.id === localPlayer?.id
      ? this.pressed
      : Boolean(this.state.getState("_controls")?.pressed);
  }

  angle() {
    return this.state.id === localPlayer?.id
      ? this.currentAngle
      : this.state.getState("_controls")?.angle || 0;
  }

  isPressed(id) {
    if (this.state.id === localPlayer?.id) return this.buttons.has(id);
    return Boolean(this.state.getState("_controls")?.buttons?.includes(id));
  }
}

function publishControls(controls) {
  controls.state.setState("_controls", {
    pressed: controls.pressed,
    angle: controls.currentAngle,
    buttons: Array.from(controls.buttons),
  });
}

function mountLocalControls(controls) {
  if (!window.matchMedia("(pointer: coarse)").matches) {
    return () => {};
  }

  const root = document.createElement("div");
  root.className = "fixed z-20 left-4 bottom-4 select-none";
  root.innerHTML = `
    <div data-stick class="w-28 h-28 rounded-full bg-white/20 border border-white/40 backdrop-blur-md touch-none relative">
      <div data-nub class="absolute left-1/2 top-1/2 w-10 h-10 -ml-5 -mt-5 rounded-full bg-white/70"></div>
    </div>
  `;
  document.body.appendChild(root);

  const stick = root.querySelector("[data-stick]");
  const nub = root.querySelector("[data-nub]");
  const radius = 56;

  const setFromPointer = (event) => {
    const rect = stick.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const length = Math.min(Math.hypot(x, y), radius);
    const angle = Math.atan2(y, x);
    controls.pressed = true;
    controls.currentAngle = angle;
    nub.style.transform = `translate(${Math.cos(angle) * length}px, ${Math.sin(angle) * length}px)`;
    publishControls(controls);
  };

  const release = () => {
    controls.pressed = false;
    nub.style.transform = "translate(0, 0)";
    publishControls(controls);
  };

  const onPointerDown = (event) => {
    stick.setPointerCapture(event.pointerId);
    setFromPointer(event);
  };
  const onPointerMove = (event) => {
    if (controls.pressed) setFromPointer(event);
  };

  stick.addEventListener("pointerdown", onPointerDown);
  stick.addEventListener("pointermove", onPointerMove);
  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointercancel", release);

  return () => {
    root.remove();
  };
}

export function usePartyConnectionWarning() {
  useEffect(() => {
    if (!import.meta.env.VITE_PARTYKIT_HOST && window.location.hostname !== "localhost") {
      console.warn("VITE_PARTYKIT_HOST missing; production multiplayer may connect to wrong host.");
    }
  }, []);
}
