import { useHeatStore } from "../vehicles/heatStore";

// Vertical overheat meter pinned to the RIGHT edge of the screen.
export function HeatMeter() {
  const { heat, overheated } = useHeatStore();
  const pct = Math.round(Math.min(1, Math.max(0, heat)) * 100);
  const fill = overheated
    ? "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.9)]"
    : pct > 70
    ? "bg-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.7)]"
    : "bg-rose-400/70";
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none select-none">
      <div className="flex flex-col items-center gap-2">
        <div
          className={`text-[10px] font-black uppercase tracking-[0.3em] [writing-mode:vertical-rl] rotate-180 ${
            overheated ? "text-red-400" : "text-white/80"
          }`}
        >
          Cannon
        </div>
        <div className="relative h-[160px] w-4 overflow-hidden rounded-full border border-white/20 bg-slate-950/70 backdrop-blur-sm shadow-inner">
          <div
            className={`absolute bottom-0 left-0 w-full rounded-full transition-[height] duration-75 ease-out ${fill}`}
            style={{ height: `${pct}%` }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-white/30 to-transparent" />
          </div>
          {overheated && (
            <div className="absolute inset-0 animate-pulse rounded-full border-2 border-red-500/80" />
          )}
        </div>
        <div
          className={`text-[10px] font-black uppercase tracking-[0.2em] ${
            overheated ? "text-red-400" : pct > 70 ? "text-orange-300" : "text-white/50"
          }`}
        >
          {overheated ? "Hot" : `${pct}%`}
        </div>
      </div>
    </div>
  );
}
