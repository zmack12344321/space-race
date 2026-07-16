import { useEffect, useRef } from "react";
import { useGamepadRef } from "./gamepadStore";
import { useGameSettings, DEFAULT_GAME_SETTINGS } from "./gameSettingsStore";

const STICK_NAV = 0.55;
const NAV_REPEAT = 220;

const QUALITY_OPTONS = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

const AA_OPTIONS = [
  { key: "renderer", label: "Renderer" },
  { key: "multisample4", label: "MSAA 4x" },
  { key: "multisample8", label: "MSAA 8x" },
  { key: "smaa", label: "SMAA" },
  { key: "off", label: "Off" },
];

const RENDER_PRESET_OPTIONS = [
  { key: "performance", label: "Performance" },
  { key: "balanced", label: "Balanced" },
  { key: "quality", label: "Quality" },
];

const STAR_OPTIONS = [
  { key: "off", label: "Off" },
  { key: "lean", label: "Lean" },
  { key: "full", label: "Full" },
];

const DPR_OPTIONS = [1.25, 1.5, 1.75, 2];

function SettingToggle({ label, value, onChange }) {
  return (
    <div className="control-row flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
      <span className="text-[18px] font-black uppercase tracking-[0.14em] text-white">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`ui-button relative h-9 w-16 rounded-full border transition ${value ? "border-cyan-300/50 bg-cyan-300/25" : "border-white/15 bg-white/8"}`}
      >
        <span
          className={`absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white shadow transition-all ${value ? "left-[calc(100%-2rem)]" : "left-1"}`}
        />
      </button>
    </div>
  );
}

export function GameSettings({ onBack }) {
  const panelRef = useRef(null);
  const gamepadRef = useGamepadRef();
  const settings = useGameSettings();
  const setSetting = useGameSettings((s) => s.setSetting);
  const applyRenderPreset = useGameSettings((s) => s.applyRenderPreset);
  const markCustomRender = useGameSettings((s) => s.markCustomRender);
  const reset = useGameSettings((s) => s.reset);

  const focusables = () =>
    Array.from(panelRef.current?.querySelectorAll('button, input[type="range"]') ?? []);

  const focusAndReveal = (element) => {
    element?.focus();
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
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

  const nudgeRangeContinuous = (magnitude) => {
    const el = document.activeElement;
    if (!el || el.tagName !== "INPUT" || el.type !== "range") return false;
    const step = Number(el.step || 1);
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const nextValue = Math.min(max, Math.max(min, Number(el.value) + step * magnitude * 0.9));
    el.value = String(nextValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };

  useEffect(() => {
    const nav = { current: {} };
    const readNav = (pad) => ({
      up: pad.buttons.up || pad.axes.ly < -STICK_NAV,
      down: pad.buttons.down || pad.axes.ly > STICK_NAV,
      left: pad.buttons.left || pad.axes.lx < -STICK_NAV,
      right: pad.buttons.right || pad.axes.lx > STICK_NAV,
      a: pad.buttons.a,
      back: pad.buttons.b || pad.buttons.start,
    });
    nav.current = readNav(gamepadRef.current);

    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector('button, input[type="range"]');
      first?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(1);
      } else if (event.key === "ArrowLeft") {
        if (nudgeRange(-1)) event.preventDefault();
      } else if (event.key === "ArrowRight") {
        if (nudgeRange(1)) event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    let raf = 0;
    const tick = () => {
      const pad = gamepadRef.current;
      const now = performance.now();
      const active = readNav(pad);
      const fire = (key, fn) => {
        if (active[key] && (!nav.current[key] || now >= repeatAt[key])) {
          fn();
          repeatAt[key] = now + (nav.current[key] ? NAV_REPEAT : 260);
        }
      };
      const element = document.activeElement;
      const isSlider = element && element.tagName === "INPUT" && element.type === "range";

      if (active.back && !nav.current.back) {
        onBack();
      } else if (isSlider) {
        if (Math.abs(pad.axes.lx) > STICK_NAV) nudgeRangeContinuous(pad.axes.lx);
        fire("up", () => moveFocus(-1));
        fire("down", () => moveFocus(1));
        fire("left", () => nudgeRange(-1));
        fire("right", () => nudgeRange(1));
      } else {
        fire("up", () => moveFocus(-1));
        fire("down", () => moveFocus(1));
        fire("left", () => moveFocus(-1));
        fire("right", () => moveFocus(1));
        if (active.a && !nav.current.a && element instanceof HTMLButtonElement) element.click();
      }
      Object.assign(nav.current, active);
      raf = requestAnimationFrame(tick);
    };
    const repeatAt = {};

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [onBack]);

  return (
    <div ref={panelRef} className="controls-font flex max-h-[min(86vh,52rem)] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[clamp(2.4rem,6vw,4rem)] font-black tracking-[-0.05em] leading-none">Game Settings</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="ui-button shrink-0 rounded-full border border-white/10 bg-white/[0.08] px-5 py-3 text-[16px] font-black uppercase tracking-[0.16em] text-white"
        >
          Back
        </button>
      </div>

      <div className="mt-5 grid flex-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex flex-col overflow-y-auto rounded-[1.5rem] border border-cyan-300/30 bg-white/[0.04] p-5 game-menu-scroll">
          <div className="mb-4 text-[18px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">Quality</div>
          <div className="space-y-2.5">
            <div className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
              <div className="mb-3 text-[18px] font-black uppercase tracking-[0.14em] text-white">Render Preset</div>
              <div className="grid grid-cols-3 gap-2">
                {RENDER_PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => applyRenderPreset(opt.key)}
                    className={`ui-button rounded-2xl border px-4 py-4 text-[15px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none ${
                      settings.renderPreset === opt.key
                        ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[12px] uppercase tracking-[0.12em] text-white/45">Manual changes below switch this to custom.</p>
            </div>
            <div className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
              <div className="mb-3 text-[18px] font-black uppercase tracking-[0.14em] text-white">Graphics</div>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_OPTONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { markCustomRender(); setSetting("quality", opt.key); }}
                    className={`ui-button rounded-2xl border px-4 py-4 text-[16px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none ${
                      settings.quality === opt.key
                        ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <SettingToggle label="Shadows" value={settings.shadows} onChange={(v) => { markCustomRender(); setSetting("shadows", v); }} />
            <SettingToggle label="Bloom" value={settings.bloom} onChange={(v) => { markCustomRender(); setSetting("bloom", v); }} />
            <SettingToggle label="Particles" value={settings.particles} onChange={(v) => { markCustomRender(); setSetting("particles", v); }} />
            <SettingToggle label="Screen Shake" value={settings.screenShake} onChange={(v) => { markCustomRender(); setSetting("screenShake", v); }} />
            <div className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
              <div className="mb-3 text-[18px] font-black uppercase tracking-[0.14em] text-white">Anti-Aliasing</div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {AA_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { markCustomRender(); setSetting("aaMode", opt.key); }}
                    className={`ui-button rounded-2xl border px-4 py-4 text-[15px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none ${
                      settings.aaMode === opt.key
                        ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
              <div className="mb-3 text-[18px] font-black uppercase tracking-[0.14em] text-white">DPR Cap</div>
              <div className="grid grid-cols-4 gap-2">
                {DPR_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { markCustomRender(); setSetting("dprCap", opt); }}
                    className={`ui-button rounded-2xl border px-4 py-4 text-[15px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none ${
                      settings.dprCap === opt
                        ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {opt}x
                  </button>
                ))}
              </div>
            </div>
            <SettingToggle label="Adaptive DPR" value={settings.adaptiveDpr} onChange={(v) => { markCustomRender(); setSetting("adaptiveDpr", v); }} />
            <div className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
              <div className="mb-3 text-[18px] font-black uppercase tracking-[0.14em] text-white">Stars</div>
              <div className="grid grid-cols-3 gap-2">
                {STAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { markCustomRender(); setSetting("starsMode", opt.key); }}
                    className={`ui-button rounded-2xl border px-4 py-4 text-[15px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none ${
                      settings.starsMode === opt.key
                        ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => reset()}
                className="ui-button w-full rounded-full border border-white/10 bg-white/8 px-6 py-4 text-[16px] font-black uppercase tracking-[0.14em] text-white"
              >
                Restore Defaults
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 game-menu-scroll">
          <div className="text-[18px] font-bold uppercase tracking-[0.22em] text-white/55">About</div>
          <div className="mt-3 space-y-3 text-[16px] leading-snug text-white/75">
            <p>
              These are <span className="font-black uppercase tracking-[0.12em] text-white">overall game</span> settings — graphics
              quality, effects, and feel. They apply to the whole game and save on your device.
            </p>
            <p>
              Want to tune how <span className="font-black uppercase tracking-[0.12em] text-white">your vehicle</span> handles? Use the{" "}
              <span className="font-black uppercase tracking-[0.12em] text-cyan-200">Quick Tuning</span> button during a match — that's separate from
              these.
            </p>
            <p className="text-white/55">Graphics quality: <span className="font-black uppercase tracking-[0.12em] text-white">{settings.quality}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
