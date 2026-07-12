import { Dog } from "./Dog";
import { Vehicle } from "./Vehicle";
import { VEHICLE_MAP, VEHICLE_GLB_MODELS, VEHICLE_TRANSFORMS } from "./vehicleConfig";

// SINGLE exported component = the one Triplex scene (no Component Switcher
// clutter) AND the production rider used by RiderController/Lobby.
//
// A "rider" is the dog + the vehicle it rides (board / ufo / go-kart / ...).
//
// - `preview` (default true): mounts ALL vehicles so Triplex can show/tune each
//   one. Production passes preview={false} so only the selected vehicle's GLB
//   loads (lean).
// - `showDog` / `showVehicle`: let the lobby render the dog statically while
//   only the vehicle spins during a swap, without duplicating transform logic.
export function Rider({
  model = "sedanSports",
  preview = true,
  showDog = true,
  showVehicle = true,
  ...props
}) {
  const vehicleGlb = VEHICLE_MAP[model] ?? "longboard";
  const list = preview ? VEHICLE_GLB_MODELS : [vehicleGlb];
  return (
    <group {...props}>
      <group scale={[1, 1, 1]}>
        {showDog && (
          <group name="Dog" position={[0, 0.98, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
            <Dog />
          </group>
        )}
        {showVehicle &&
          list.map((glbId) => {
            const t = VEHICLE_TRANSFORMS[glbId] ?? {};
            return (
              <group
                key={glbId}
                name={glbId}
                scale={t.scale ?? [1, 1, 1]}
                rotation={t.rotation ?? [0, 0, 0]}
                position={t.position ?? [0, 0, 0]}
              >
                <Vehicle model={glbId} />
              </group>
            );
          })}
      </group>
    </group>
  );
}
