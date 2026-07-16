import { useHealthStore } from "../vehicles/healthStore";

// Top-center health bar for the LOCAL player. Updates the instant applyDamage
// runs on this client, so it's the fastest possible signal of hit registration
// (independent of any network round-trip to the shooter).
export function HealthBar() {
  const health = useHealthStore((s) => s.health);
  const max = useHealthStore((s) => s.maxHealth);
  const pct = Math.max(0, Math.min(100, (health / max) * 100));
  const low = pct <= 30;
  const mid = pct > 30 && pct <= 60;
  const color = low ? "bg-red-500" : mid ? "bg-yellow-400" : "bg-emerald-400";
  const glow = low
    ? "shadow-[0_0_18px_rgba(239,68,68,0.9)]"
    : mid
    ? "shadow-[0_0_14px_rgba(250,204,21,0.7)]"
    : "shadow-[0_0_14px_rgba(52,211,153,0.6)]";
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none select-none w-[min(72vw,460px)]">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.35em] text-white/80">
          <span className={low ? "text-red-400" : "text-white/60"}>Hull</span>
          <span className={low ? "text-red-300" : "text-cyan-200"}>{Math.round(health)}</span>
          <span className="text-white/40">/ {Math.round(max)}</span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full border border-white/20 bg-slate-950/70 backdrop-blur-sm shadow-inner">
          <div
            className={`relative h-full rounded-full transition-[width] duration-150 ease-out ${color} ${glow}`}
            style={{ width: `${pct}%` }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/40 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
