import { atom, useAtom } from "jotai";
import {
  isHost,
  leaveRoom,
  myPlayer,
  rejoin,
  setLocalGameState,
  startMatchmaking,
  useMultiplayerState,
  usePlayerState,
  usePlayersList,
} from "../../multiplayer/party";
import { useEffect, useRef, useState } from "react";
import { Joystick, VirtualButton } from "ecctrl/input";
import { VEHICLE_MODELS, VEHICLE_THUMBNAILS } from "../vehicles/vehicleConfig";
import { PauseMenu } from "./PauseMenu";
import { PhysicsDebugAtom, GameReadyAtom } from "./debugState";
import { useIsTouchDevice } from "./useIsTouchDevice";
import { getLunarSeed, setLunarSeed } from "../../utils/lunarHeightfield";
import { useGamepadRef } from "./gamepadStore";
import { BoostMeter } from "./BoostMeter";

export const NameEditingAtom = atom(false);
export const GameMenuOpenAtom = atom(false);

const LOADING_STARS = [
  { cx: 6, cy: 14, r: 1.6, delay: "0s" },
  { cx: 11, cy: 26, r: 1.1, delay: "0.7s" },
  { cx: 17, cy: 9, r: 1.8, delay: "1.4s" },
  { cx: 24, cy: 18, r: 0.9, delay: "0.5s" },
  { cx: 31, cy: 11, r: 1.4, delay: "1.1s" },
  { cx: 39, cy: 24, r: 1.2, delay: "0.2s" },
  { cx: 47, cy: 15, r: 2.0, delay: "1.8s" },
  { cx: 56, cy: 7, r: 1.0, delay: "0.9s" },
  { cx: 64, cy: 18, r: 1.7, delay: "0.4s" },
  { cx: 71, cy: 12, r: 1.0, delay: "1.2s" },
  { cx: 79, cy: 25, r: 1.5, delay: "0.3s" },
  { cx: 86, cy: 10, r: 1.2, delay: "1.6s" },
  { cx: 92, cy: 21, r: 1.7, delay: "0.8s" },
];

const LOADING_RIDGES = [
  "M0 72 C14 66 22 60 34 62 C46 64 54 76 67 74 C80 72 89 60 100 64",
  "M0 80 C10 74 18 70 29 72 C40 74 47 83 58 81 C68 79 78 70 88 72 C94 73 98 76 100 78",
  "M0 88 C15 82 22 79 33 80 C44 81 52 90 63 88 C74 86 83 79 93 81 C96 82 98 84 100 86",
];

function CompactSlider({ label, value, min, max, step, onChange }) {
  return (
    <label className="pointer-events-auto flex flex-col gap-1 rounded-md bg-black/50 px-3 py-2 text-white backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-white">{Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="game-slider w-56 cursor-pointer"
      />
    </label>
  );
}

function LoadingBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(94,234,212,0.14),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(168,85,247,0.2),transparent_24%),radial-gradient(circle_at_50%_78%,rgba(14,165,233,0.08),transparent_36%),linear-gradient(180deg,#050816_0%,#03040b_52%,#010205_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/10 via-cyan-300/0 to-transparent load-drift" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d6fbff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#67e8f9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="violetGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0abfc" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ridgeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#f0abfc" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.2" />
          </linearGradient>
          <filter id="softBlur">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        <g className="load-drift">
          <circle cx="80" cy="18" r="12" fill="url(#moonGlow)" className="load-glow" />
          <circle cx="80" cy="18" r="5.5" fill="#e6fdff" fillOpacity="0.94" />
          <circle cx="21" cy="23" r="6.5" fill="url(#violetGlow)" className="load-glow load-drift-reverse" />
        </g>

        <g>
          {LOADING_STARS.map((star) => (
            <circle
              key={`${star.cx}-${star.cy}`}
              cx={star.cx}
              cy={star.cy}
              r={star.r}
              fill="#e7fdff"
              opacity="0.9"
              className="load-star"
              style={{ animationDelay: star.delay }}
            />
          ))}
        </g>

        <path
          d="M13 46 C26 40, 35 41, 47 46 C57 51, 66 52, 78 47 C86 44, 92 39, 100 40"
          fill="none"
          stroke="url(#ridgeStroke)"
          strokeWidth="0.9"
          className="load-dash"
        />
        <path
          d="M5 54 C18 48, 27 50, 37 56 C47 62, 61 62, 72 56 C83 49, 90 49, 100 53"
          fill="none"
          stroke="url(#ridgeStroke)"
          strokeWidth="0.7"
          className="load-dash load-dash-slow"
        />

        {LOADING_RIDGES.map((d, index) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke={index === 1 ? "rgba(34,211,238,0.28)" : "rgba(240,171,252,0.18)"}
            strokeWidth={index === 1 ? "0.75" : "0.6"}
            className="load-dash"
          />
        ))}

        <path
          d="M0 87 C12 82 24 79 36 81 C47 83 56 90 68 89 C80 88 88 80 100 82 L100 100 L0 100 Z"
          fill="rgba(3,6,17,0.92)"
        />
        <path
          d="M0 89 C11 86 24 83 37 85 C48 87 57 93 68 92 C80 91 90 84 100 86"
          fill="none"
          stroke="rgba(125,211,252,0.22)"
          strokeWidth="0.8"
          className="load-dash load-dash-slow"
          filter="url(#softBlur)"
        />

        <path
          d="M66 30 C73 25 80 24 86 28"
          fill="none"
          stroke="rgba(231,253,255,0.6)"
          strokeWidth="0.45"
          strokeLinecap="round"
          className="load-comet"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/80 to-transparent" />
    </div>
  );
}

function WarpStarfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let lastTime = performance.now();

    const STAR_COUNT = 420;
    const DEPTH = 1000;
    const FOCAL = 320;
    const stars = [];

    const palette = [
      [231, 253, 255],
      [103, 232, 249],
      [168, 85, 247],
      [125, 211, 252],
      [240, 171, 252],
    ];

    const resetStar = (star, fromFar = false) => {
      star.x = (Math.random() - 0.5) * width * 1.6;
      star.y = (Math.random() - 0.5) * height * 1.6;
      star.z = fromFar ? DEPTH : Math.random() * DEPTH;
      star.pz = star.z;
      star.color = palette[(Math.random() * palette.length) | 0];
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      resize();
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        const star = {};
        resetStar(star, false);
        stars.push(star);
      }
    };

    const cx = () => width / 2;
    const cy = () => height / 2;

    const render = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      const speed = prefersReducedMotion ? 60 : 360;

      for (const star of stars) {
        star.pz = star.z;
        star.z -= speed * dt;
        if (star.z <= 1) {
          resetStar(star, true);
          continue;
        }

        const sx = cx() + (star.x / star.z) * FOCAL;
        const sy = cy() + (star.y / star.z) * FOCAL;
        const psx = cx() + (star.x / star.pz) * FOCAL;
        const psy = cy() + (star.y / star.pz) * FOCAL;

        if (
          sx < -50 || sx > width + 50 ||
          sy < -50 || sy > height + 50
        ) {
          if (star.z < DEPTH * 0.5) {
            resetStar(star, true);
            continue;
          }
        }

        const depth = 1 - star.z / DEPTH;
        const radius = Math.max(0.4, depth * 2.4);
        const alpha = Math.min(1, depth * 1.4 + 0.1);
        const [r, g, b] = star.color;

        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = radius;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(psx, psy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha + 0.2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        raf = requestAnimationFrame(render);
      }
    };

    init();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

function TitleScreen({ onEnterLobby }) {
  return (
    <div className="fixed inset-0 z-40 isolate overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(103,232,249,0.16),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(168,85,247,0.16),transparent_26%),linear-gradient(180deg,#02040a_0%,#050816_42%,#010205_100%)]" />
      <WarpStarfield />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_38%,rgba(2,4,10,0.55)_100%)] pointer-events-none" />
      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <div className="text-[clamp(4rem,14vw,8.5rem)] font-black uppercase tracking-[0.22em] text-white drop-shadow-[0_0_28px_rgba(103,232,249,0.25)]">
            Space Race
          </div>
          <div className="mx-auto mt-4 max-w-xl text-[clamp(1rem,2.2vw,1.5rem)] text-white/75">
            Dog-powered moon boards, neon dust, and a lobby full of weird little hovercraft.
          </div>
          <div className="mt-8 flex justify-center">
            <button className="ui-button px-10 py-4 bg-gray-100 text-black text-2xl sm:text-4xl rounded-full touch-manipulation" onClick={onEnterLobby}>
              Enter Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const UI = () => {
  const me = myPlayer();
  const [gameState, setGameState] = useMultiplayerState("gameState", "title");
  const [loadingSlide, setLoadingSlide] = useState(true);
  const [nameEditing, setNameEditing] = useAtom(NameEditingAtom);
  const [menuOpen, setMenuOpen] = useAtom(GameMenuOpenAtom);
  const [physicsDebug, setPhysicsDebug] = useAtom(PhysicsDebugAtom);
  const [gameReady, setGameReady] = useAtom(GameReadyAtom);
  const isPreviewMode = new URL(window.location.href).searchParams.get("preview") === "1";
  const [lunarSeed, setRoomLunarSeed] = useMultiplayerState("lunarSeed", getLunarSeed());
  const [lobbyFlatRadius, setLobbyFlatRadius] = useMultiplayerState("lobbyFlatRadius", 85);
  const [lobbyFlatFalloff, setLobbyFlatFalloff] = useMultiplayerState("lobbyFlatFalloff", 277);
  const [sunAngle, setSunAngle] = useMultiplayerState("sunAngle", 0.87);
  const lobbyActionRefs = useRef([]);
  const gamepadRef = useGamepadRef();
  const isTouchDevice = useIsTouchDevice();
  const isTestMode = window.location.pathname.startsWith("/test");
  const [nameInput, setNameInput] = useState(
    me?.getState("name") || me?.state.profile.name
  );

  const [invited, setInvited] = useState(false);

  const invite = () => {
    navigator.clipboard.writeText(window.location.href);
    setInvited(true);
    setTimeout(() => setInvited(false), 2000);
  };

  const respawn = () => {
    me?.setState("_respawnAt", Date.now());
  };

  const enterLobby = () => {
    rejoin();
    setGameState("lobby");
  };

  // Request mouse capture during a user gesture (starting/resuming). Pointer
  // lock can only be acquired from within a gesture, so we trigger it from the
  // buttons rather than waiting for a separate canvas click.
  const requestGamePointerLock = () => {
    if (gamepadRef.current.connected) return;
    const canvas = document.querySelector("canvas");
    if (canvas && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can be rejected (e.g. right after Esc); ignored.
      }
    }
  };

  const randomizeSeed = () => {
    const nextSeed = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
      : Math.floor(Math.random() * 2147483647);
    setRoomLunarSeed(nextSeed);
  };

  useEffect(() => {
    if (!isPreviewMode) return;
    setLunarSeed(lunarSeed);
  }, [isPreviewMode, lunarSeed]);

  useEffect(() => {
    if (gameState === "game") {
      setLoadingSlide(!gameReady);
    } else if (gameState === "loading") {
      setLoadingSlide(true);
      setGameReady(false);
    } else {
      setLoadingSlide(false);
      setGameReady(false);
    }
  }, [gameState, gameReady, setGameReady]);

  useEffect(() => {
    if (gameState !== "game") {
      setMenuOpen(false);
    }
  }, [gameState, setMenuOpen]);

  useEffect(() => {
    if (gameState !== "game" || menuOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    let raf = 0;
    const tick = () => {
      const pad = gamepadRef.current;
      if (pad.justPressed.start) {
        setMenuOpen((value) => !value);
      }
      if (isTestMode && pad.justPressed.back) {
        setPhysicsDebug((value) => !value);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [gameState, menuOpen, isTestMode, setMenuOpen, setPhysicsDebug, gamepadRef]);

  usePlayersList(true);

  useEffect(() => {
    if (gameState !== "title") return;

    let raf = 0;
    const tick = () => {
      const pad = gamepadRef.current;
      if (pad.justPressed.a || pad.justPressed.start) {
        enterLobby();
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameState, setGameState, gamepadRef]);

  useEffect(() => {
    if (gameState !== "lobby" || !isHost()) return;

    const focusLobbyAction = (index) => {
      lobbyActionRefs.current[index]?.focus();
    };

    const triggerLobbyAction = (index) => {
      lobbyActionRefs.current[index]?.click();
    };

    const onKeyDown = (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        focusLobbyAction(0);
      }
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        focusLobbyAction(1);
      }
      if (event.key === "Enter" || event.key === "Space") {
        const active = document.activeElement;
        if (lobbyActionRefs.current.includes(active)) {
          event.preventDefault();
          active.click();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    let raf = 0;
    const tick = () => {
      const pad = gamepadRef.current;

      if (pad.justPressed.left || pad.justPressed.up) focusLobbyAction(0);
      if (pad.justPressed.right || pad.justPressed.down) focusLobbyAction(1);
      if (pad.justPressed.a) {
        const active = document.activeElement;
        if (lobbyActionRefs.current.includes(active)) {
          active.click();
        } else {
          triggerLobbyAction(1);
        }
      }

      if (pad.justPressed.start) triggerLobbyAction(1);
      if (pad.justPressed.b) setLocalGameState("title");
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [gameState, isHost, setGameState, gamepadRef]);

  const [loadingContent, setLoadingContent] = useState(0);
  useEffect(() => {
    if (loadingSlide) {
      const interval = setInterval(() => {
        setLoadingContent((prev) => (prev + 1) % VEHICLE_MODELS.length);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [loadingSlide]);

  return (
    <>
       {gameState === "title" && <TitleScreen onEnterLobby={enterLobby} />}
      {gameState === "loading" && loadingSlide && (
      <div
        className={`fixed z-30 inset-0 bg-black text-white flex flex-col items-center justify-center gap-6 pointer-events-none transition-transform duration-500 isolate
        ${loadingSlide ? "" : "translate-y-[100%]"}
        `}
      >
        <LoadingBackdrop />
        <div className="relative z-10 flex flex-col items-center gap-6 px-4 py-8 text-center">
          <div className="text-5xl sm:text-7xl font-black tracking-[0.22em] uppercase text-white drop-shadow-[0_0_24px_rgba(103,232,249,0.35)]">
            Get Ready
          </div>
          <div className="relative w-[min(76vw,30rem)] overflow-visible rounded-[1.75rem] border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-md">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_50%_75%,rgba(168,85,247,0.1),transparent_40%)]" />
            <img
              src={`/images/loading-vehicles/${VEHICLE_THUMBNAILS[VEHICLE_MODELS[loadingContent]] ?? VEHICLE_MODELS[loadingContent]}.png`}
              alt={VEHICLE_MODELS[loadingContent]}
              className="relative z-10 mx-auto h-[min(88vw,34rem)] w-[min(88vw,34rem)] -translate-y-5 object-contain load-float drop-shadow-[0_0_34px_rgba(103,232,249,0.22)]"
            />
          </div>
        </div>
      </div>
      )}
      {gameState === "game" && !loadingSlide && (
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={menuOpen ? "Resume" : "Pause"}
          className="ui-button pointer-events-auto fixed left-4 top-4 z-50 px-8 py-2 bg-gray-100 text-black text-2xl rounded-md flex items-center gap-2"
        >
          {menuOpen ? "Resume" : "Menu"}
        </button>
      )}
      {gameState === "game" && (
        <PauseMenu
          open={menuOpen}
          onResume={() => {
            setMenuOpen(false);
            requestGamePointerLock();
          }}
          onQuit={() => leaveRoom()}
          vehicleModel={me?.getState("vehicle") || "longboard"}
        />
      )}
      {me && <BoardSelector me={me} menuOpen={menuOpen} />}
      {gameState === "game" && !menuOpen && <BoostMeter />}
      {gameState === "game" && isTouchDevice && <EcctrlTouchControls />}
      {gameState === "lobby" && isHost() && (
        <div className="fixed bottom-4 right-4 z-10 w-[min(92vw,24rem)] flex flex-col gap-3 items-stretch sm:items-end">
          <button
            ref={(el) => { lobbyActionRefs.current[0] = el; }}
            className="ui-button min-h-14 w-full sm:w-auto px-5 py-4 bg-gray-100 text-black text-2xl sm:text-3xl rounded-md touch-manipulation"
            onClick={() => {
              requestGamePointerLock();
              setGameState("loading");
              setTimeout(() => {
                setGameState("game");
              }, 500);
            }}
          >
            Practice
          </button>
          <button
            ref={(el) => { lobbyActionRefs.current[1] = el; }}
            className="ui-button min-h-14 w-full sm:w-auto px-6 py-4 bg-gray-100 text-black text-2xl rounded-md touch-manipulation"
            onClick={async () => {
              requestGamePointerLock();
              setGameState("loading");
              await startMatchmaking();
              setGameState("game");
            }}
          >
            Start
          </button>
        </div>
      )}
      {gameState === "lobby" && isHost() && isPreviewMode && (
        <div className="fixed top-4 left-4 z-20 flex flex-col items-start gap-2">
          <button
            className="ui-button min-h-14 px-8 py-3 bg-gray-100 text-black text-2xl rounded-md flex items-center gap-2 touch-manipulation"
            onClick={randomizeSeed}
          >
            Regenerate
          </button>
          <div className="px-3 py-1 rounded bg-black/50 text-white text-xs tracking-wide backdrop-blur-sm">
            Seed: {lunarSeed}
          </div>
          <CompactSlider label="Flat Zone" value={lobbyFlatRadius} min={0} max={400} step={1} onChange={setLobbyFlatRadius} />
          <CompactSlider label="Falloff" value={lobbyFlatFalloff} min={0} max={400} step={1} onChange={setLobbyFlatFalloff} />
          <CompactSlider label="Sun Angle" value={sunAngle} min={0} max={1} step={0.001} onChange={setSunAngle} />
        </div>
      )}
      <div className="z-20 fixed top-4 right-4 flex flex-col items-end gap-2">
        <button
          className="ui-button min-h-14 px-8 py-3 bg-gray-100 text-black text-2xl sm:text-3xl rounded-md flex items-center gap-2 touch-manipulation"
          onClick={invite}
          disabled={invited}
        >
          {invited ? "Link copied to clipboard" : "Invite"}
        </button>
        {gameState === "game" && (
          <button
            className="ui-button min-h-14 px-8 py-3 bg-gray-100 text-black text-2xl sm:text-3xl rounded-md flex items-center gap-2 touch-manipulation"
            onClick={respawn}
          >
            Respawn
          </button>
        )}
        {isTestMode && gameState === "game" && (
          <button
            className={`ui-button min-h-14 px-8 py-3 text-2xl sm:text-3xl rounded-md flex items-center gap-2 touch-manipulation ${physicsDebug ? "bg-cyan-300 text-black" : "bg-gray-100 text-black"}`}
            onClick={() => setPhysicsDebug((value) => !value)}
          >
            {physicsDebug ? "Debug On" : "Debug Off"}
          </button>
        )}
        {isTestMode && gameState === "game" && me && <VehicleDebugHUD me={me} />}
      </div>
      {nameEditing && (
        <div className="fixed z-20 inset-0 flex items-center justify-center flex-col gap-2 bg-black bg-opacity-20 backdrop-blur-sm">
          <input
            autoFocus
            className="p-3"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                me?.setState("name", nameInput);
                setNameEditing(false);
              }
            }}
          />
          <div className="flex items-center gap-2">
            <button
              className="ui-button px-8 py-2 bg-red-400 text-white text-2xl sm:text-3xl rounded-md"
              onClick={() => {
                setNameEditing(false);
              }}
            >
              ✗
            </button>
            <button
              className="ui-button px-8 py-2 bg-green-400 text-white text-2xl sm:text-3xl rounded-md"
              onClick={() => {
                me?.setState("name", nameInput);
                setNameEditing(false);
              }}
            >
              ✓
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const EcctrlTouchControls = () => (
  <>
    <Joystick id="left" joystickWrapperStyle={{ left: "12px", bottom: "12px" }} />
    <VirtualButton id="b1" label="Rev" buttonWrapperStyle={{ right: "112px", bottom: "34px" }} />
    <VirtualButton id="b2" label="Jump" buttonWrapperStyle={{ right: "40px", bottom: "78px" }} />
    <VirtualButton id="b3" label="Gas" buttonWrapperStyle={{ right: "112px", bottom: "122px" }} />
    <VirtualButton id="b4" label="Brake" buttonWrapperStyle={{ right: "40px", bottom: "176px" }} />
  </>
);

const VehicleThumb = ({ model }) => {
  const [err, setErr] = useState(false);
  const thumbModel = VEHICLE_THUMBNAILS[model] ?? model;
  if (err) {
    return (
      <span className="flex items-center justify-center w-full h-full text-[10px] leading-tight text-center text-slate-700 px-1">
        {model}
      </span>
    );
  }
  return (
    <img
      src={`/images/vehicles/${thumbModel}.png`}
      alt={model}
      className="vehicle-thumb-art w-full h-full"
      onError={() => setErr(true)}
    />
  );
};

const VehicleDebugHUD = ({ me }) => {
  const [debug] = usePlayerState(me, "_debug");
  if (!debug) return null;

  const copyPayload = async () => {
    const text = JSON.stringify(debug, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
    }
  };

  const rows = [
    ["vehicle", debug.vehicleModel],
    ["speed", `${Number(debug.speed ?? 0).toFixed(2)} m/s`],
    ["vertical", `${Number(debug.verticalSpeed ?? 0).toFixed(2)} m/s`],
    ["rpm", debug.engineRPM != null ? Math.round(debug.engineRPM) : "-"],
    ["gear", debug.gearIndex != null ? debug.gearIndex : "-"],
    ["drive", debug.driveRatio != null ? Number(debug.driveRatio).toFixed(2) : "-"],
    ["grounded", debug.isOnGround ? "yes" : "no"],
    ["boost", debug.boosting ? "yes" : "no"],
    ["preset", debug.presetName || "-"],
    ["pos", debug.position ? `${debug.position.x.toFixed(2)}, ${debug.position.y.toFixed(2)}, ${debug.position.z.toFixed(2)}` : "-"],
    ["linvel", debug.linvel ? `${debug.linvel.x.toFixed(2)}, ${debug.linvel.y.toFixed(2)}, ${debug.linvel.z.toFixed(2)}` : "-"],
    ["angvel", debug.angvel ? `${debug.angvel.x.toFixed(2)}, ${debug.angvel.y.toFixed(2)}, ${debug.angvel.z.toFixed(2)}` : "-"],
    ["wheels", debug.wheelsOnGround != null ? debug.wheelsOnGround : "-"],
    ["jump", debug.lastJumpAt != null ? Math.round(debug.lastJumpAt) : "-"],
  ];

  return (
    <div className="w-[min(92vw,22rem)] rounded-2xl border border-cyan-300/30 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[13px] uppercase tracking-[0.22em] text-cyan-300">Debug HUD</div>
        <button
          type="button"
          onClick={copyPayload}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[13px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10"
          title="Copy debug values"
          aria-label="Copy debug values"
        >
          ⧉
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[14px]">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">{label}</div>
            <div className="mt-1 font-mono text-[13px] text-white">{String(value)}</div>
          </div>
        ))}
      </div>
      {Array.isArray(debug.wheelSummary) && debug.wheelSummary.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">wheels</div>
          <div className="grid gap-2">
            {debug.wheelSummary.slice(0, 4).map((wheel) => (
              <div key={wheel.id} className="rounded-lg bg-white/5 px-3 py-2 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black uppercase tracking-[0.12em] text-white/75">{wheel.id}</span>
                  <span className={wheel.hit ? "text-emerald-300" : "text-rose-300"}>{wheel.hit ? "hit" : "air"}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-white/80">
                  slip {wheel.slip.toFixed(2)} | lng {wheel.lngSlip.toFixed(2)} | lat {wheel.latSlip.toFixed(2)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-white/80">
                  ang {wheel.angVel.toFixed(2)} | drive {wheel.driveTorque.toFixed(0)} | brake {wheel.brakeTorque.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const cycleIndex = (current, direction, length) => (current + direction + length) % length;

const BoardSelector = ({ me, menuOpen }) => {
  const [vehicle] = usePlayerState(me, "vehicle");
  const [hoveredModel, setHoveredModel] = useState(null);
  const gamepadRef = useGamepadRef();
  const selectVehicle = (nextIndex) => {
    me.setState("vehicle", VEHICLE_MODELS[nextIndex]);
  };
  const currentIndex = Math.max(0, VEHICLE_MODELS.indexOf(vehicle ?? VEHICLE_MODELS[0]));

  useEffect(() => {
    if (menuOpen) return;

    let raf = 0;

    const tick = () => {
      const pad = gamepadRef.current;

      if (pad.justPressed.dpadLeft) {
        selectVehicle(cycleIndex(currentIndex, -1, VEHICLE_MODELS.length));
      }
      if (pad.justPressed.dpadRight) {
        selectVehicle(cycleIndex(currentIndex, 1, VEHICLE_MODELS.length));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentIndex, menuOpen, me, gamepadRef]);

  return (
    <div
      className="fixed z-10 bottom-4 left-1/2 flex flex-wrap justify-center items-center gap-3 -translate-x-1/2 w-full max-w-[92vw] px-3 py-2"
      onMouseLeave={() => setHoveredModel(null)}
    >
      {VEHICLE_MODELS.map((model, idx) => (
        <button
          key={model}
          type="button"
          aria-pressed={vehicle === model || (!vehicle && idx === 0)}
          className={`vehicle-thumb-button rounded-full cursor-pointer overflow-visible border border-black/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/80 touch-manipulation
            ${hoveredModel === model ? "is-hovered" : ""}
            ${
              vehicle === model ||
              (!vehicle && idx === 0)
                ? "is-active"
                : ""
            }
            `}
            style={{
              width: hoveredModel === model ? "120px" : "72px",
              height: hoveredModel === model ? "120px" : "72px",
              transform:
                hoveredModel == null
                  ? vehicle === model || (!vehicle && idx === 0)
                    ? "scale(1.03)"
                    : "scale(1)"
                  : hoveredModel === model
                    ? "scale(1)"
                    : "scale(1)",
              zIndex: hoveredModel === model ? 60 : vehicle === model ? 20 : 1,
              position: "relative",
              flex: "0 0 auto",
              transformOrigin: "center center",
            }}
          onClick={() => me.setState("vehicle", model)}
          onMouseEnter={() => setHoveredModel(model)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              selectVehicle(cycleIndex(idx, -1, VEHICLE_MODELS.length));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              selectVehicle(cycleIndex(idx, 1, VEHICLE_MODELS.length));
            }
          }}
        >
          <span className="vehicle-thumb-stage">
            <VehicleThumb model={model} />
          </span>
        </button>
      ))}
    </div>
  );
};
