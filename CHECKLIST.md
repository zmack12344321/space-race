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

## Cleanup / hardening (done)
- Deps updated within compatible major line (drei 9.122 fixed lodash.pick high-severity CVE); majors held to avoid React19/R3F-v9 migration.
- Removed unused uncompressed `dog.glb` + 4 board GLBs (archived in `_assets-to-import`); only `-transformed.glb` (Draco) remain.
- Added top-level `ErrorBoundary` in `main.jsx` so a future render crash shows a fallback instead of a white screen.
- **Vendored the Draco decoder** to `public/draco/` (copied from `three/examples/jsm/libs/draco/gltf`); `useGLTF` now loads it via `'/draco/'` instead of the Google CDN. Fixes the first-board-load hitch (CDN fetch) AND lets Triplex load the compressed models (CDN was blocked in its sandbox).

## Risks / notes
- Dog native ~2.78 tall, ~5.44 long (forward = Z); outer `scale={0.32}` in `CarController` -> ~0.9 tall, ~1.7 long.
- `colliders="hull"` wraps the combined dog+board; try `cuboid` if driving feels off.
- Boards are NOT uniformly scaled/oriented: longboard & surfboard are Z-aligned; skateboard is tiny + X-aligned; arcadia is in cm with a ~490 Y offset -> handled per-board in `BOARD_CONFIG`.
- Triplex cannot edit transforms buried in a JS config object, so the dog transform should be a literal prop.
- The dog "resizing" on swap is the lobby shrink animation, not a real scale change; A5 fixes it.
