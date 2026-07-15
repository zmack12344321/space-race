import { useBoost } from "./boostStore";

export function BoostMeter() {
  const { value, active, locked } = useBoost();
  const pct = Math.round(value * 100);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
      <div className="flex flex-col items-center gap-1.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/60">Boost</div>
        <div className="h-2.5 w-[min(60vw,260px)] overflow-hidden rounded-full border border-white/10 bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-75 ${
              active ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.7)]" : locked ? "bg-red-400/70" : "bg-cyan-300/50"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
