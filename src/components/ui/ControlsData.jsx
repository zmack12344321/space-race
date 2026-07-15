import { useEffect, useRef } from "react";
import { useGamepadRef } from "./gamepadStore";
import { usePlayerSettings } from "./playerSettingsStore";

export const INPUT_PROMPTS = {
  keyboard: {
    move: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_w_outline.svg", import.meta.url).href,
    jump: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_space_outline.svg", import.meta.url).href,
    boost: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_shift_outline.svg", import.meta.url).href,
    brake: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_e_outline.svg", import.meta.url).href,
    reverse: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_s_outline.svg", import.meta.url).href,
    menu: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_escape_outline.svg", import.meta.url).href,
  },
  xbox: {
    move: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Xbox Series/Vector/xbox_stick_l.svg", import.meta.url).href,
    jump: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Xbox Series/Vector/xbox_button_a_outline.svg", import.meta.url).href,
    boost: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Xbox Series/Vector/xbox_button_y_outline.svg", import.meta.url).href,
    brake: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Xbox Series/Vector/xbox_button_b_outline.svg", import.meta.url).href,
    reverse: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Xbox Series/Vector/xbox_lt_outline.svg", import.meta.url).href,
    menu: new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Xbox Series/Vector/xbox_button_start_outline.svg", import.meta.url).href,
  },
};

export const CONTROL_ROWS = [
  { label: "Move", keyboard: [INPUT_PROMPTS.keyboard.move, new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_a_outline.svg", import.meta.url).href, new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_s_outline.svg", import.meta.url).href, new URL("../../../_assets-to-import/kenney_input-prompts_1.5/Keyboard & Mouse/Vector/keyboard_d_outline.svg", import.meta.url).href], xbox: [INPUT_PROMPTS.xbox.move], help: "Drive and steer" },
  { label: "Jump", keyboard: [INPUT_PROMPTS.keyboard.jump], xbox: [INPUT_PROMPTS.xbox.jump], help: "Pop off the ground" },
  { label: "Boost", keyboard: [INPUT_PROMPTS.keyboard.boost], xbox: [INPUT_PROMPTS.xbox.boost], help: "Hold for extra speed" },
  { label: "Brake / Reverse", keyboard: [INPUT_PROMPTS.keyboard.reverse, INPUT_PROMPTS.keyboard.brake], xbox: [INPUT_PROMPTS.xbox.brake, INPUT_PROMPTS.xbox.reverse], help: "Slow down or back up" },
  { label: "Menu", keyboard: [INPUT_PROMPTS.keyboard.menu], xbox: [INPUT_PROMPTS.xbox.menu], help: "Open or close the menu" },
];

const PromptBadge = ({ src, alt }) => (
  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_8px_18px_rgba(0,0,0,0.32)]">
    <img src={src} alt={alt} className="h-9 w-9 object-contain" draggable="false" />
  </span>
);

function ControlSlider({ label, value, min, max, step, onChange }) {
  return (
    <label className="control-row rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-[18px] text-white">
        <span className="font-black uppercase tracking-[0.14em]">{label}</span>
        <span className="font-mono text-white/80">{Number(value).toFixed(2)}</span>
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

function ControlToggle({ label, value, onChange }) {
  return (
    <div className="control-row flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/[0.08] bg-black/20 px-5 py-4">
      <span className="text-[18px] font-black uppercase tracking-[0.14em] text-white">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`ui-button rounded-full px-6 py-2 text-[15px] font-black uppercase tracking-[0.12em] ${
          value ? "bg-cyan-300 text-black" : "bg-white/10 text-white/70"
        }`}
      >
        {value ? "On" : "Off"}
      </button>
    </div>
  );
}

const PromptGroup = ({ icons, label }) => (
  <div className="flex items-center gap-1.5 sm:gap-2">
    {icons.map((src) => (
      <PromptBadge key={src} src={src} alt={label} />
    ))}
  </div>
);

const STICK_NAV = 0.55;
const NAV_REPEAT = 220;

export function ControlsScreen({ onBack }) {
  const scrollRef = useRef(null);
  const panelRef = useRef(null);
  const gamepadRef = useGamepadRef();
  const settings = usePlayerSettings();
  const setSetting = usePlayerSettings((state) => state.setSetting);
  const resetSettings = usePlayerSettings((state) => state.reset);
  const nav = useRef(null);
  const repeatAt = useRef({ up: 0, down: 0, left: 0, right: 0 });

  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0);
  }, [scrollRef]);

  useEffect(() => {
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
      const prev = nav.current;
      const fire = (key, fn) => {
        if (active[key] && (!prev[key] || now >= repeatAt.current[key])) {
          fn();
          repeatAt.current[key] = now + (prev[key] ? NAV_REPEAT : 260);
        }
      };

      const element = document.activeElement;
      const isSlider = element && element.tagName === "INPUT" && element.type === "range";

      if (active.back && !prev.back) {
        onBack();
      } else if (isSlider) {
        // Left stick X gives smooth, fast analog adjustment while a slider is focused.
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
        if (active.a && !prev.a && element instanceof HTMLButtonElement) element.click();
      }

      nav.current = active;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onBack, gamepadRef]);

  return (
    <div ref={panelRef} className="controls-font flex max-h-[min(86vh,52rem)] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[clamp(2.4rem,6vw,4rem)] font-black tracking-[-0.05em] leading-none">How to Play</h2>
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
          <div className="mb-4 text-[18px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">Your Settings</div>
          <div className="space-y-2.5">
            <ControlSlider
              label="Look Sensitivity"
              value={settings.lookSensitivity}
              min={0.2}
              max={3}
              step={0.05}
              onChange={(value) => setSetting("lookSensitivity", value)}
            />
            <ControlToggle label="Invert Look Y" value={settings.invertLookY} onChange={(value) => setSetting("invertLookY", value)} />
            <ControlToggle label="Invert Look X" value={settings.invertLookX} onChange={(value) => setSetting("invertLookX", value)} />
            <ControlToggle label="Invert Steering" value={settings.invertSteering} onChange={(value) => setSetting("invertSteering", value)} />
            <div className="pt-1">
              <button
                type="button"
                onClick={resetSettings}
                className="ui-button w-full rounded-full border border-white/10 bg-white/8 px-6 py-4 text-[16px] font-black uppercase tracking-[0.14em] text-white"
              >
                Restore Defaults
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 game-menu-scroll">
          <div className="text-[18px] font-bold uppercase tracking-[0.22em] text-white/55">Bindings</div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="mb-3 text-[16px] font-bold uppercase tracking-[0.18em] text-white/70">Keyboard & Mouse</div>
            <div className="space-y-2.5">
              {CONTROL_ROWS.map((row) => (
                <div key={`keyboard-${row.label}`} className="grid grid-cols-[minmax(7rem,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/10 px-4 py-3">
                  <div>
                    <div className="text-[18px] font-black uppercase tracking-[0.14em] text-white">{row.label}</div>
                    <div className="text-[14px] text-white/55">{row.help}</div>
                  </div>
                  <PromptGroup icons={row.keyboard} label={`${row.label} keyboard prompt`} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="mb-3 text-[16px] font-bold uppercase tracking-[0.18em] text-white/70">Xbox Series</div>
            <div className="space-y-2.5">
              {CONTROL_ROWS.map((row) => (
                <div key={`xbox-${row.label}`} className="grid grid-cols-[minmax(7rem,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/10 px-4 py-3">
                  <div>
                    <div className="text-[18px] font-black uppercase tracking-[0.14em] text-white">{row.label}</div>
                    <div className="text-[14px] text-white/55">{row.help}</div>
                  </div>
                  <PromptGroup icons={row.xbox} label={`${row.label} controller prompt`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
