import { useEffect, useRef, useState } from "react";
import { useGamepadRef } from "./gamepadStore";
import { useGameSettings } from "./gameSettingsStore";

const STICK_NAV = 0.55;
const NAV_REPEAT = 220;

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

function SettingSlider({ label, value, min, max, step, onChange, suffix = "" }) {
  return (
    <label className="control-row flex flex-col gap-2 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
      <div className="flex items-center justify-between gap-3 text-[18px] font-black uppercase tracking-[0.14em] text-white">
        <span>{label}</span>
        <span className="font-mono text-[13px] text-white/75">{Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}{suffix}</span>
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

function SettingSliderWithHint({ label, value, min, max, step, onChange, hint }) {
  return (
    <label className="control-row flex flex-col gap-2 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
      <div className="flex items-center justify-between gap-3 text-[18px] font-black uppercase tracking-[0.14em] text-white">
        <span>{label}</span>
        <span className="font-mono text-[13px] text-white/75">{Number(value).toFixed(0)}</span>
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
      {hint && <div className="text-[12px] uppercase tracking-[0.12em] text-white/45">{hint}</div>}
    </label>
  );
}

function SettingSelect({ label, value, options, onChange }) {
  return (
    <div className="control-row flex flex-col gap-2 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
      <div className="text-[18px] font-black uppercase tracking-[0.14em] text-white">{label}</div>
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[15px] font-black uppercase tracking-[0.12em] text-white/70">
        {options.find((opt) => opt.key === value)?.label ?? value}
      </div>
    </div>
  );
}

function StyledDropdown({ label, value, options, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onDocPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onDocKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, []);

  const current = options.find((opt) => opt.key === value) ?? options[0];

  return (
    <div ref={rootRef} className="control-row relative flex flex-col gap-2 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
      <div className="text-[18px] font-black uppercase tracking-[0.14em] text-white">{label}</div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ui-button flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[15px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/10"
      >
        <span>{current?.label ?? value}</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && (
        <div role="listbox" className="absolute left-5 right-5 top-[calc(100%-0.25rem)] z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="option"
              aria-selected={opt.key === value}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={`block w-full px-4 py-3 text-left text-[14px] font-black uppercase tracking-[0.12em] transition ${
                opt.key === value ? "bg-cyan-300/15 text-cyan-200" : "text-white/75 hover:bg-white/8 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
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
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const focusables = () =>
    Array.from(panelRef.current?.querySelectorAll('button, input[type="range"], select') ?? []);

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
      const first = panelRef.current?.querySelector('button, input[type="range"], select');
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
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);

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
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      cancelAnimationFrame(raf);
    };
  }, [onBack]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Ignore fullscreen failures.
    }
  };

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

      <div className="mt-5 grid flex-1 min-h-0 gap-4 overflow-hidden xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-h-0 flex-col overflow-y-auto rounded-[1.5rem] border border-cyan-300/30 bg-white/[0.04] p-5 game-menu-scroll">
          <div className="mb-4 text-[18px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">Render</div>
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
            <StyledDropdown
              label="Anti-Aliasing"
              value={settings.aaMode}
              options={AA_OPTIONS}
              onChange={(value) => {
                markCustomRender();
                setSetting("aaMode", value);
              }}
            />
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
            <SettingSliderWithHint
              label="Render Distance"
              value={settings.renderDistance}
              min={9}
              max={20}
              step={1}
              onChange={(v) => { markCustomRender(); setSetting("renderDistance", v); }}
              hint="Raises how far the lunar terrain and rocks stream."
            />
            <SettingSliderWithHint
              label="Shadow Distance"
              value={settings.shadowDistance}
              min={350}
              max={1200}
              step={25}
              onChange={(v) => { markCustomRender(); setSetting("shadowDistance", v); }}
              hint="Raises how far dynamic shadows stay visible before they fade out."
            />
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
            <div className="mt-2 text-[12px] uppercase tracking-[0.16em] text-white/40">
              Current preset: <span className="text-white/85">{settings.renderPreset}</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 game-menu-scroll">
          <div className="text-[18px] font-bold uppercase tracking-[0.22em] text-white/55">Audio</div>
          <div className="space-y-2.5">
            <SettingSlider label="Master Volume" value={settings.masterVolume} min={0} max={1} step={0.01} onChange={(v) => setSetting("masterVolume", v)} />
            <SettingSlider label="SFX Volume" value={settings.sfxVolume} min={0} max={1} step={0.01} onChange={(v) => setSetting("sfxVolume", v)} />
          </div>

          <div className="pt-2 text-[18px] font-bold uppercase tracking-[0.22em] text-white/55">Display</div>
          <div className="space-y-2.5">
            <div className="control-row flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
              <span className="text-[18px] font-black uppercase tracking-[0.14em] text-white">Fullscreen</span>
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`ui-button rounded-full border px-5 py-3 text-[15px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none ${
                  isFullscreen ? "border-cyan-300/50 bg-cyan-300/18 text-cyan-200" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {isFullscreen ? "Exit" : "Enter"}
              </button>
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
      </div>
    </div>
  );
}
