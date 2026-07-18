import { useEffect, useMemo, useRef, useState } from "react";
import { getEcctrlTuningPreset, useEcctrlTuningStore } from "../vehicles/ecctrlTuningStore";
import { useGameSettings } from "./gameSettingsStore";
import { useMultiplayerState } from "../../multiplayer/party";
import { useGamepadRef } from "./gamepadStore";

const panelShell =
  "controls-font h-full w-full min-h-0 flex flex-col overflow-hidden rounded-[2rem] bg-[rgba(6,10,18,0.55)] text-white pointer-events-auto";

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-[13px] text-white/90">
        <span className="font-black uppercase tracking-[0.14em]">{label}</span>
        <span className="font-mono text-[12px] text-white/70">
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
        className="game-slider game-slider-compact w-full cursor-pointer"
      />
    </label>
  );
}

function Section({ title, eyebrow, children }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          {eyebrow && <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-cyan-300/90">{eyebrow}</div>}
          <div className="mt-1 text-[22px] leading-none font-black tracking-[-0.04em] text-white">{title}</div>
        </div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function ActionButton({ children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ui-button rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10 ${className}`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="control-row flex w-full items-center justify-between gap-3 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4 text-left"
    >
      <span className="flex flex-col">
        <span className="text-[13px] font-black uppercase tracking-[0.14em] text-white">{label}</span>
        {hint && <span className="mt-1 text-[12px] leading-snug text-white/55">{hint}</span>}
      </span>
      <span
        className={`relative h-[1.625rem] w-11 shrink-0 rounded-full border transition ${
          value ? "border-cyan-300/50 bg-cyan-300/25" : "border-white/15 bg-white/8"
        }`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
            value ? "left-5 bg-cyan-200" : "left-0.5 bg-white/70"
          }`}
        />
      </span>
    </button>
  );
}

export function EcctrlTuningPanel({ open, onClose, vehicleModel, loading = false, id }) {
  const [tab, setTab] = useState("scene");
  const panelRef = useRef(null);
  const gamepadRef = useGamepadRef();
  const tuning = useEcctrlTuningStore((state) => state);
  const setTuning = useEcctrlTuningStore((state) => state.setTuning);
  const gameSettings = useGameSettings();
  const setGameSetting = useGameSettings((state) => state.setSetting);
  const markCustomRender = useGameSettings((state) => state.markCustomRender);
  const [sunAngle, setSunAngle] = useMultiplayerState("sunAngle", 0.3);
  const [raceMode, setRaceMode] = useMultiplayerState("raceMode", false);
  const [raceSegmentLength, setRaceSegmentLength] = useMultiplayerState("raceSegmentLength", 32);
  const [raceGateClearance, setRaceGateClearance] = useMultiplayerState("raceGateClearance", 14);
  const [raceTurnStrength, setRaceTurnStrength] = useMultiplayerState("raceTurnStrength", 0.58);
  const [raceRouteVariety, setRaceRouteVariety] = useMultiplayerState("raceRouteVariety", 0.55);
  const [raceArchBias, setRaceArchBias] = useMultiplayerState("raceArchBias", 0.3);
  const [racePeakBias, setRacePeakBias] = useMultiplayerState("racePeakBias", 0.3);
  const [raceCanyonBias, setRaceCanyonBias] = useMultiplayerState("raceCanyonBias", 0.25);

  const tabs = useMemo(
    () => [
      ["scene", "Scene"],
      ["race", "Race"],
      ["core", "Core"],
      ["ride", "Ride"],
      ["air", "Air"],
    ],
    []
  );

  const vehicleLabel =
    typeof vehicleModel === "string"
      ? vehicleModel
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Vehicle";

  useEffect(() => {
    if (open) setTab("scene");
  }, [open]);

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

  useEffect(() => {
    if (open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && panelRef.current?.contains(active)) {
      active.blur();
    }
  }, [open]);

  return (
    <div
      ref={panelRef}
      id={id}
      inert={open ? undefined : true}
      className={`pointer-events-auto overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_18px_48px_rgba(0,0,0,0.42)] transition-[height,opacity,transform] duration-300 ease-out ${
        open ? "h-[min(74vh,38rem)] opacity-100 translate-y-0" : "h-0 opacity-0 -translate-y-3 pointer-events-none"
      }`}
    >
      <div className={`${panelShell} origin-top-left`}>
        <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="text-[clamp(1.7rem,3.8vw,2.5rem)] font-black tracking-[-0.06em] leading-none">Quick Tuning</h2>
              <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55 truncate">
                {vehicleLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="ui-button shrink-0 rounded-full border border-white/10 bg-white/[0.08] px-5 py-3 text-[13px] font-black uppercase tracking-[0.16em] text-white hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[6.75rem_1fr] gap-3 p-2.5">
            <div className="flex max-h-full flex-col gap-2 overflow-y-auto rounded-[1.25rem] bg-white/[0.03] p-2 pt-1 pr-1" role="tablist" aria-label="Quick tuning sections">
                {tabs.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    data-tab={key}
                    aria-selected={tab === key}
                    role="tab"
                    className={`ui-button flex h-12 w-full items-center justify-center rounded-2xl border px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                      tab === key
                        ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-[14px] font-black uppercase tracking-[0.16em] leading-none">{label}</div>
                  </button>
                ))}
            </div>

            <div className="min-h-0 overflow-y-auto rounded-[1.25rem] bg-white/[0.03] p-3 pr-1.5 pt-1 pb-2 game-menu-scroll">
              {tab === "scene" && (
                <Section title="World" eyebrow="Scene">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Slider label="Sun Angle" value={sunAngle} min={0} max={1} step={0.01} onChange={setSunAngle} />
                    <Slider
                      label="Render Distance"
                      value={gameSettings.renderDistance}
                      min={8}
                      max={16}
                      step={0.5}
                      onChange={(value) => {
                        markCustomRender();
                        setGameSetting("renderDistance", value);
                      }}
                    />
                    <Slider
                      label="Shadow Draw Distance"
                      value={gameSettings.shadowDistance}
                      min={400}
                      max={2400}
                      step={50}
                      onChange={(value) => {
                        markCustomRender();
                        setGameSetting("shadowDistance", value);
                      }}
                    />
                  </div>
                </Section>
              )}

              {tab === "race" && (
                <Section title="Course" eyebrow="Race">
                  <Toggle
                    label="Race Mode"
                    hint="Gates path mode. Drive through each ring to light next one."
                    value={raceMode}
                    onChange={setRaceMode}
                  />
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Slider label="Ring Spacing" value={raceSegmentLength} min={18} max={72} step={1} onChange={setRaceSegmentLength} />
                    <Slider label="Gate Clearance" value={raceGateClearance} min={4} max={32} step={1} onChange={setRaceGateClearance} />
                    <Slider label="Weave Strength" value={raceTurnStrength} min={0.2} max={1.5} step={0.01} onChange={setRaceTurnStrength} />
                    <Slider label="Route Variety" value={raceRouteVariety} min={0} max={1} step={0.01} onChange={setRaceRouteVariety} />
                    <Slider label="Arch Bias" value={raceArchBias} min={0} max={1} step={0.01} onChange={setRaceArchBias} />
                    <Slider label="Peak Bias" value={racePeakBias} min={0} max={1} step={0.01} onChange={setRacePeakBias} />
                    <Slider label="Canyon Bias" value={raceCanyonBias} min={0} max={1} step={0.01} onChange={setRaceCanyonBias} />
                  </div>
                </Section>
              )}

              {tab === "core" && (
                <Section title="Game Feel" eyebrow="Core">
                  <Slider label="Turbo" value={tuning.common.boostMultiplier ?? 1} min={1} max={2.5} step={0.01} onChange={(boostMultiplier) => setTuning({ common: { boostMultiplier } })} />
                  <Slider label="Jump" value={tuning.common.jumpVelocity} min={3} max={20} step={0.01} onChange={(jumpVelocity) => setTuning({ common: { jumpVelocity } })} />
                </Section>
              )}

              {tab === "ride" && (
                <div className="space-y-3">
                  <Section title="Ride Feel" eyebrow="Ride">
                    <Slider label="Drive" value={tuning.board.speedMultiplier} min={0.5} max={3} step={0.01} onChange={(speedMultiplier) => setTuning({ board: { speedMultiplier } })} />
                    <Slider label="Grip" value={tuning.board.tireGripFactor} min={1} max={4} step={0.01} onChange={(tireGripFactor) => setTuning({ board: { tireGripFactor } })} />
                    <Slider label="Stability" value={tuning.board.dampingC} min={3000} max={12000} step={50} onChange={(dampingC) => setTuning({ board: { dampingC } })} />
                  </Section>
                  <Section title="Presets" eyebrow="Swap">
                    <div className="grid grid-cols-3 gap-2">
                      <ActionButton onClick={() => applyPreset("stable")}>Stable</ActionButton>
                      <ActionButton onClick={() => applyPreset("arcade")}>Arcade</ActionButton>
                      <ActionButton onClick={() => applyPreset("fast")}>Fast</ActionButton>
                    </div>
                  </Section>
                </div>
              )}

              {tab === "air" && (
                <Section title="Drone Feel" eyebrow="Air">
                  <Slider label="Boost" value={tuning.drone.boostSpeedMult ?? 1.4} min={1} max={3} step={0.01} onChange={(boostSpeedMult) => setTuning({ drone: { boostSpeedMult } })} />
                  <Slider label="Vertical" value={tuning.drone.maxVertSpeed} min={3} max={20} step={0.01} onChange={(maxVertSpeed) => setTuning({ drone: { maxVertSpeed } })} />
                </Section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
