import { useEffect, useState } from "react";
import { netDebug, getPeerDebug, getInterpDelayMs } from "../../multiplayer/party";
import { getGamepadState } from "./gamepadStore";
import { debugMetrics } from "./debugMetrics";

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
    const id = setInterval(() => force((n) => n + 1), 100);
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

  const pad = getGamepadState();
  const pressed = [
    ["a", "A"],
    ["b", "B"],
    ["x", "X"],
    ["y", "Y"],
    ["lb", "LB"],
    ["rb", "RB"],
    ["back", "Back"],
    ["start", "Start"],
    ["ls", "L3"],
    ["rs", "R3"],
    ["lt", "LT"],
    ["rt", "RT"],
    ["dpadUp", "DPad Up"],
    ["dpadDown", "DPad Down"],
    ["dpadLeft", "DPad Left"],
    ["dpadRight", "DPad Right"],
  ].filter(([key]) => pad.buttons?.[key]);
  const buttonText = pressed.length ? pressed.map(([, label]) => label).join(" + ") : "-";
  const frameTimeMs = debugMetrics.frameMs || 0;
  const fps = debugMetrics.fps || 0;

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
      {`DEBUG HUD (backtick to hide)
input:      ${buttonText}
sticks:     lx ${pad.axes?.lx?.toFixed?.(2) ?? "0.00"}  ly ${pad.axes?.ly?.toFixed?.(2) ?? "0.00"}
            rx ${pad.axes?.rx?.toFixed?.(2) ?? "0.00"}  ry ${pad.axes?.ry?.toFixed?.(2) ?? "0.00"}
FPS:        ${fps.toFixed(0)}
frame:      ${frameTimeMs.toFixed(1)} ms
draw calls: ${debugMetrics.drawCalls}
tris:       ${debugMetrics.triangles}
lines:      ${debugMetrics.lines}
points:     ${debugMetrics.points}
geom/tex:   ${debugMetrics.geometries} / ${debugMetrics.textures}
RTT:        ${netDebug.rttMs.toFixed(1)} ms
send Hz:    ${sendHz.toFixed(0)}
recv Hz:    ${peer ? peer.recvHz.toFixed(0) : "-"}
peer age:   ${peer ? peer.ageMs.toFixed(0) : "-"} ms
interp:     ${getInterpDelayMs().toFixed(0)} ms
render lag: ${netDebug.renderLagMs.toFixed(0)} ms`}
    </div>
  );
}
