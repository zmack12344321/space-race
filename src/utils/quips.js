// Rotating self-aware "quips" shown on each screen. Picked at random
// every time a screen mounts, so each play session feels a little different.

const pick = (arr, last) => {
  if (arr.length === 1) return arr[0];
  let next = arr[Math.floor(Math.random() * arr.length)];
  while (next === last) next = arr[Math.floor(Math.random() * arr.length)];
  return next;
};

export const TITLE_QUIPS = [
  "We put a dog on a hoverboard. Don't ask.",
  "Moon. Boards. Questionable life choices.",
  "Less NASA, more chaos.",
  "Brought to you by poor decisions.",
  "Technically a sport.",
  "Last place still counts as racing.",
  "A dog, a laser, and zero impulse control.",
  "The moon needed a worse idea.",
  "Powered entirely by bad judgment.",
  "Honestly the dog is in charge.",
];

export const LOADING_QUIPS = [
  "Try not to crash.",
  "Good luck, honestly.",
  "This'll be fine.",
  "Summoning the dog...",
  "Charging lasers. And snacks.",
  "Brace for mild gravity.",
  "Don't blame the board.",
  "Warming up the moon.",
  "Recalculating poor choices.",
  "Hold on. Or don't. We're not your mom.",
];

export const PAUSE_QUIPS = [
  "Catching your breath?",
  "Or just quit, we get it.",
  "The dog misses you already.",
  "Touch grass. Lunar grass.",
  "Regretting the dog decision?",
];

export const PLAY_QUIPS = [
  "Play",
  "Do it",
  "Yeah sure",
  "Go on",
  "Get in",
  "Launch",
  "Why not",
  "C'mon",
];

export const NAME_QUIPS = [
  "No, not \"Player1\"",
  "What's ya tag?",
  "Make it iconic.",
  "Hope it's not \"xXx\".",
  "A legend starts here.",
  "Tag yourself, nerd.",
  "Own it, dog.",
  "Be someone, maybe.",
];

export const RESPAWN_QUIPS = [
  "Again?",
  "Re-dog.",
  "Bounce.",
  "Up you go.",
  "Whoops.",
  "Respawn.",
  "Here we go.",
  "Bruh",
  "Run it back",
  "Aww shit, here we go again",
  "Crank it",
  "Yikes.",
  "Not again.",
  "Round 2.",
  "Lmao, again",
];

export const START_QUIPS = [
  "Start",
  "Run it",
  "Get it",
  "Crank it",
  "Let's go",
  "Ready",
  "Do it",
  "Send it",
  "Go off",
  "Lock in",
];

export const makeQuipPicker = (arr) => {
  let last = null;
  return () => {
    last = pick(arr, last);
    return last;
  };
};
