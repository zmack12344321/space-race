import { useEffect, useRef } from "react";

const AXIS_DEADZONE = 0.18;
const TRIGGER_DEADZONE = 0.12;
const STICK_NAV_THRESHOLD = 0.55;

const EMPTY_BUTTONS = {
  a: false,
  b: false,
  x: false,
  y: false,
  lb: false,
  rb: false,
  back: false,
  start: false,
  ls: false,
  rs: false,
  lt: false,
  rt: false,
  up: false,
  down: false,
  left: false,
  right: false,
  dpadUp: false,
  dpadDown: false,
  dpadLeft: false,
  dpadRight: false,
};

const EMPTY_AXES = {
  lx: 0,
  ly: 0,
  rx: 0,
  ry: 0,
  lt: 0,
  rt: 0,
};

const EMPTY_STATE = {
  connected: false,
  index: -1,
  id: "",
  timestamp: 0,
  axes: EMPTY_AXES,
  buttons: EMPTY_BUTTONS,
  justPressed: EMPTY_BUTTONS,
  justReleased: EMPTY_BUTTONS,
  lastActiveAt: 0,
};

let state = EMPTY_STATE;
const listeners = new Set();
let rafId = 0;
let started = false;

function deadzone(value, threshold) {
  if (Math.abs(value) < threshold) return 0;
  const sign = Math.sign(value);
  return sign * ((Math.abs(value) - threshold) / (1 - threshold));
}

function triggerValue(button) {
  if (!button) return 0;
  return typeof button.value === "number" ? button.value : button.pressed ? 1 : 0;
}

function makeButtons(pad) {
  const buttons = pad.buttons ?? [];
  const raw = {
    a: Boolean(buttons[0]?.pressed),
    b: Boolean(buttons[1]?.pressed),
    x: Boolean(buttons[2]?.pressed),
    y: Boolean(buttons[3]?.pressed),
    lb: Boolean(buttons[4]?.pressed),
    rb: Boolean(buttons[5]?.pressed),
    lt: triggerValue(buttons[6]) > TRIGGER_DEADZONE,
    rt: triggerValue(buttons[7]) > TRIGGER_DEADZONE,
    back: Boolean(buttons[8]?.pressed),
    start: Boolean(buttons[9]?.pressed),
    ls: Boolean(buttons[10]?.pressed),
    rs: Boolean(buttons[11]?.pressed),
    dpadUp: Boolean(buttons[12]?.pressed),
    dpadDown: Boolean(buttons[13]?.pressed),
    dpadLeft: Boolean(buttons[14]?.pressed),
    dpadRight: Boolean(buttons[15]?.pressed),
  };

  const axes = {
    lx: deadzone(Number(pad.axes?.[0] ?? 0), AXIS_DEADZONE),
    ly: deadzone(Number(pad.axes?.[1] ?? 0), AXIS_DEADZONE),
    rx: deadzone(Number(pad.axes?.[2] ?? 0), AXIS_DEADZONE),
    ry: deadzone(Number(pad.axes?.[3] ?? 0), AXIS_DEADZONE),
    lt: deadzone(triggerValue(buttons[6]), TRIGGER_DEADZONE),
    rt: deadzone(triggerValue(buttons[7]), TRIGGER_DEADZONE),
  };

  const nav = {
    up: Boolean(buttons[12]?.pressed) || axes.ly < -STICK_NAV_THRESHOLD,
    down: Boolean(buttons[13]?.pressed) || axes.ly > STICK_NAV_THRESHOLD,
    left: Boolean(buttons[14]?.pressed) || axes.lx < -STICK_NAV_THRESHOLD,
    right: Boolean(buttons[15]?.pressed) || axes.lx > STICK_NAV_THRESHOLD,
  };

  return { ...raw, ...nav };
}

function buildSnapshot(pad, index) {
  if (!pad) {
    const next = {
      connected: false,
      index: -1,
      id: "",
      timestamp: performance.now(),
      axes: EMPTY_AXES,
      buttons: EMPTY_BUTTONS,
      justPressed: EMPTY_BUTTONS,
      justReleased: EMPTY_BUTTONS,
      lastActiveAt: state.lastActiveAt,
    };
    const pressed = state.buttons;
    next.justReleased = Object.fromEntries(Object.keys(EMPTY_BUTTONS).map((key) => [key, Boolean(pressed[key])]));
    return next;
  }

  const buttons = makeButtons(pad);
  const axes = {
    lx: deadzone(Number(pad.axes?.[0] ?? 0), AXIS_DEADZONE),
    ly: deadzone(Number(pad.axes?.[1] ?? 0), AXIS_DEADZONE),
    rx: deadzone(Number(pad.axes?.[2] ?? 0), AXIS_DEADZONE),
    ry: deadzone(Number(pad.axes?.[3] ?? 0), AXIS_DEADZONE),
    lt: deadzone(triggerValue(pad.buttons?.[6]), TRIGGER_DEADZONE),
    rt: deadzone(triggerValue(pad.buttons?.[7]), TRIGGER_DEADZONE),
  };

  const prevButtons = state.buttons ?? EMPTY_BUTTONS;
  const justPressed = {};
  const justReleased = {};
  for (const key of Object.keys(EMPTY_BUTTONS)) {
    justPressed[key] = Boolean(buttons[key]) && !Boolean(prevButtons[key]);
    justReleased[key] = !Boolean(buttons[key]) && Boolean(prevButtons[key]);
  }

  const active = Object.values(buttons).some(Boolean) || Object.values(axes).some((value) => Math.abs(value) > 0.05);

  return {
    connected: true,
    index,
    id: pad.id || "",
    timestamp: typeof pad.timestamp === "number" ? pad.timestamp : performance.now(),
    axes,
    buttons,
    justPressed,
    justReleased,
    lastActiveAt: active ? performance.now() : state.lastActiveAt,
  };
}

function emit(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

function pickPad(pads) {
  for (let i = 0; i < pads.length; i += 1) {
    if (pads[i]) return [pads[i], i];
  }
  return [null, -1];
}

function tick() {
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  const [pad, index] = pickPad(pads ?? []);
  emit(buildSnapshot(pad, index));
  rafId = window.requestAnimationFrame(tick);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  rafId = window.requestAnimationFrame(tick);
}

function stop() {
  if (!started || typeof window === "undefined") return;
  started = false;
  window.cancelAnimationFrame(rafId);
}

export function getGamepadState() {
  return state;
}

export function subscribeGamepad(listener) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function useGamepadRef() {
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
    return subscribeGamepad(() => {
      ref.current = state;
    });
  }, []);
  return ref;
}
