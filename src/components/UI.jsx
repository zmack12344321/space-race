import { atom, useAtom } from "jotai";
import {
  isHost,
  myPlayer,
  startMatchmaking,
  useMultiplayerState,
  usePlayerState,
  usePlayersList,
} from "../multiplayer/party";
import { useEffect, useState } from "react";
import { Joystick, VirtualButton } from "ecctrl/input";
import { VEHICLE_MODELS } from "./vehicleConfig";
import { EcctrlControlPanel } from "./EcctrlControlPanel";
import { useIsTouchDevice } from "./useIsTouchDevice";

export const NameEditingAtom = atom(false);

export const UI = () => {
  const me = myPlayer();
  const [gameState, setGameState] = useMultiplayerState("gameState", "lobby");
  const [loadingSlide, setLoadingSlide] = useState(true);
  const [nameEditing, setNameEditing] = useAtom(NameEditingAtom);
  const isTouchDevice = useIsTouchDevice();
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

  useEffect(() => {
    setLoadingSlide(true);
    if (gameState !== "loading") {
      const timeout = setTimeout(() => {
        setLoadingSlide(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [gameState]);

  usePlayersList(true);

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
      <div
        className={`fixed z-30 top-0 left-0 right-0 h-screen bg-white flex items-center justify-center gap-1 text-5xl pointer-events-none transition-transform duration-500
      ${loadingSlide ? "" : "translate-y-[100%]"}
      `}
      >
        VROOM, VROOM
        <img src={`images/vehicles/${VEHICLE_MODELS[loadingContent]}.png`} />
      </div>
      {gameState === "game" && <EcctrlControlPanel />}
      {me && <BoardSelector me={me} />}
      {gameState === "game" && isTouchDevice && <EcctrlTouchControls />}
      {gameState === "lobby" && isHost() && (
        <div className="fixed bottom-4 right-4 z-10 flex flex-col gap-2 items-end">
          <button
            className="px-4 py-2 bg-gray-100 text-black text-lg rounded-md"
            onClick={() => {
              setGameState("loading");
              setTimeout(() => {
                setGameState("game");
              }, 500);
            }}
          >
            Private
          </button>
          <button
            className="px-8 py-2 bg-gray-100 text-black text-2xl rounded-md"
            onClick={async () => {
              setGameState("loading");
              await startMatchmaking();
              setGameState("game");
            }}
          >
            Online
          </button>
        </div>
      )}
      <div className="z-20 fixed top-4 right-4 flex flex-col items-end gap-2">
        <button
          className="px-8 py-2 bg-gray-100 text-black text-2xl rounded-md flex items-center gap-2"
          onClick={invite}
          disabled={invited}
        >
          {invited ? "Link copied to clipboard" : "Invite"}
        </button>
        {gameState === "game" && (
          <button
            className="px-8 py-2 bg-gray-100 text-black text-2xl rounded-md flex items-center gap-2"
            onClick={respawn}
          >
            Respawn
          </button>
        )}
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
              className="px-8 py-2 bg-red-400 text-white text-2xl rounded-md"
              onClick={() => {
                setNameEditing(false);
              }}
            >
              ✗
            </button>
            <button
              className="px-8 py-2 bg-green-400 text-white text-2xl rounded-md"
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
    <Joystick id="left" joystickWrapperStyle={{ left: "0", bottom: "0" }} />
    <VirtualButton id="b1" label="Rev" buttonWrapperStyle={{ right: "100px", bottom: "30px" }} />
    <VirtualButton id="b2" label="Jump" buttonWrapperStyle={{ right: "40px", bottom: "70px" }} />
    <VirtualButton id="b3" label="Gas" buttonWrapperStyle={{ right: "100px", bottom: "110px" }} />
    <VirtualButton id="b4" label="Brake" buttonWrapperStyle={{ right: "40px", bottom: "160px" }} />
  </>
);

const VehicleThumb = ({ model }) => {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <span className="flex items-center justify-center w-full h-full text-[10px] leading-tight text-center text-slate-700 px-1">
        {model}
      </span>
    );
  }
  return (
    <img
      src={`/images/vehicles/${model}.png`}
      alt={model}
      className="w-full h-full"
      onError={() => setErr(true)}
    />
  );
};

const BoardSelector = ({ me }) => {
  const [vehicle] = usePlayerState(me, "vehicle");
  return (
    <div
      className={
        "fixed z-10 bottom-4 left-1/2 flex flex-wrap justify-center items-center gap-2.5 -translate-x-1/2 w-full max-w-[75vw]"
      }
    >
      {VEHICLE_MODELS.map((model, idx) => (
        <div
          key={model}
          className={`min-w-14 min-h-14 w-14 h-14 bg-white bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-full shadow-md cursor-pointer overflow-hidden
            ${
              vehicle === model ||
              (!vehicle && idx === 0)
                ? "ring-4 ring-blue-500"
                : ""
            }
            `}
          onClick={() => me.setState("vehicle", model)}
        >
          <VehicleThumb model={model} />
        </div>
      ))}
    </div>
  );
};
