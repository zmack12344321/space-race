import { useEffect, useState } from "react";
import { netDebug, getPeerDebug } from "../../multiplayer/party";

// Lightweight netcode instrumentation overlay for the /test arena. Shows real
// numbers instead of guessing where the delay lives:
//   RTT       - send→receive round trip (should be ~0 on localhost)
//   send Hz   - how often WE broadcast our transform
//   recv Hz   - how often the OTHER player's updates arrive
//   age       - ms since we last heard from the other player (network staleness)
//   renderLag - ms the remote avatar is drawn behind its latest known position
export function NetDebugOverlay() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const peerIds = Object.keys(netDebug.peers);
  const peer = peerIds.length ? getPeerDebug(peerIds[0]) : null;

  // Derive local send rate from the timestamp history.
  const sends = netDebug._sendTimes || [];
  let sendHz = 0;
  if (sends.length >= 2) {
    const span = sends[sends.length - 1] - sends[0];
    if (span > 0) sendHz = ((sends.length - 1) / span) * 1000;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 9999,
        fontFamily: "monospace",
        fontSize: 12,
        color: "#9effa0",
        background: "rgba(0,0,0,0.6)",
        padding: "8px 10px",
        borderRadius: 6,
        lineHeight: 1.5,
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {`NETCODE DEBUG (localhost)
RTT:        ${netDebug.rttMs.toFixed(1)} ms
send Hz:     ${sendHz.toFixed(0)}
recv Hz:     ${peer ? peer.recvHz.toFixed(0) : "-"}
peer age:   ${peer ? peer.ageMs.toFixed(0) : "-"} ms
render lag: ${netDebug.renderLagMs.toFixed(0)} ms`}
    </div>
  );
}
