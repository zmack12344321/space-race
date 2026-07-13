import { useEcctrlTuningStore } from "./ecctrlTuningStore";

const sectionStyles = "bg-gray-100 text-black rounded-md shadow-md border border-black/10 backdrop-blur-sm";

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className={`${sectionStyles} flex flex-col gap-2 px-3 py-2`}>
      <div className="flex items-center justify-between gap-3 text-sm leading-none">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs opacity-70">{typeof value === "number" ? value.toFixed(step < 1 ? 2 : 0) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-black"
      />
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className={`${sectionStyles} p-3 space-y-3`}>
      <div className="text-lg font-semibold tracking-wide">{title}</div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ActionButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 bg-gray-100 text-black rounded-md shadow-md border border-black/10 font-semibold text-sm hover:bg-white active:scale-[0.99]"
    >
      {children}
    </button>
  );
}

export function EcctrlControlPanel() {
  const tuning = useEcctrlTuningStore((state) => state);
  const setTuning = useEcctrlTuningStore((state) => state.setTuning);

  const applyPreset = (preset) => {
    if (preset === "arcade") {
      setTuning({
        common: { speedMultiplier: 2.8, jumpVelocity: 11, cameraDistance: 3.5, cameraHeight: 0.6, cameraTurnSpeed: 5.5 },
        board: { speedMultiplier: 1.55, tireGripFactor: 2.5, dampingC: 7200, springK: 56000 },
        car: { engineHorsepower: 720, tireGripFactor: 1.55, dampingC: 4700, springK: 43000 },
        drone: { maxThrust: 5600, airDragFactor: 0.18, maxHorizSpeed: 22, maxVertSpeed: 9 },
      });
      return;
    }

    if (preset === "stable") {
      setTuning({
        common: { speedMultiplier: 1.8, jumpVelocity: 9, cameraDistance: 3, cameraHeight: 0.45, cameraTurnSpeed: 4.2 },
        board: { speedMultiplier: 1.2, tireGripFactor: 3.0, dampingC: 8500, springK: 62000 },
        car: { engineHorsepower: 560, tireGripFactor: 1.75, dampingC: 5800, springK: 50000 },
        drone: { maxThrust: 5000, airDragFactor: 0.22, maxHorizSpeed: 20, maxVertSpeed: 8 },
      });
      return;
    }

    if (preset === "fast") {
      setTuning({
        common: { speedMultiplier: 3.5, jumpVelocity: 12, cameraDistance: 4, cameraHeight: 0.65, cameraTurnSpeed: 6.5 },
        board: { speedMultiplier: 1.85, tireGripFactor: 2.15, dampingC: 6500, springK: 52000 },
        car: { engineHorsepower: 900, tireGripFactor: 1.4, dampingC: 4200, springK: 42000 },
        drone: { maxThrust: 6500, airDragFactor: 0.16, maxHorizSpeed: 26, maxVertSpeed: 10 },
      });
    }
  };

  return (
    <div className="fixed left-4 top-4 z-40 w-[260px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto pointer-events-auto">
      <div className="space-y-3 pr-1">
        <section className={`${sectionStyles} p-3 space-y-2`}>
          <div className="text-lg font-semibold tracking-wide">Feel</div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => applyPreset("stable")}>Stable</ActionButton>
            <ActionButton onClick={() => applyPreset("arcade")}>Arcade</ActionButton>
            <ActionButton onClick={() => applyPreset("fast")}>Fast</ActionButton>
          </div>
        </section>

        <Section title="Game Feel">
          <Slider label="Speed" value={tuning.common.speedMultiplier} min={0.5} max={5} step={0.01} onChange={(speedMultiplier) => setTuning({ common: { speedMultiplier } })} />
          <Slider label="Jump" value={tuning.common.jumpVelocity} min={3} max={20} step={0.01} onChange={(jumpVelocity) => setTuning({ common: { jumpVelocity } })} />
          <Slider label="Camera Dist" value={tuning.common.cameraDistance} min={2} max={8} step={0.01} onChange={(cameraDistance) => setTuning({ common: { cameraDistance } })} />
          <Slider label="Camera Smooth" value={tuning.common.cameraSmoothTime} min={0.02} max={0.4} step={0.01} onChange={(cameraSmoothTime) => setTuning({ common: { cameraSmoothTime } })} />
        </Section>

        <Section title="Board Feel">
          <Slider label="Board Speed" value={tuning.board.speedMultiplier} min={0.5} max={3} step={0.01} onChange={(speedMultiplier) => setTuning({ board: { speedMultiplier } })} />
          <Slider label="Board Grip" value={tuning.board.tireGripFactor} min={1} max={4} step={0.01} onChange={(tireGripFactor) => setTuning({ board: { tireGripFactor } })} />
          <Slider label="Board Stability" value={tuning.board.dampingC} min={3000} max={12000} step={50} onChange={(dampingC) => setTuning({ board: { dampingC } })} />
        </Section>

        <Section title="Drone Feel">
          <Slider label="Thrust" value={tuning.drone.maxThrust} min={3000} max={9000} step={10} onChange={(maxThrust) => setTuning({ drone: { maxThrust } })} />
          <Slider label="Drone Speed" value={tuning.drone.maxHorizSpeed} min={8} max={40} step={0.01} onChange={(maxHorizSpeed) => setTuning({ drone: { maxHorizSpeed } })} />
        </Section>
      </div>
    </div>
  );
}
