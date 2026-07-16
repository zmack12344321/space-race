import { useHeatStore } from "../vehicles/heatStore";

// Vertical overheat meter, intended to flank the vehicle switcher (bottom-center).
export function HeatMeter() {
  const { heat, overheated } = useHeatStore();
  const pct = Math.round(Math.min(1, Math.max(0, heat)) * 100);
  return (
    <div className="fixed bottom-4 left-1/2 z-30 pointer-events-none select-none translate-x-[180px]">
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="h-[120px] w-3 overflow-hidden rounded-full border border-white/10 bg-white/10 flex flex-col-reverse"
          title={overheated ? "Overheated" : "Cannon"}
        >
          <div
            className={`w-full rounded-full transition-[height] duration-75 ${
              overheated
                ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                : pct > 70
                ? "bg-orange-400"
                : "bg-rose-400/70"
            }`}
            style={{ height: `${pct}%` }}
          />
        </div>
        <div
          className={`text-[10px] font-bold uppercase tracking-[0.2em] [writing-mode:vertical-rl] ${
            overheated ? "text-red-400" : "text-white/60"
          }`}
        >
          {overheated ? "Hot" : "Gun"}
        </div>
      </div>
    </div>
  );
}
