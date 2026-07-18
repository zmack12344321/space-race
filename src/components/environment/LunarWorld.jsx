import { useEffect, useRef } from "react";
import { useCustomGravity } from "ecctrl/gravity";
import { Physics, CuboidCollider, RigidBody } from "@react-three/rapier";
import { Vector3 } from "three";
import { RiderController } from "../vehicles/RiderController";
import { LaserSystem } from "../vehicles/LaserSystem";
import { LunarEnvironment } from "./LunarEnvironment";
import { LunarTerrain, clearLunarTerrainCaches } from "./LunarTerrain";
import { LunarRocks, clearRockFieldCache } from "./LunarRocks";
import { RaceCourse } from "./RaceCourse";
import { getLunarHeight } from "../../utils/lunarHeightfield";

function GravitySetup() {
  const setGravityField = useCustomGravity((state) => state.setGravityField);
  const gravity = useRef(new Vector3(0, -9.81, 0));

  useEffect(() => {
    setGravityField(() => gravity.current);
  }, [setGravityField]);

  return null;
}

function LunarMotion({ players, debugMode }) {
  return (
    <>
      {players.map(({ state, controls }) => (
        <RiderController
          key={state.id}
          state={state}
          controls={controls}
          getGroundHeight={getLunarHeight}
          testSpawn={false}
          debugMode={debugMode}
        />
      ))}
      <LaserSystem getGroundHeight={getLunarHeight} />
    </>
  );
}

export function LunarWorld({
  seed,
  sunAngle,
  skyMode,
  starsMode,
  raceMode,
  renderDistance,
  paused,
  physicsDebug,
  debugMode,
  players,
}) {
  useEffect(() => {
    clearLunarTerrainCaches();
    clearRockFieldCache();
  }, [seed]);

  return (
    <>
      <LunarEnvironment seed={seed} sunAngle={sunAngle} skyMode={skyMode} starsMode={starsMode} />
      <Physics key={seed} gravity={[0, 0, 0]} debug={physicsDebug} paused={paused}>
        <GravitySetup />
        <LunarTerrain seed={seed} visualRadiusBoost={Math.max(0, renderDistance - 9)} />
        <LunarRocks seed={seed} clearRadius={raceMode ? 18 : 0} visualRadiusBoost={Math.max(0, renderDistance - 9)} />
        <RaceCourse seed={seed} enabled={raceMode} />
        <LunarMotion players={players} debugMode={debugMode} />
      </Physics>
    </>
  );
}
