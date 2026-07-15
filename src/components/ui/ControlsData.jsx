import { useEffect, useRef } from "react";

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

const PromptGroup = ({ icons, label }) => (
  <div className="flex items-center gap-1.5 sm:gap-2">
    {icons.map((src) => (
      <PromptBadge key={src} src={src} alt={label} />
    ))}
  </div>
);

export function ControlsScreen({ onBack }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0);
  }, [scrollRef]);

  return (
    <div className="flex max-h-[min(86vh,52rem)] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[16px] font-bold uppercase tracking-[0.28em] text-cyan-300/90">Controls</div>
          <h2 className="mt-1 text-[clamp(2.4rem,6vw,4rem)] font-black tracking-[-0.05em] leading-none">How to Play</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="ui-button shrink-0 rounded-full border border-white/10 bg-white/[0.08] px-5 py-3 text-[16px] font-black uppercase tracking-[0.16em] text-white"
        >
          Back
        </button>
      </div>

      <div ref={scrollRef} className="mt-6 grid gap-4 overflow-y-auto pr-1 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-[18px] font-bold uppercase tracking-[0.22em] text-white/55">Keyboard & Mouse</div>
          </div>
          <div className="space-y-2.5">
            {CONTROL_ROWS.map((row) => (
              <div key={`keyboard-${row.label}`} className="grid grid-cols-[minmax(8rem,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-5 py-4">
                <div>
                  <div className="text-[20px] font-black uppercase tracking-[0.16em] text-white">{row.label}</div>
                  <div className="text-[16px] text-white/58">{row.help}</div>
                </div>
                <PromptGroup icons={row.keyboard} label={`${row.label} keyboard prompt`} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-[18px] font-bold uppercase tracking-[0.22em] text-white/55">Xbox Series</div>
          </div>
          <div className="space-y-2.5">
            {CONTROL_ROWS.map((row) => (
              <div key={`xbox-${row.label}`} className="grid grid-cols-[minmax(8rem,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-5 py-4">
                <div>
                  <div className="text-[20px] font-black uppercase tracking-[0.16em] text-white">{row.label}</div>
                  <div className="text-[16px] text-white/58">{row.help}</div>
                </div>
                <PromptGroup icons={row.xbox} label={`${row.label} controller prompt`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
