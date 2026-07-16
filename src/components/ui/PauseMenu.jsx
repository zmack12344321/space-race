import { useEffect, useRef, useState } from "react";
import { useGamepadRef } from "./gamepadStore";
import { EcctrlTuningPanel } from "./EcctrlControlPanel";
import { ControlsScreen } from "./ControlsData";
import { PAUSE_QUIPS, makeQuipPicker } from "../../utils/quips";

const STICK_NAV = 0.55;
const NAV_REPEAT = 220;

const MENU_ITEMS = [
  { key: "resume", label: "Resume" },
  { key: "controls", label: "Controls" },
  { key: "settings", label: "Settings" },
  { key: "quit", label: "Quit to Title" },
];

export function PauseMenu({ open, onResume, onQuit, vehicleModel }) {
  const [view, setView] = useState("main");
  const gamepadRef = useGamepadRef();
  const buttonRefs = useRef([]);
  const [focused, setFocused] = useState(0);
  const focusIndex = useRef(0);
  const pickQuip = useRef(makeQuipPicker(PAUSE_QUIPS));
  const [quip] = useState(() => pickQuip.current());

  useEffect(() => {
    if (open) {
      setView("main");
      setFocused(0);
      focusIndex.current = 0;
    }
  }, [open]);

  const activate = (key) => {
    if (key === "resume") onResume();
    else if (key === "controls") setView("controls");
    else if (key === "settings") setView("settings");
    else if (key === "quit") onQuit();
  };

  useEffect(() => {
    if (!open || view !== "main") return;

    const focusCurrent = () => buttonRefs.current[focusIndex.current]?.focus();

    const onKeyDown = (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        focusIndex.current = (focusIndex.current - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        setFocused(focusIndex.current);
        buttonRefs.current[focusIndex.current]?.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        focusIndex.current = (focusIndex.current + 1) % MENU_ITEMS.length;
        setFocused(focusIndex.current);
        buttonRefs.current[focusIndex.current]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(MENU_ITEMS[focusIndex.current].key);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onResume();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    const pad0 = gamepadRef.current;
    const held = {
      up: pad0.buttons.up || pad0.axes.ly < -STICK_NAV,
      down: pad0.buttons.down || pad0.axes.ly > STICK_NAV,
      left: pad0.buttons.left || pad0.axes.lx < -STICK_NAV,
      right: pad0.buttons.right || pad0.axes.lx > STICK_NAV,
      a: pad0.buttons.a,
      back: pad0.buttons.b || pad0.buttons.start,
    };
    const repeatAt = { up: 0, down: 0, left: 0, right: 0 };
    let raf = 0;
    const tick = () => {
      const pad = gamepadRef.current;
      const now = performance.now();
      const active = {
        up: pad.buttons.up || pad.axes.ly < -STICK_NAV,
        down: pad.buttons.down || pad.axes.ly > STICK_NAV,
        left: pad.buttons.left || pad.axes.lx < -STICK_NAV,
        right: pad.buttons.right || pad.axes.lx > STICK_NAV,
        a: pad.buttons.a,
        back: pad.buttons.b || pad.buttons.start,
      };
      const fire = (key, fn) => {
        if (active[key] && (!held[key] || now >= repeatAt[key])) {
          fn();
          repeatAt[key] = now + (held[key] ? NAV_REPEAT : 260);
        }
      };
      fire("up", () => {
        focusIndex.current = (focusIndex.current - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        setFocused(focusIndex.current);
        buttonRefs.current[focusIndex.current]?.focus();
      });
      fire("down", () => {
        focusIndex.current = (focusIndex.current + 1) % MENU_ITEMS.length;
        setFocused(focusIndex.current);
        buttonRefs.current[focusIndex.current]?.focus();
      });
      if (active.a && !held.a) activate(MENU_ITEMS[focusIndex.current].key);
      if (active.back && !held.back) onResume();
      Object.assign(held, active);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    focusCurrent();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [open, view, onResume]);

  if (!open) return null;

  const handleBackdrop = () => {
    if (view === "settings") setView("main");
    else if (view === "controls") setView("main");
    else onResume();
  };

  if (view === "settings") {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden p-4 pointer-events-none">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={() => setView("main")} aria-hidden="true" />
        <EcctrlTuningPanel open={view === "settings"} onClose={() => setView("main")} vehicleModel={vehicleModel} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden p-4 pointer-events-none">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={handleBackdrop} aria-hidden="true" />
      <div className={`controls-font relative z-10 ${view === "controls" ? "w-[min(96vw,1120px)]" : "w-[min(92vw,560px)]"} pointer-events-auto rounded-[2rem] border border-white/10 bg-slate-950/92 p-7 text-white shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-xl`}>
        {view === "main" && (
          <>
            <h1 className="text-[clamp(3rem,7vw,4.5rem)] font-black tracking-[-0.05em] leading-none">Paused</h1>
            <div className="mt-2 text-[18px] text-white/60">{quip}</div>
            <div className="mt-7 flex flex-col gap-3">
              {MENU_ITEMS.map((item, index) => (
                <button
                  key={item.key}
                  ref={(el) => (buttonRefs.current[index] = el)}
                  type="button"
                  onClick={() => activate(item.key)}
                  onMouseEnter={() => setFocused(index)}
                  className={`ui-button w-full rounded-2xl border px-6 py-5 text-left text-[24px] font-black uppercase tracking-[0.12em] transition focus-visible:outline-none ${focused === index ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
        {view === "controls" && <ControlsScreen onBack={() => setView("main")} />}
      </div>
    </div>
  );
}
