import { useSyncExternalStore } from "react";

let state = { value: 1, active: false, locked: false };
const listeners = new Set();

function emit(next) {
  if (next.value === state.value && next.active === state.active && next.locked === state.locked) return;
  state = next;
  listeners.forEach((l) => l());
}

export function setBoost(value, active, locked = false) {
  emit({ value: Math.round(value * 100) / 100, active, locked });
}

export function getBoost() {
  return state;
}

export function subscribeBoost(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBoost() {
  return useSyncExternalStore(subscribeBoost, getBoost);
}
