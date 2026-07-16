import { useBoost } from "./boostStore";

// Vertical boost meter pinned to the LEFT edge of the screen.
export function BoostMeter() {
  const { value, active, locked } = useBoost();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const fill = locked
    ? "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.9)]"
    : active
    ? "bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.85)]"
    : "bg-cyan-400/70";
  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none select-none">
      <div className="flex flex-col items-center gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-200/80 [writing-mode:vertical-rl] rotate-180">
          Boost
        </div>
        <div className="relative h-[160px] w-4 overflow-hidden rounded-full border border-white/20 bg-slate-950/70 backdrop-blur-sm shadow-inner">
          <div
            className={`absolute bottom-0 left-0 w-full rounded-full transition-[height] duration-75 ease-out ${fill}`}
            style={{ height: `${pct}%` }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-white/30 to-transparent" />
          </div>
          {pct < 100 && (
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/5 to-transparent" />
          )}
        </div>
        <div
          className={`text-[10px] font-black uppercase tracking-[0.2em] ${
            locked ? "text-red-400" : active ? "text-cyan-200" : "text-white/50"
          }`}
        >
          {locked ? "Empty" : `${pct}%`}
        </div>
      </div>
    </div>
  );
}
