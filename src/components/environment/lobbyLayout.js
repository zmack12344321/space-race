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

// Spacing between adjacent riders. Kept tight enough that the camera (which
// zooms out with player count) always frames the whole group, but loose enough
// that riders never overlap their ~1.2-unit avatars + floor rings.
const SLOT_SPACING = 4.0;

export function getLobbySlotPosition(index) {
  if (index < LOBBY_SLOT_POSITIONS.length) {
    return LOBBY_SLOT_POSITIONS[index];
  }

  // Lay out overflow players in concentric square rings so the group stays
  // compact instead of stretching into an infinitely long line. Each ring grows
  // by one slot per side, giving a tidy grid that scales to any player count.
  let remaining = index - LOBBY_SLOT_POSITIONS.length;
  let ring = 2;
  while (remaining >= ring * 8) {
    remaining -= ring * 8;
    ring += 1;
  }

  const sideLen = ring * SLOT_SPACING;
  const perSide = ring * 2; // slots along one edge of this ring
  const step = SLOT_SPACING;
  const side = Math.floor(remaining / perSide);
  const t = remaining % perSide;
  // Center the slots along each edge.
  const coord = t * step - sideLen + step;

  switch (side) {
    case 0:
      return [coord, 0, -sideLen];
    case 1:
      return [sideLen, 0, coord];
    case 2:
      return [-coord, 0, sideLen];
    default:
      return [-sideLen, 0, -coord];
  }
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
  // Pull the camera back in proportion to how far the outermost rider sits from
  // the centre, so the whole group (and the leader's crown) stays framed even
  // with many players.
  const lastSlot = getLobbySlotPosition(Math.max(0, count - 1));
  const maxRadius = Math.max(6, Math.hypot(lastSlot[0], lastSlot[2]));
  const zoom = Math.max(1, maxRadius / 6);
  return {
    position: [7.4 * zoom, 3.1 * zoom, 12.2 * zoom],
    target: [0, 0.75, 0],
  };
}
