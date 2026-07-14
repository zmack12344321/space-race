export default class Server {
  constructor(room) {
    this.room = room;
    this.players = new Map();
    this.roomState = { gameState: "title" };
    this.hostId = null;
  }

  onConnect(connection) {
    connection.send(
      JSON.stringify({
        type: "snapshot",
        players: Array.from(this.players.values()),
        roomState: this.roomState,
        hostId: this.hostId,
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
      const player = {
        id: event.id,
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
      this.broadcast({ type: "playerJoined", player, hostId: this.hostId });
      return;
    }

    if (event.type === "playerState") {
      const player = this.players.get(event.id);
      if (!player) return;
      player.state[event.key] = event.value;
      this.broadcast({
        type: "playerState",
        id: event.id,
        key: event.key,
        value: event.value,
      });
      return;
    }

    if (event.type === "roomState") {
      this.roomState[event.key] = event.value;
      this.broadcast({
        type: "roomState",
        key: event.key,
        value: event.value,
      });
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
    if (!playerId || !this.players.has(playerId)) return;
    this.players.delete(playerId);
    if (this.hostId === playerId) {
      this.hostId = this.players.keys().next().value || null;
    }
    this.broadcast({ type: "playerLeft", id: playerId, hostId: this.hostId });
  }

  broadcast(event) {
    this.room.broadcast(JSON.stringify(event));
  }
}
