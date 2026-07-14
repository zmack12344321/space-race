import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Dog } from "./Dog";
import { Vehicle } from "./Vehicle";
import { SimpleThruster } from "./SimpleThruster";
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
  model = "longboard",
  preview = true,
  showDog = true,
  showVehicle = true,
  ...props
}) {
  const vehicleGlb = VEHICLE_MAP[model] ?? "longboard";
  const isSurf = vehicleGlb === "surfboard_lucid_sn1";
  const isUfo = vehicleGlb === "ufo";
  const isHover = isSurf || isUfo;

  // gameplay (preview=false): only the selected vehicle mounts, so bob the
  // whole dog+craft wrapper together => dog + board/ufo hover as one.
  // preview (Triplex): ALL vehicles mount, so bob each hover craft on its
  // OWN group instead — keeps the go-kart / other boards planted.
  const hoverRef = useRef();
  const surfboardRef = useRef();
  const ufoRef = useRef();
  const surfboardBase = useRef(null);
  const ufoBase = useRef(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const y = Math.sin(t * 1.8) * 0.07;

    if (hoverRef.current) hoverRef.current.position.y = !preview && isHover ? y : 0;

    if (preview) {
      if (surfboardRef.current) {
        if (surfboardBase.current === null) surfboardBase.current = surfboardRef.current.position.y;
        surfboardRef.current.position.y = surfboardBase.current + (isSurf ? y : 0);
      }
      if (ufoRef.current) {
        if (ufoBase.current === null) ufoBase.current = ufoRef.current.position.y;
        ufoRef.current.position.y = ufoBase.current + (isUfo ? y : 0);
      }
    }
  });

  return (
    <group {...props}>
      <group ref={hoverRef} position={[0, preview ? 0 : -0.38, 0]} scale={[1, 1, 1]}>
        {showDog && (
          <group name="Dog" position={[0, 0.62, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
            <Dog />
          </group>
        )}
        {showVehicle && (
          <>
            {preview || vehicleGlb === "longboard" ? (
              <group name="Longboard" scale={[1.42, 1.42, 1.42]} rotation={[0, 0, 0]} position={[0, 0.67, 0]} visible={true}>
                <Vehicle model="longboard" />
              </group>
            ) : null}
            {preview || vehicleGlb === "skateboard" ? (
              <group name="Skateboard" scale={[7.8, 7.8, 7.8]} rotation={[0, Math.PI / 2, 0]} position={[0, 0.16, 0]} visible={true}>
                <Vehicle model="skateboard" />
              </group>
            ) : null}
            {preview || vehicleGlb === "surfboard_lucid_sn1" ? (
              <group name="Surfboard" ref={surfboardRef} scale={[1.7, 1.7, 1.7]} rotation={[2.7461615734037355, -0.476171473820599, 3.0479021033095606]} position={[0.04, 0.68, -2.33]} visible={true}>
                <Vehicle model="surfboard_lucid_sn1" />
                <group name="SurfboardThruster" position={[0.62164448116215, -0.52, -1.1324456314301]} rotation={[-0.3253470503033259, -0.002857105403021761, -0.16997329543111753]}>
                  <SimpleThruster color="#22e6ff" coreColor="white" intensity={3} scale={1.1} radius={0.1} height={0.42} />
                </group>
              </group>
            ) : null}
            {preview || vehicleGlb === "arcadia_longboard" ? (
              <group name="ArcadiaLongboard" scale={[0.0715, 0.0715, 0.0715]} rotation={[0, Math.PI / 2, 0]} position={[0.5, -34.892, -1.22]} visible={true}>
                <Vehicle model="arcadia_longboard" />
              </group>
            ) : null}
            {preview || vehicleGlb === "ufo" ? (
              <group name="UFO" ref={ufoRef} scale={[0.56, 0.56, 0.56]} rotation={[0, 0, 0]} position={[0.07, 0.1, 0.06]} visible={true}>
                <Vehicle model="ufo" />
                <group name="UFOThruster" position={[0, -0.2, 0]}>
                  <SimpleThruster color="#39ff88" intensity={3} scale={1.1} radius={0.07} height={0.4} />
                </group>
              </group>
            ) : null}
            {preview || vehicleGlb === "go-kart" ? (
              <group name="GoKart" scale={[2.48, 2.48, 2.48]} rotation={[0, 0, 0]} position={[0, 1.1, -0.7]} visible={true}>
                <Vehicle model="go-kart" />
                <group name="GoKartThrusters">
                  <SimpleThruster color="#39ff88" intensity={3} scale={0.9} position={[0.35, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]} radius={0.07} height={0.4} />
                  <SimpleThruster color="#39ff88" intensity={3} scale={0.9} position={[-0.35, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]} radius={0.07} height={0.4} />
                </group>
              </group>
            ) : null}
          </>
        )}
      </group>
    </group>
  );
}
