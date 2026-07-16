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
const POSITION_UPDATE_MS = 20;
const DEFAULT_VEHICLE = "longboard";

// Snapshot interpolation: remote avatars are rendered at a fixed delay behind
// real time and lerped between the two network snapshots that bracket that
// render time. This is the canonical approach (Gambetta) for smooth remote
// motion — we never extrapolate *past* known data, so there is no overshoot or
// snap-back when the next packet arrives. The delay trades a little latency for
// zero jitter; 100ms covers ~5 snapshots at 50Hz so we always have a bracket.
const INTERP_DELAY_MS = 100;
const SNAPSHOT_BUFFER_MS = 2000;
const _snapshots = new Map(); // playerId -> array of { t, pos, rot, vel }

function pushSnapshot(id, key, value) {
  // Only pos/rot/vel form the interpolated transform.
  let buf = _snapshots.get(id);
  if (!buf) {
    buf = [];
    _snapshots.set(id, buf);
  }
  const t = performance.now() / 1000;
  // Snapshots are stored per-field but we need them time-aligned. Keep a single
  // buffer keyed by arrival time; the latest value of each field wins within a
  // tick. To keep brackets correct we coalesce rapid updates into one entry.
  const last = buf[buf.length - 1];
  if (last && t - last.t < 0.001) {
    if (key === "pos") last.pos = value;
    else if (key === "rot") last.rot = value;
    else if (key === "vel") last.vel = value;
  } else {
    buf.push({
      t,
      pos: key === "pos" ? value : last?.pos,
      rot: key === "rot" ? value : last?.rot,
      vel: key === "vel" ? value : last?.vel,
    });
  }
  const cutoff = t - SNAPSHOT_BUFFER_MS / 1000;
  while (buf.length > 2 && buf[1].t < cutoff) buf.shift();
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

// Returns the interpolated { pos, rot, vel } for a remote player at the render
// time (now - INTERP_DELAY_MS). Returns null if no snapshots yet. Falls back to
// the raw latest state if the buffer is too short so avatars still appear.
export function getInterpolatedTransform(id) {
  const buf = _snapshots.get(id);
  const player = players.get(id);
  if (!buf || buf.length === 0) {
    if (!player) return null;
    return {
      pos: player.state.pos,
      rot: player.state.rot,
      vel: player.state.vel,
    };
  }
  const renderTime = performance.now() / 1000 - INTERP_DELAY_MS / 1000;
  if (buf.length === 1 || renderTime <= buf[0].t) {
    const s = buf[0];
    return { pos: s.pos, rot: s.rot, vel: s.vel };
  }
  if (renderTime >= buf[buf.length - 1].t) {
    const s = buf[buf.length - 1];
    return { pos: s.pos, rot: s.rot, vel: s.vel };
  }
  let a = buf[0];
  let b = buf[buf.length - 1];
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].t <= renderTime && buf[i + 1].t >= renderTime) {
      a = buf[i];
      b = buf[i + 1];
      break;
    }
  }
  const span = b.t - a.t;
  const f = span > 0 ? (renderTime - a.t) / span : 0;
  const pa = a.pos || player?.state.pos;
  const pb = b.pos || player?.state.pos;
  const ra = a.rot || player?.state.rot;
  const rb = b.rot || player?.state.rot;
  const va = a.vel || player?.state.vel;
  const vb = b.vel || player?.state.vel;
  return {
    pos: pa && pb ? { x: lerp(pa.x, pb.x, f), y: lerp(pa.y, pb.y, f), z: lerp(pa.z, pb.z, f) } : pa,
    rot:
      ra && rb
        ? { x: lerp(ra.x, rb.x, f), y: lerp(ra.y, rb.y, f), z: lerp(ra.z, rb.z, f), w: lerp(ra.w, rb.w, f) }
        : ra,
    vel: va && vb ? { x: lerp(va.x, vb.x, f), y: lerp(va.y, vb.y, f), z: lerp(va.z, vb.z, f) } : va,
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
    _snapshots.delete(message.id);
    player?.onQuitCallback?.();
    emit();
    return;
  }

  if (message.type === "playerState") {
    const player = players.get(message.id);
    if (!player) return;
    player.state[message.key] = message.value;
    if (TRANSIENT_KEYS.has(message.key)) pushSnapshot(message.id, message.key, message.value);
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
