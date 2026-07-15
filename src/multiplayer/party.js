import PartySocket from "partysocket";
import { useEffect, useSyncExternalStore } from "react";
import { Vector3 } from "three";
import { getLunarSpawnPoint, setLunarSeed } from "../utils/lunarHeightfield";
import { spawnRemoteLaser, STUN_TIME } from "../components/vehicles/laserStore";
import { useHealthStore } from "../components/vehicles/healthStore";

const DEFAULT_ROOM_STATE = { gameState: "title" };
const JOIN_HANDLERS = new Set();
const LISTENERS = new Set();
const TRANSIENT_KEYS = new Set(["pos", "rot", "_controls"]);
// Outbound position/rotation rate. Higher = smoother remote view (more
// bandwidth). 20ms ≈ 50Hz, which makes remote avatars track closely to the
// local 60fps view once interpolated.
const POSITION_UPDATE_MS = 20;
const DEFAULT_VEHICLE = "longboard";

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

      if (key === "pos" || key === "rot") {
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
    player?.onQuitCallback?.();
    emit();
    return;
  }

  if (message.type === "playerState") {
    const player = players.get(message.id);
    if (!player) return;
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
