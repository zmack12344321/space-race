function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 2147483647;
}

const HOST_GRACE_MS = 3000;

export default class Server {
  constructor(room) {
    this.room = room;
    this.players = new Map();
    this.roomState = { gameState: "title" };
    this.hostId = null;
    this.seed = hashSeed(room?.id || "space-race");
    this._loaded = false;
    this._hostGrace = null;
  }

  async _ensureLoaded() {
    if (this._loaded) return;
    this._loaded = true;
    try {
      const stored = await this.room.storage.get("state");
      if (stored) {
        this.players = new Map(stored.players ?? []);
        this.roomState = { ...this.roomState, ...(stored.roomState ?? {}) };
        this.hostId = stored.hostId ?? null;
        if (stored.seed != null) this.seed = stored.seed;
      }
    } catch {
      // Storage unavailable (e.g. legacy runtime); rely on in-memory defaults.
    }
  }

  async _persist() {
    try {
      await this.room.storage.put("state", {
        players: Array.from(this.players.entries()),
        roomState: this.roomState,
        hostId: this.hostId,
        seed: this.seed,
      });
    } catch {
      // Ignore storage failures.
    }
  }

  onConnect(connection) {
    this._ensureLoaded();
    connection.send(
      JSON.stringify({
        type: "snapshot",
        players: Array.from(this.players.values()),
        roomState: this.roomState,
        hostId: this.hostId,
        seed: this.seed,
      })
    );
  }

  onMessage(message, connection) {
    let event;
    try {
      event = JSON.parse(message);
    } catch {
      return;
    }

    if (event.type === "join") {
      const existing = this.players.get(event.id);
      if (existing && existing.disconnected) {
        clearTimeout(this._hostGrace);
        existing.disconnected = false;
        existing.state = {
          ...existing.state,
          name: event.name || existing.state.name,
          vehicle: event.vehicle || existing.state.vehicle,
          pos: event.pos || existing.state.pos,
          rot: event.rot || existing.state.rot,
        };
        connection.setState({ playerId: event.id });
        this.broadcast({ type: "playerJoined", player: existing, hostId: this.hostId, seed: this.seed });
        this._persist();
        return;
      }

      const slot = this.players.size;
      const player = {
        id: event.id,
        slot,
        disconnected: false,
        state: {
          profile: { name: event.name || "Rider" },
          name: event.name || "Rider",
          vehicle: event.vehicle || "longboard",
          pos: { x: 0, y: 2, z: 0 },
          rot: { x: 0, y: 0, z: 0, w: 1 },
        },
      };
      this.players.set(event.id, player);
      connection.setState({ playerId: event.id });
      if (!this.hostId) this.hostId = event.id;
      this.broadcast({ type: "playerJoined", player, hostId: this.hostId, seed: this.seed });
      this._persist();
      return;
    }

    if (event.type === "playerState") {
      const player = this.players.get(event.id);
      if (!player) return;
      player.state[event.key] = event.value;
      this.broadcast({ type: "playerState", id: event.id, key: event.key, value: event.value });
      return;
    }

    if (event.type === "roomState") {
      this.roomState[event.key] = event.value;
      if (event.key === "lunarSeed") this.seed = event.value;
      this.broadcast({ type: "roomState", key: event.key, value: event.value });
      this._persist();
    }

    if (event.type === "laser") {
      // Fire-and-forget visual: relay to everyone (owner already has it).
      this.broadcast({
        type: "laser",
        ownerId: event.ownerId,
        pos: event.pos,
        dir: event.dir,
        ttl: event.ttl,
        speed: event.speed,
      });
      return;
    }

    if (event.type === "damage") {
      // Relay hit so the target client applies knockback/stun/respawn.
      this.broadcast({
        type: "damage",
        targetId: event.targetId,
        amount: event.amount,
        sourceId: event.sourceId,
        knockDir: event.knockDir,
      });
      return;
    }

    if (event.type === "beam") {
      // Relay sustained beam state (start/stop/refresh) to all clients.
      this.broadcast({
        type: "beam",
        ownerId: event.ownerId,
        pos: event.pos,
        dir: event.dir,
        beamLength: event.beamLength,
        active: event.active,
      });
      return;
    }
  }

  onClose(connection) {
    this.removeConnection(connection);
  }

  onError(connection) {
    this.removeConnection(connection);
  }

  removeConnection(connection) {
    const playerId = connection.state?.playerId;
    const player = playerId ? this.players.get(playerId) : null;
    if (!player) return;

    const wasHost = this.hostId === playerId;

    if (wasHost) {
      player.disconnected = true;
      clearTimeout(this._hostGrace);
      this._hostGrace = setTimeout(() => {
        const current = this.players.get(playerId);
        if (current && current.disconnected) {
          this.players.delete(playerId);
          this.hostId = this.players.size ? this.players.keys().next().value : null;
          if (this.players.size === 0) {
            this.roomState = { gameState: "title" };
            this.hostId = null;
          }
          this.broadcast({ type: "playerLeft", id: playerId, hostId: this.hostId });
          this._persist();
        }
      }, HOST_GRACE_MS);
      return;
    }

    this.players.delete(playerId);
    this.broadcast({ type: "playerLeft", id: playerId, hostId: this.hostId });
    this._persist();
  }

  broadcast(event) {
    this.room.broadcast(JSON.stringify(event));
  }
}
