import { useHeatStore } from "../vehicles/heatStore";

export function HeatMeter() {
  const { heat, overheated } = useHeatStore();
  const pct = Math.round(Math.min(1, Math.max(0, heat)) * 100);
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
      <div className="flex flex-col items-center gap-1.5">
        <div className={`text-[11px] font-bold uppercase tracking-[0.28em] ${overheated ? "text-red-400" : "text-white/60"}`}>
          {overheated ? "Overheated" : "Cannon"}
        </div>
        <div className="h-2.5 w-[min(60vw,260px)] overflow-hidden rounded-full border border-white/10 bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-75 ${
              overheated
                ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                : pct > 70
                ? "bg-orange-400"
                : "bg-rose-400/70"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
