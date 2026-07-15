import { routePartykitRequest, Server } from "partyserver";

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 2147483647;
}

const HOST_GRACE_MS = 3000;

export class SpaceRaceServer extends Server {
  players = new Map();
  roomState = { gameState: "title" };
  hostId = null;
  seed = null;
  _loaded = false;
  _hostGrace = null;

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
    if (this.seed == null) this.seed = hashSeed(this.room.id || "space-race");
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

  async onConnect(connection) {
    await this._ensureLoaded();
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

  async onMessage(connection, message) {
    if (typeof message !== "string") return;
    await this._ensureLoaded();

    try {
      const event = JSON.parse(message);

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
          this.broadcastJson({ type: "playerJoined", player: existing, hostId: this.hostId, seed: this.seed });
          await this._persist();
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
            pos: event.pos || { x: 0, y: 2, z: 0 },
            rot: event.rot || { x: 0, y: 0, z: 0, w: 1 },
          },
        };
        this.players.set(event.id, player);
        connection.setState({ playerId: event.id });
        if (!this.hostId) this.hostId = event.id;
        this.broadcastJson({ type: "playerJoined", player, hostId: this.hostId, seed: this.seed });
        await this._persist();
        return;
      }

      if (event.type === "playerState") {
        const player = this.players.get(event.id);
        if (!player) return;
        player.state[event.key] = event.value;
        this.broadcastJson({
          type: "playerState",
          id: event.id,
          key: event.key,
          value: event.value,
        });
        return;
      }

      if (event.type === "roomState") {
        this.roomState[event.key] = event.value;
        if (event.key === "lunarSeed") this.seed = event.value;
        this.broadcastJson({
          type: "roomState",
          key: event.key,
          value: event.value,
        });
        await this._persist();
      }
    } catch {
      // Ignore invalid JSON messages
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
      // Tolerate brief reconnects: keep host sticky for a short grace period
      // so a transient socket blip doesn't flip host and reset the session.
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
          this.broadcastJson({ type: "playerLeft", id: playerId, hostId: this.hostId });
          this._persist();
        }
      }, HOST_GRACE_MS);
      return;
    }

    this.players.delete(playerId);
    this.broadcastJson({ type: "playerLeft", id: playerId, hostId: this.hostId });
    this._persist();
  }

  broadcastJson(event) {
    this.broadcast(JSON.stringify(event));
  }
}

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Space Race multiplayer server", { status: 200 })
    );
  },
};
