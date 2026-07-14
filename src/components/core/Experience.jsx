import { lazy, Suspense } from "react";
import { useMultiplayerState } from "../../multiplayer/party";

const Game = lazy(() => import("./Game").then(m => ({ default: m.Game })));
const Lobby = lazy(() => import("./Lobby").then(m => ({ default: m.Lobby })));

export const Experience = ({ level = "lunar", physicsDebug = false, debugMode = false }) => {
  const [gameState] = useMultiplayerState("gameState", "lobby");
  return (
    <Suspense fallback={null}>
      {gameState === "lobby" && <Lobby />}
      {gameState === "game" && <Game level={level} physicsDebug={physicsDebug} debugMode={debugMode} />}
    </Suspense>
  );
};
