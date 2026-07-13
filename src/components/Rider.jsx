import { Dog } from "./Dog";
import { Vehicle } from "./Vehicle";
import { VEHICLE_MAP } from "./vehicleConfig";

// SINGLE exported component = the one Triplex scene (no Component Switcher
// clutter) AND the production rider used by RiderController/Lobby.
//
// A "rider" is the dog + the vehicle it rides (board / ufo / go-kart / ...).
//
// Each vehicle is its OWN named literal <group> with literal position/rotation/
// scale props — that is what makes them individually draggable/tunable in
// Triplex. Do NOT move these transforms into a JS config object: Triplex cannot
// see or edit transforms that are computed from variables.
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
  return (
    <group {...props}>
      <group scale={[1, 1, 1]}>
        {showDog && (
          <group name="Dog" position={[0, 0.98, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
            <Dog />
          </group>
        )}
        {showVehicle && (
          <>
            {preview || vehicleGlb === "longboard" ? (
              <group name="Longboard" scale={[1.42, 1.42, 1.42]} rotation={[0, 0, 0]} position={[0, 0.87, 0]}>
                <Vehicle model="longboard" />
              </group>
            ) : null}
            {preview || vehicleGlb === "skateboard" ? (
              <group name="Skateboard" scale={[7.8, 7.8, 7.8]} rotation={[0, Math.PI / 2, 0]} position={[0, 0.36, 0]}>
                <Vehicle model="skateboard" />
              </group>
            ) : null}
            {preview || vehicleGlb === "surfboard_lucid_sn1" ? (
              <group name="Surfboard" scale={[1.7, 1.7, 1.7]} rotation={[2.7461615734037355, -0.476171473820599, 3.0479021033095606]} position={[0.04, 0.88, -2.33]}>
                <Vehicle model="surfboard_lucid_sn1" />
              </group>
            ) : null}
            {preview || vehicleGlb === "arcadia_longboard" ? (
              <group name="ArcadiaLongboard" scale={[0.0715, 0.0715, 0.0715]} rotation={[0, Math.PI / 2, 0]} position={[0.5, -34.692, -1.22]}>
                <Vehicle model="arcadia_longboard" />
              </group>
            ) : null}
            {preview || vehicleGlb === "ufo" ? (
              <group name="UFO" scale={[0.56, 0.56, 0.56]} rotation={[0, 0, 0]} position={[0.07, 0.3, 0.06]}>
                <Vehicle model="ufo" />
              </group>
            ) : null}
            {preview || vehicleGlb === "go-kart" ? (
              <group name="GoKart" scale={[2.48, 2.48, 2.48]} rotation={[0, 0, 0]} position={[0, 1.3, -0.7]}>
                <Vehicle model="go-kart" />
              </group>
            ) : null}
          </>
        )}
      </group>
    </group>
  );
}
