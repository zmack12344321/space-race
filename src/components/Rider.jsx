import { Dog } from "./Dog";
import { Board } from "./Board";
import { BOARD_MAP } from "./boardConfig";

// SINGLE exported component = the one Triplex scene (no Component Switcher
// clutter) AND the production rider used by CarController/Lobby.
//
// - `preview` (default true): mounts ALL boards so Triplex can show/tune each
//   one. Production passes preview={false} so only the selected board's GLB
//   loads (lean).
// - `showDog` / `showBoard`: let the lobby render the dog statically while only
//   the board spins during a swap, without duplicating transform logic.
export function Car({
  model = "sedanSports",
  preview = true,
  showDog = true,
  showBoard = true,
  ...props
}) {
  const board = BOARD_MAP[model] ?? "longboard";
  return (
    <group {...props}>
      <group scale={[1, 1, 1]}>
        {showDog && (
          <group name="Dog" position={[0, 0.98, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
            <Dog />
          </group>
        )}
        {showBoard && (
          <>
            {preview || board === "longboard" ? (
              <group name="Longboard" scale={[1.42, 1.42, 1.42]} rotation={[0, 0, 0]} position={[0, 0.84, 0]}>
                <Board model="longboard" />
              </group>
            ) : null}
            {preview || board === "skateboard" ? (
               <group name="Skateboard" scale={[6.517, 6.517, 6.517]} rotation={[0, Math.PI / 2, 0]} position={[0, -0.704, 0]}>
                <Board model="skateboard" />
              </group>
            ) : null}
            {preview || board === "surfboard_lucid_sn1" ? (
               <group name="Surfboard" scale={[1.125, 1.125, 1.125]} rotation={[0, 0, 0]} position={[0, -0.558, 0]}>
                <Board model="surfboard_lucid_sn1" />
              </group>
            ) : null}
            {preview || board === "arcadia_longboard" ? (
               <group name="ArcadiaLongboard" scale={[0.0515, 0.0515, 0.0515]} rotation={[0, Math.PI / 2, 0]} position={[0, -25.7, 0]}>
                <Board model="arcadia_longboard" />
              </group>
            ) : null}
          </>
        )}
      </group>
    </group>
  );
}
