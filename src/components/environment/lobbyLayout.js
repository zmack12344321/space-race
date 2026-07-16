const LOBBY_SLOT_POSITIONS = [
  [0, 0, 0],
  [4.6, 0, 0],
  [-4.6, 0, 0],
  [9.2, 0, 0],
  [-9.2, 0, 0],
  [3.5, 0, 3.0],
  [-3.5, 0, 3.0],
  [11.5, 0, 0],
  [-11.5, 0, 0],
];

export function getLobbySlotPosition(index) {
  if (index < LOBBY_SLOT_POSITIONS.length) {
    return LOBBY_SLOT_POSITIONS[index];
  }

  const ring = Math.floor((index - LOBBY_SLOT_POSITIONS.length) / 2) + 2;
  const side = index % 2 === 0 ? 1 : -1;
  return [side * ring * 4.0, 0, Math.min(4.5, ring * 1.5)];
}

export function sortLobbyPlayers(players, meId) {
  return [...players].sort((a, b) => {
    if (a.id === meId) return -1;
    if (b.id === meId) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function getLobbyCameraLookAt(playerCount) {
  const count = Math.max(1, playerCount);
  const zoom = Math.min(1.45, 1 + (count - 1) * 0.18);
  return {
    position: [7.4 * zoom, 3.1 * zoom, 12.2 * zoom],
    target: [0, 0.75, 0],
  };
}
