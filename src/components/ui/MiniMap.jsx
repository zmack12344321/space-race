import { useEffect, useRef } from "react";
import {
  myPlayer,
  usePlayersList,
  getLatestTransform,
} from "../../multiplayer/party";
import { useRaceCourseStore } from "../environment/raceCourseStore";

const SIZE = 184;
const VIEW_RADIUS = 120;

function yawFromQuat(rot) {
  if (!rot) return 0;
  const { x, y, z, w } = rot;
  // Heading around world Y from quaternion.
  const siny = 2 * (w * y + x * z);
  const cosy = 1 - 2 * (y * y + x * x);
  return Math.atan2(siny, cosy);
}

export const MiniMap = () => {
  const canvasRef = useRef(null);
  const players = usePlayersList(true);
  const me = myPlayer();
  const raceMarkers = useRaceCourseStore((state) => state.markers);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;

    const draw = () => {
      const local = me ? getLatestTransform(me.id) : null;
      const localYaw = local ? yawFromQuat(local.rot) : 0;
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      const scale = SIZE / 2 / VIEW_RADIUS;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Panel background.
      ctx.fillStyle = "rgba(6,10,18,0.55)";
      ctx.beginPath();
      ctx.roundRect(0, 0, SIZE, SIZE, 18);
      ctx.fill();

      // Grid.
      ctx.strokeStyle = "rgba(120,200,255,0.10)";
      ctx.lineWidth = 1;
      const gridStep = 30;
      for (let g = -VIEW_RADIUS; g <= VIEW_RADIUS; g += gridStep) {
        const p = g * scale;
        ctx.beginPath();
        ctx.moveTo(0, cy + p);
        ctx.lineTo(SIZE, cy + p);
        ctx.moveTo(cx + p, 0);
        ctx.lineTo(cx + p, SIZE);
        ctx.stroke();
      }

      // View ring.
      ctx.strokeStyle = "rgba(120,200,255,0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, VIEW_RADIUS * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Players. Local is origin (center).
      const localPos = local ? local.pos : { x: 0, y: 0, z: 0 };
      const forwardX = Math.sin(localYaw);
      const forwardZ = Math.cos(localYaw);
      const rightX = forwardZ;
      const rightZ = -forwardX;

      for (const p of players) {
        if (!p?.id) continue;
        const t = getLatestTransform(p.id);
        if (!t || !t.pos) continue;
        const dx = t.pos.x - localPos.x;
        const dz = t.pos.z - localPos.z;
        let mx = -(dx * rightX + dz * rightZ) * scale;
        let my = -(dx * forwardX + dz * forwardZ) * scale;
        const dist = Math.hypot(mx, my);
        const maxR = SIZE / 2 - 8;
        if (dist > maxR) {
          mx = (mx / dist) * maxR;
          my = (my / dist) * maxR;
        }
        const isSelf = me && p.id === me.id;

        if (isSelf) {
          // Self marker. Map already player-up, so marker stays simple.
          ctx.save();
          ctx.translate(cx + mx, cy + my);
          ctx.fillStyle = "#67e8f9";
          ctx.shadowColor = "#67e8f9";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(5, 5);
          ctx.lineTo(-5, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const fade = Math.max(0.35, 1 - dist / (SIZE / 2 - 8));
          ctx.fillStyle = `rgba(251,146,60,${fade})`;
          ctx.shadowColor = "rgba(251,146,60,0.8)";
          ctx.shadowBlur = 8;
          ctx.fillRect(cx + mx - 3, cy + my - 3, 6, 6);
        }
        ctx.shadowBlur = 0;
      }

      // Race gates.
      const activeGates = raceMarkers.filter((gate) => gate.active);
      if (activeGates.length > 0) {
        for (const gate of activeGates) {
          const dx = gate.x - localPos.x;
          const dz = gate.z - localPos.z;
          let mx = -(dx * rightX + dz * rightZ) * scale;
          let my = -(dx * forwardX + dz * forwardZ) * scale;
          const dist = Math.hypot(mx, my);
          const maxR = SIZE / 2 - 10;
          if (dist > maxR) {
            mx = (mx / dist) * maxR;
            my = (my / dist) * maxR;
          }

          ctx.save();
          ctx.translate(cx + mx, cy + my);
          ctx.rotate(gate.active ? 0 : 0.3);
          ctx.strokeStyle = gate.passed ? "rgba(52,211,153,0.95)" : "rgba(103,232,249,0.95)";
          ctx.fillStyle = gate.passed ? "rgba(52,211,153,0.25)" : "rgba(103,232,249,0.2)";
          ctx.lineWidth = gate.active ? 2 : 1.4;
          ctx.shadowColor = gate.passed ? "rgba(52,211,153,0.75)" : "rgba(103,232,249,0.75)";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fill();
          ctx.restore();
        }
      }

      // Vignette ring (radar sweep feel).
      const grad = ctx.createRadialGradient(cx, cy, SIZE / 2 - 40, cx, cy, SIZE / 2);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(0, 0, SIZE, SIZE, 18);
      ctx.fill();

      // Border.
      ctx.strokeStyle = "rgba(120,200,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(1, 1, SIZE - 2, SIZE - 2, 18);
      ctx.stroke();

      // Fixed "N" marker (top, since player-up rotates world).
      ctx.fillStyle = "rgba(186,230,253,0.7)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("N", cx, 14);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [players, me, raceMarkers]);

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none select-none">
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE }}
        className="rounded-[18px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-cyan-300/20 backdrop-blur-sm"
      />
    </div>
  );
};
