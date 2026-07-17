import { useEffect, useState } from "react";
import { netDebug, getPeerDebug, getInterpDelayMs, myPlayer, usePlayerState } from "../../multiplayer/party";

// Lightweight netcode instrumentation overlay. Toggle anywhere with backtick (`).
// Shows real numbers instead of guessing where the delay lives:
//   RTT        - send→receive round trip (should be ~0 on localhost)
//   send Hz    - how often WE broadcast our transform
//   recv Hz    - how often the OTHER player's updates arrive
//   peer age   - ms since we last heard from the other player (network staleness)
//   interp     - ms we render in the past (snapshot buffer delay)
//   render lag - ms the remote avatar trails its newest known sample
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

  // D-pad zoom diagnostic — confirms whether D-pad input reaches the zoom code
  // and whether dolly() actually moves the camera distance.
  const me = myPlayer();
  const cam = me ? usePlayerState(me, "_debug") : null;

  // RAW gamepad dump — shows exactly which button/axis index lights up when
  // you press the D-pad, so we can map it correctly for your controller.
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find((p) => p);
  const rawBtns = pad ? pad.buttons.map((b, i) => (b.pressed ? i : null)).filter((v) => v !== null) : [];
  const rawAxes = pad
    ? pad.axes.map((v, i) => (Math.abs(v) > 0.05 ? `${i}:${Number(v).toFixed(2)}` : null)).filter(Boolean).join(" ")
    : "";

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
      {`NETCODE DEBUG (backtick to hide)
RTT:        ${netDebug.rttMs.toFixed(1)} ms
send Hz:     ${sendHz.toFixed(0)}
recv Hz:     ${peer ? peer.recvHz.toFixed(0) : "-"}
peer age:   ${peer ? peer.ageMs.toFixed(0) : "-"} ms
interp:     ${getInterpDelayMs().toFixed(0)} ms
render lag: ${netDebug.renderLagMs.toFixed(0)} ms

D-PAD ZOOM
dpadUp:     ${cam?.dpadUp ? "YES" : "no"}
dpadDown:   ${cam?.dpadDown ? "YES" : "no"}
 camDist:    ${cam?.camDist != null ? cam.camDist : "-"}
camMin:     ${cam?.camMin != null ? cam.camMin : "-"}
camMax:     ${cam?.camMax != null ? cam.camMax : "-"}
raw btns:   [${rawBtns.join(",")}]
raw axes:   ${rawAxes || "none"}`}
    </div>
  );
}
