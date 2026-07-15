import { useEffect, useRef, useState } from "react";
import { useGamepadRef } from "./gamepadStore";
import { EcctrlTuningPanel } from "./EcctrlControlPanel";
import { ControlsScreen } from "./ControlsData";

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
  const focusedRef = useRef(0);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useEffect(() => {
    if (open) {
      setView("main");
      setFocused(0);
    }
  }, [open]);

  const activate = (key) => {
    if (key === "resume") onResume();
    else if (key === "controls") setView("controls");
    else if (key === "settings") setView("settings");
    else if (key === "quit") onQuit();
  };

  useEffect(() => {
    if (!open || view === "settings") return;

    const focusCurrent = () => buttonRefs.current[focusedRef.current]?.focus();

    const onKeyDown = (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        setFocused((f) => (f - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        setFocused((f) => (f + 1) % MENU_ITEMS.length);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(MENU_ITEMS[focusedRef.current].key);
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (view === "controls") setView("main");
        else onResume();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    let raf = 0;
    const tick = () => {
      const pad = gamepadRef.current;
      if (pad.justPressed.up || pad.justPressed.left) {
        setFocused((f) => (f - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (pad.justPressed.down || pad.justPressed.right) {
        setFocused((f) => (f + 1) % MENU_ITEMS.length);
      } else if (pad.justPressed.a) {
        activate(MENU_ITEMS[focusedRef.current].key);
      } else if (pad.justPressed.b || pad.justPressed.start) {
        if (view === "controls") setView("main");
        else onResume();
      }
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
      <div className="relative z-10 w-[min(92vw,560px)] pointer-events-auto rounded-[2rem] border border-white/10 bg-slate-950/92 p-7 text-white shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {view === "main" && (
          <>
            <div className="text-[16px] font-bold uppercase tracking-[0.28em] text-cyan-300/90">Game Paused</div>
            <h1 className="mt-1 text-[clamp(3rem,7vw,4.5rem)] font-black tracking-[-0.05em] leading-none">Paused</h1>
            <div className="mt-2 text-[18px] text-white/60">Pick an option to continue.</div>
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
