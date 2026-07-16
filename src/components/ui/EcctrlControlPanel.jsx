import { useEffect, useMemo, useRef, useState } from "react";
import { getEcctrlTuningPreset, useEcctrlTuningStore } from "../vehicles/ecctrlTuningStore";
import { useMultiplayerState } from "../../multiplayer/party";
import { useGamepadRef } from "./gamepadStore";

const panelShell =
  "controls-font w-[min(94vw,820px)] max-h-[min(88vh,660px)] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/92 p-7 text-white shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-xl flex pointer-events-auto";

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-[18px] text-white">
        <span className="font-black uppercase tracking-[0.14em]">{label}</span>
        <span className="font-mono text-white/80">
          {typeof value === "number" ? value.toFixed(step < 1 ? 2 : 0) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="game-slider w-full cursor-pointer"
      />
    </label>
  );
}

function Section({ title, eyebrow, children }) {
  return (
    <section className="rounded-[1.5rem] border border-cyan-300/30 bg-white/[0.04] px-5 py-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          {eyebrow && <div className="text-[14px] font-bold uppercase tracking-[0.18em] text-cyan-300/90">{eyebrow}</div>}
          <div className="mt-1 text-[34px] leading-none font-black tracking-[-0.04em] text-white">{title}</div>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ActionButton({ children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ui-button rounded-full border border-white/10 bg-white/8 px-6 py-4 text-[18px] font-black uppercase tracking-[0.14em] text-white ${className}`}
    >
      {children}
    </button>
  );
}

export function EcctrlTuningPanel({ open, onClose, vehicleModel, loading = false }) {
  const [tab, setTab] = useState("scene");
  const panelRef = useRef(null);
  const gamepadRef = useGamepadRef();
  const tuning = useEcctrlTuningStore((state) => state);
  const setTuning = useEcctrlTuningStore((state) => state.setTuning);
  const [sunAngle, setSunAngle] = useMultiplayerState("sunAngle", 0.3);

  const tabs = useMemo(
    () => [
      ["scene", "Scene"],
      ["core", "Core"],
      ["ride", "Ride"],
      ["air", "Air"],
    ],
    []
  );

  const applyPreset = (preset) => {
    if (preset === "car" || preset === "drone") {
      setTuning(getEcctrlTuningPreset(preset));
      return;
    }
    if (preset === "arcade") {
      setTuning({
        common: { speedMultiplier: 2.8, boostMultiplier: 1.55, jumpVelocity: 11, cameraDistance: 3.5, cameraHeight: 0.6, cameraTurnSpeed: 5.5 },
        board: { speedMultiplier: 1.35, tireGripFactor: 3, dampingC: 7000, springK: 42000, rearDriveTorqueWeight: 1.4, finalDriveRatio: 1.75, steerRate: Math.PI * 3, maxSteerAngle: Math.PI / 8 },
        car: { engineHorsepower: 900, tireGripFactor: 3, dampingC: 7000, springK: 42000, rearDriveTorqueWeight: 1.4, finalDriveRatio: 1.75, steerRate: Math.PI * 3, maxSteerAngle: Math.PI / 8 },
        drone: { maxThrust: 5600, airDragFactor: 0.18, maxHorizSpeed: 22, maxVertSpeed: 9 },
      });
      return;
    }
    if (preset === "stable") {
      setTuning({
        common: { speedMultiplier: 1.8, boostMultiplier: 1.2, jumpVelocity: 9, cameraDistance: 3, cameraHeight: 0.45, cameraTurnSpeed: 4.2 },
        board: { speedMultiplier: 1.1, tireGripFactor: 2.8, dampingC: 7000, springK: 42000, rearDriveTorqueWeight: 1.4, finalDriveRatio: 1.75, steerRate: Math.PI * 3, maxSteerAngle: Math.PI / 8 },
        car: { engineHorsepower: 900, tireGripFactor: 3, dampingC: 7000, springK: 42000, rearDriveTorqueWeight: 1.4, finalDriveRatio: 1.75, steerRate: Math.PI * 3, maxSteerAngle: Math.PI / 8 },
        drone: { maxThrust: 5000, airDragFactor: 0.22, maxHorizSpeed: 20, maxVertSpeed: 8 },
      });
      return;
    }
    if (preset === "fast") {
      setTuning({
        common: { speedMultiplier: 3.5, boostMultiplier: 1.7, jumpVelocity: 12, cameraDistance: 4, cameraHeight: 0.65, cameraTurnSpeed: 6.5 },
        board: { speedMultiplier: 1.5, tireGripFactor: 3, dampingC: 7000, springK: 42000, rearDriveTorqueWeight: 1.4, finalDriveRatio: 1.75, steerRate: Math.PI * 3, maxSteerAngle: Math.PI / 8 },
        car: { engineHorsepower: 1100, tireGripFactor: 3, dampingC: 7000, springK: 42000, rearDriveTorqueWeight: 1.4, finalDriveRatio: 1.75, steerRate: Math.PI * 3, maxSteerAngle: Math.PI / 8 },
        drone: { maxThrust: 6500, airDragFactor: 0.16, maxHorizSpeed: 26, maxVertSpeed: 10 },
      });
    }
  };

  const focusables = () =>
    Array.from(panelRef.current?.querySelectorAll('button, input[type="range"]') ?? []);

  const focusAndReveal = (element) => {
    element?.focus();
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  const focusTab = (nextTab) => {
    setTab(nextTab);
    requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector(`[data-tab="${nextTab}"]`);
      focusAndReveal(target);
    });
  };

  const moveFocus = (delta) => {
    const items = focusables();
    const active = document.activeElement;
    const index = items.indexOf(active);
    const next = items[(index < 0 ? 0 : index + delta + items.length) % items.length];
    focusAndReveal(next);
  };

  const nudgeRange = (delta) => {
    const el = document.activeElement;
    if (!el || el.tagName !== "INPUT" || el.type !== "range") return false;
    const step = Number(el.step || 1);
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const nextValue = Math.min(max, Math.max(min, Number(el.value) + step * delta));
    el.value = String(nextValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  useEffect(() => {
    if (!open) return;

    const id = requestAnimationFrame(() => {
      const activeTab = panelRef.current?.querySelector(`[data-tab="${tab}"]`);
      focusAndReveal(activeTab);
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(-1);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        if (nudgeRange(-1)) {
          event.preventDefault();
          return;
        }
        const current = tabs.findIndex(([key]) => key === tab);
        if (current >= 0) {
          event.preventDefault();
          focusTab(tabs[(current - 1 + tabs.length) % tabs.length][0]);
        }
      }
      if (event.key === "ArrowRight") {
        if (nudgeRange(1)) {
          event.preventDefault();
          return;
        }
        const current = tabs.findIndex(([key]) => key === tab);
        if (current >= 0) {
          event.preventDefault();
          focusTab(tabs[(current + 1) % tabs.length][0]);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    let raf = 0;
    const pollGamepad = () => {
      const pad = gamepadRef.current;
      if (pad.justPressed.start || pad.justPressed.b) {
        onClose?.();
      } else if (pad.justPressed.up) {
        moveFocus(-1);
      } else if (pad.justPressed.down) {
        moveFocus(1);
      } else if (pad.justPressed.left) {
        if (!nudgeRange(-1)) {
          const current = tabs.findIndex(([key]) => key === tab);
          if (current >= 0) focusTab(tabs[(current - 1 + tabs.length) % tabs.length][0]);
        }
      } else if (pad.justPressed.right) {
        if (!nudgeRange(1)) {
          const current = tabs.findIndex(([key]) => key === tab);
          if (current >= 0) focusTab(tabs[(current + 1) % tabs.length][0]);
        }
      } else if (pad.justPressed.lt) {
        if (!nudgeRange(-1)) {
          const current = tabs.findIndex(([key]) => key === tab);
          if (current >= 0) focusTab(tabs[(current - 1 + tabs.length) % tabs.length][0]);
        }
      } else if (pad.justPressed.rt) {
        if (!nudgeRange(1)) {
          const current = tabs.findIndex(([key]) => key === tab);
          if (current >= 0) focusTab(tabs[(current + 1) % tabs.length][0]);
        }
      } else if (pad.justPressed.lb) {
        const current = tabs.findIndex(([key]) => key === tab);
        if (current >= 0) focusTab(tabs[(current - 1 + tabs.length) % tabs.length][0]);
      } else if (pad.justPressed.rb) {
        const current = tabs.findIndex(([key]) => key === tab);
        if (current >= 0) focusTab(tabs[(current + 1) % tabs.length][0]);
      } else if (pad.justPressed.a) {
        const active = document.activeElement;
        if (active instanceof HTMLButtonElement) active.click();
      }
      raf = requestAnimationFrame(pollGamepad);
    };

    raf = requestAnimationFrame(pollGamepad);

    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, tab, tabs, gamepadRef]);

  if (!open) return null;

  return (
    <div ref={panelRef} className={panelShell}>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 game-menu-scroll">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[clamp(2.4rem,6vw,4rem)] font-black tracking-[-0.05em] leading-none">Quick Tuning</h2>
        </div>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="ui-button rounded-full border border-white/10 bg-white/[0.08] px-5 py-3 text-[16px] font-black uppercase tracking-[0.16em] text-white"
        >
          Close
        </button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            data-tab={key}
            className={`rounded-2xl border px-4 py-4 text-[17px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
              tab === key ? "border-cyan-300/40 bg-cyan-300/18 text-cyan-200" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex-1 overflow-y-auto pr-2 game-menu-scroll">
          {tab === "scene" && (
            <Section title="World" eyebrow="Scene">
              <Slider label="Sun Angle" value={sunAngle} min={0} max={1} step={0.01} onChange={setSunAngle} />
            </Section>
          )}

          {tab === "core" && (
            <Section title="Game Feel" eyebrow="Core">
              <Slider label="Turbo" value={tuning.common.boostMultiplier ?? 1} min={1} max={2.5} step={0.01} onChange={(boostMultiplier) => setTuning({ common: { boostMultiplier } })} />
              <Slider label="Jump Height" value={tuning.common.jumpVelocity} min={3} max={20} step={0.01} onChange={(jumpVelocity) => setTuning({ common: { jumpVelocity } })} />
            </Section>
          )}

          {tab === "ride" && (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)] items-start">
              <Section title="Ride Feel" eyebrow="Ride">
                <Slider label="Drive Power" value={tuning.board.speedMultiplier} min={0.5} max={3} step={0.01} onChange={(speedMultiplier) => setTuning({ board: { speedMultiplier } })} />
                <Slider label="Grip" value={tuning.board.tireGripFactor} min={1} max={4} step={0.01} onChange={(tireGripFactor) => setTuning({ board: { tireGripFactor } })} />
                <Slider label="Stability" value={tuning.board.dampingC} min={3000} max={12000} step={50} onChange={(dampingC) => setTuning({ board: { dampingC } })} />
              </Section>
              <div className="space-y-3">
                <Section title="Presets" eyebrow="Fast Swap">
                  <div className="grid grid-cols-3 gap-2">
                    <ActionButton onClick={() => applyPreset("stable")}>Stable</ActionButton>
                    <ActionButton onClick={() => applyPreset("arcade")}>Arcade</ActionButton>
                    <ActionButton onClick={() => applyPreset("fast")}>Fast</ActionButton>
                  </div>
                 </Section>
        </div>
      </div>
          )}

          {tab === "air" && (
            <Section title="Drone Feel" eyebrow="Air">
              <Slider label="Boost Speed" value={tuning.drone.boostSpeedMult ?? 1.4} min={1} max={3} step={0.01} onChange={(boostSpeedMult) => setTuning({ drone: { boostSpeedMult } })} />
              <Slider label="Throttle Up Speed" value={tuning.drone.maxVertSpeed} min={3} max={20} step={0.01} onChange={(maxVertSpeed) => setTuning({ drone: { maxVertSpeed } })} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
