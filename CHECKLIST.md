# Space Race — Dog on a Board: Checklist

Working style: implement ONE task, report, user verifies in-game, then we move to the next. No sweeping breaking changes.

## Phase A — Dog on a board (keep it working)
- [x] A1. Copy assets: `labrador_dog.glb` -> `public/models/dog.glb`; 4 boards -> `public/models/boards/`. (keep `_assets-to-import` as the archive)
- [x] A2. `src/components/Dog.jsx` generated via gltfjsx; autoplay idle clip via `useAnimations`
- [x] A3. `Board` renderer (`useGLTF` + `<Clone>`) lives in `Car.jsx`
- [x] A4. `Car.jsx` renders `<Dog/>` + parented `<Board>` via `BOARD_MAP` (kept `CAR_MODELS`, car thumbnails, and the `car` state key untouched)
- [x] A5. **FIX spin:** lobby `CarSwitcher` spins/shrinks only `<Board>`; `<Dog/>` stays put. Also map slot->board in lobby via `BOARD_MAP` (was 404'ing on slot names).
- [x] A6. **FIX in-game selector highlight:** bottom ring now reactive via `usePlayerState(me, "car")` inside a `BoardSelector` child that only mounts when `me` exists (guards the `myPlayer()`-undefined window during Online/matchmaking, which previously crashed the tree → white screen + WebGL context loss).
- [x] A7. **FIX swap freeze:** removed `key={carModel}` from `<RigidBody>` (no remount → no respawn/teleport, in-place swap) and replaced `colliders="hull"` with a fixed `<CuboidCollider args={[0.5,0.5,0.9]} position={[0,0.4,0]}>`. One static collider covers every dog+board combo, so adding dogs (Phase B) needs zero new collider logic. Tune size in A8. (pending in-game verify)
- [x] A11. **FIX in-game white screen (`expected instance of _dA`):** root cause was a duplicate `three` bundled into `.vite/deps/@react-three_rapier.js` (Vite prebundle), breaking rapier's `instanceof Object3D` in `<RigidBody>`. `vite.config.js` now sets `resolve.dedupe: ['three','@react-three/fiber']` + `optimizeDeps.include` for the R3F stack; cleared `node_modules/.vite`. (pending in-game verify)
- [ ] A8. **Visual tune (Triplex):** dog facing/scale + per-board offsets. Now Triplex-editable — `Car.jsx` has literal transforms on the dog group and on each `<Board>` (longboard/surfboard likely correct; skateboard/arcadia best-guess). Open `Car.jsx` in Triplex and drag to tune; values write back into the JSX. (pending user tuning)
- [ ] A9. Verify in-game: dog idles, is drivable, board swaps via the lobby selector, multiplayer sync still works
- [x] A10. **Compress assets:** `gltfjsx --transform` (Draco + WebP + prune + resize) on dog + 4 boards → `*-transformed.glb` (dog 9.76→1.9 MB; boards 0.24–0.47 MB). Loaders use `useGLTF(path, true)` + `preload(path, true)` so drei wires the Draco decoder. Original uncompressed `.glb`s kept as fallback source (safe to delete once verified). Runtime Draco decoder loads from the gstatic CDN (drei default) — vendor it locally if you need offline/self-hosted.

## Phase B — Interchangeable dogs (mirror the existing swap system)
- [ ] B1. Add a `dog` PlayroomKit state key; `DOG_MODELS` list; `public/models/dogs/` folder
- [ ] B2. Generalize `Dog.jsx` -> `Dog({ model })` that loads by model + autoplays the first clip (works for any skinned dog)
- [ ] B3. Create `Rider.jsx` = `<Dog model={dog}/>` + `<Board model={board}/>` (use literal transform props so Triplex can edit them)
- [ ] B4. `CarController` reads both `board` + `dog` states -> renders `<Rider/>`
- [ ] B5. Lobby: `BoardSwitcher` (spins board) + `DogSwitcher` (spins dog)
- [ ] B6. UI: second selector row for dogs (+ dog thumbnails)

## Phase C — Polish / Triplex
- [x] C1. Triplex setup: `Car.jsx` has literal transforms on the dog group + each `<Board>` (draggable in Triplex) and a `default` export so Triplex can open it directly. **Workflow: open `Car.jsx` (NOT `App.jsx`)** — Triplex edits one R3F component, it cannot run PlayroomKit multiplayer/physics, so it won't show the live game. Draco is vendored locally so models actually load in Triplex.
- [ ] C2. Visual tune pass with Triplex; fix `skateboard` / `arcadia_longboard` board offsets
- [ ] C3. Rename identifiers (`car` -> `board`/`vehicle`) + swap `car_start` audio (later phase)

## Triplex single-scene cleanup + lobby dog-spin fix (C4)
Goal: make `Car.jsx` the ONLY exported component Triplex opens (kill the 4-option
Component Switcher clutter), fix the dog spinning on lobby swap (regression from
wrapping full `<Car>` in the spinner), and keep production lean (only the selected
board's GLB mounts). Triplex writes transforms into source; `npm run build` just
bundles that source — no baking step.
- [x] C4.1. New `src/components/boardConfig.js`: export `CAR_MODELS`, `BOARD_MAP`, `BOARD_MODELS` (moved out of `Car.jsx` so the scene file exports only a component)
- [x] C4.2. `Board.jsx`: import `BOARD_MODELS` from `./boardConfig`; keep a SINGLE export (`Board` loader, no transform); drop `export default` + `export const BOARD_MODELS`
- [x] C4.3. `Car.jsx`: remove `export default Car`, `export { Board, BOARD_MODELS }`, `export const CAR_MODELS`, `export const BOARD_MAP`. Single `export function Car` with props `preview=true`, `showDog=true`, `showBoard=true`. Each board group conditionally mounted (`preview || board===x ? <group>…</group> : null`) so production loads only the selected GLB
- [x] C4.4. `UI.jsx`: import `CAR_MODELS` from `./boardConfig` (not `./Car`)
- [x] C4.5. `Lobby.jsx` `CarSwitcher`: render `<Car showBoard={false}/>` (dog, static) + `<group ref={container}><Car showDog={false} preview={false}/></group>` (board, spins) — restores "dog still, board spins"
- [x] C4.6. `CarController.jsx`: confirm `import { Car }` + `<Car … preview={false}/>` unchanged
- [x] C4.7. `npm run build` succeeds
- [ ] C4.8. In-game verify (user): lobby swap spins only the board; dog stays put; Triplex shows exactly one "Car" scene

## Garage live editing (C5) — REAL scene, not a sandbox
Same pattern as the dog: the garage is ONE exported component (`Garage.jsx`)
that production renders AND Triplex opens, so dragging anything writes to the
source and ships. The trick: `Garage` takes `players`/`me` as props with mock
defaults so Triplex can render it standalone (Lobby can't be opened directly
because it needs a live PlayroomKit room).
- [x] C5.1. `src/components/Garage.jsx` (new, single `export function Garage`): the REAL garage scene — garage model, 3 lights, platform, and per-player riders — every movable object wrapped in a named literal group. Owns `useGLTF(garage.glb)` + shadow traverse + animated-light `useFrame` + `CarSwitcher`. Accepts `players`/`me` props (mock defaults for Triplex).
- [x] C5.2. `Lobby.jsx` slimmed to a camera/controls wrapper that renders `<Garage players={players} me={me} />`; removed scene/light/name-tag code (now in Garage).
- [ ] C5.3. In-game + Triplex verify (user): open `Garage.jsx` in Triplex → single "Garage" scene; drag GarageModel/Lights/Platform/Rider → reflected live in the running garage + production build. NOTE: name tags (`<Text>`/`<Image>`) may not preview in Triplex if it blocks the Troika font CDN; they still ship in production. If Triplex can't open the scene because of that, add a `showUi` prop to suppress name tags while editing.

## Cleanup / hardening (done)
- Deps updated within compatible major line (drei 9.122 fixed lodash.pick high-severity CVE); majors held to avoid React19/R3F-v9 migration.
- Removed unused uncompressed `dog.glb` + 4 board GLBs (archived in `_assets-to-import`); only `-transformed.glb` (Draco) remain.
- Added top-level `ErrorBoundary` in `main.jsx` so a future render crash shows a fallback instead of a white screen.
- **Vendored the Draco decoder** to `public/draco/` (copied from `three/examples/jsm/libs/draco/gltf`); `useGLTF` now loads it via `'/draco/'` instead of the Google CDN. Fixes the first-board-load hitch (CDN fetch) AND lets Triplex load the compressed models (CDN was blocked in its sandbox).

## Garage transform fix + Skatepark playground (C6)
Goal: (1) make EVERY named object in the garage + rider draggable in Triplex by
converting all shorthand transforms (`position-x/y/z`, `rotation-x`, `degToRad()`)
into literal `position`/`rotation`/`scale` arrays (Triplex's move gizmo only binds
to arrays). (2) Build a brand-new Triplex-ready "skatepark playground" level from
basic shapes — its visual-only component opens standalone in Triplex, and `Game.jsx`
wraps it in `<Physics>` + auto cuboid colliders, so dragging/scaling ramps updates
physics with zero desync. NOT touching the buildings map.

### Part A — Garage + rider fully draggable
- [x] A1. `Garage.jsx`: drop `degToRad` import; convert all shorthand to literal arrays — outer `scale`, player group `position`/`scale`, `Billboard` `position`, `Text`/`Image` `position`, `Rider` `position`/`scale` (placement-only), me-light `position`, Platform group `rotation`/`position`, platform mesh `position`. (also Box `scale` -> array)
- [x] A2. `Car.jsx`: board groups `rotation-y` -> `rotation={[0, y, 0]}` literal arrays.
- [x] A3. `Board.jsx`: already array-form; no change.
- [x] A4. `Garage.jsx`: added optional `showUi` prop (default `true`) to hide name tags while editing if Triplex blocks Troika CDN.
- [ ] A5. In Triplex: open `Garage.jsx` + `Car.jsx` -> confirm every named object draggable + live. (build is green; needs user verify in Triplex)

### Part B — Skatepark playground (replaces buildings map for now)
- [x] B1. New `src/components/Skatepark.jsx`: single exported, visual-only component of named literal-transform groups — `Floor` (thin box), `Ramp1..3` (rotated boxes), `Rail`, `Wall`. No physics so Triplex opens it standalone.
- [x] B2. `Game.jsx`: `LEVEL = "skatepark"` branch -> `<RigidBody type="fixed" colliders="cuboid"><Skatepark/></RigidBody>`; keep buildings branch (`GameArea` + road) for `LEVEL="buildings"`.
- [ ] B3. `npm run dev`; drive in skatepark; confirm live edits + physics. (build green; needs user in-game verify)
- [x] B4. CHECKLIST updated (this section).

## Naming cleanup + UFO / go-kart vehicles (C7)
Goal: clear, future-proof vocabulary so "dog" / "player" / "vehicle" are unambiguous,
and add the UFO + go-kart as rideable vehicles (not just boards).
- [x] C7.1. Compressed `_assets-to-import/ufo_flying_saucer_spaceship_ovni.glb` (20.5MB -> 1.66MB) and `go-kart.glb` (2.56MB -> 176KB) via `npx gltfjsx --transform` (Draco + WebP); outputs `public/models/vehicles/*-transformed.glb`. `_assets-to-import` left untouched.
- [x] C7.2. Renamed source for clear distinction: `Car.jsx` -> `Rider.jsx` (dog + vehicle), `Board.jsx` -> `Vehicle.jsx`, `CarController.jsx` -> `RiderController.jsx`, `boardConfig.js` -> `vehicleConfig.js`. `Rider` = the rider; `RiderController` = a networked player's controller.
- [x] C7.3. Renamed state key `"car"` -> `"vehicle"` across `UI.jsx`, `Garage.jsx`, `RiderController.jsx` (mock + live reads/writes consistent). `CAR_MODELS` -> `VEHICLE_MODELS`, `BOARD_MAP` -> `VEHICLE_MAP`, `BOARD_MODELS` -> `VEHICLE_GLB_MODELS`, `CAR_SPEEDS` -> `VEHICLE_SPEEDS`, leva `carSpeed` -> `rideSpeed`, `CarSwitcher` -> `VehicleSwitcher`, audio `car_start` -> `ride_start` (also renamed `public/audios/car_start.mp3`).
- [x] C7.4. `Rider.jsx` is now data-driven: mounts each vehicle via `VEHICLE_TRANSFORMS[glbId]` (scale/rotation/position) so boards + UFO + go-kart are all placed consistently and tunable in Triplex. Added `ufo` / `goKart` slots to `VEHICLE_MODELS` + `VEHICLE_MAP` + `VEHICLE_SPEEDS`.
- [x] C7.5. Asset folders: `public/models/boards/` merged into `public/models/vehicles/`; `public/images/cars/` -> `public/images/vehicles/`; new `public/images/dogs/` (for future dog-swap thumbnails). Added placeholder thumbnails `ufo.png` / `goKart.png` (real art still TODO).
- [ ] C7.6. In-game verify (user): select UFO / go-kart in the lobby; tune their `VEHICLE_TRANSFORMS` in Triplex. NOTE: ufo/go-kart transforms are best-guesses — dog is ~0.9 tall after the 0.32 controller scale; adjust `VEHICLE_TRANSFORMS` in `vehicleConfig.js` (or drag in Triplex) until they sit under the dog.
- [ ] C7.7. (Separate) Collision: the single shared `<CuboidCollider args={[0.5,0.5,0.9]} position={[0,0.4,0]}>` in `RiderController.jsx` is too tall and dips below the floor -> "getting stuck". Boards have NO colliders; the surfboard theory is wrong. Fix = tune that one collider (smaller height, raise it). No Blender.

## Controls / camera (future)
- [ ] D1. **WASD controls**: drive with W/A/S/D in addition to the on-screen joystick. Wire keyboard state into `RiderController.jsx` impulse logic (PlayroomKit `controls` is joystick-only; read `window` keydown/keyup or a keyboard store and apply the same impulse/rotation math).
- [ ] D2. **Click-drag camera (free-look)**: click + drag re-positions the chase camera and it stays there. While driving, click-drag = look around; on release, if still driving, snap back to the default chase position ("position 1"). Needs a camera controller in `Lobby.jsx`/`RiderController.jsx` (currently `CameraControls` auto-orbits; replace with manual offset that lerps back to default when driving & not dragging).
- [ ] D3. **Mouse-wheel zoom**: adjust camera distance via wheel (clamp min/max).

## Risks / notes
- Dog native ~2.78 tall, ~5.44 long (forward = Z); outer `scale={0.32}` in `CarController` -> ~0.9 tall, ~1.7 long.
- `colliders="hull"` wraps the combined dog+board; try `cuboid` if driving feels off.
- Boards are NOT uniformly scaled/oriented: longboard & surfboard are Z-aligned; skateboard is tiny + X-aligned; arcadia is in cm with a ~490 Y offset -> handled per-board in `BOARD_CONFIG`.
- Triplex cannot edit transforms buried in a JS config object, so the dog transform should be a literal prop.
- The dog "resizing" on swap is the lobby shrink animation, not a real scale change; A5 fixes it.
