# Space Race — Dog on a Board: Checklist

Working style: implement ONE task, report, user verifies in-game, then we move to the next. No sweeping breaking changes.

## Phase A — Dog on a board (keep it working)
- [x] A1. Copy assets: `labrador_dog.glb` -> `public/models/dog.glb`; 4 boards -> `public/models/boards/`. (keep `_assets-to-import` as the archive)
- [x] A2. `src/components/Dog.jsx` generated via gltfjsx; autoplay idle clip via `useAnimations`
- [x] A3. `Board` renderer (`useGLTF` + `<Clone>`) lives in `Car.jsx`
- [x] A4. `Car.jsx` renders `<Dog/>` + parented `<Board>` via `BOARD_MAP` (kept `CAR_MODELS`, car thumbnails, and the `car` state key untouched)
- [ ] A5. **FIX spin:** lobby `CarSwitcher` currently spins/shrinks the WHOLE rider. Split it so only `<Board>` spins/shrinks and `<Dog/>` stays put (`Lobby.jsx`)
- [ ] A6. Visual tune: dog facing/scale + per-board offsets (longboard/surfboard should be correct; skateboard/arcadia are best-guess)
- [ ] A7. Verify in-game: dog idles, is drivable, board swaps via the lobby selector, multiplayer sync still works

## Phase B — Interchangeable dogs (mirror the existing swap system)
- [ ] B1. Add a `dog` PlayroomKit state key; `DOG_MODELS` list; `public/models/dogs/` folder
- [ ] B2. Generalize `Dog.jsx` -> `Dog({ model })` that loads by model + autoplays the first clip (works for any skinned dog)
- [ ] B3. Create `Rider.jsx` = `<Dog model={dog}/>` + `<Board model={board}/>` (use literal transform props so Triplex can edit them)
- [ ] B4. `CarController` reads both `board` + `dog` states -> renders `<Rider/>`
- [ ] B5. Lobby: `BoardSwitcher` (spins board) + `DogSwitcher` (spins dog)
- [ ] B6. UI: second selector row for dogs (+ dog thumbnails)

## Phase C — Polish / Triplex
- [ ] C1. Make the dog transform a literal prop in `Rider.jsx` (Triplex-ready); install Triplex for VS Code
- [ ] C2. Visual tune pass with Triplex; fix `skateboard` / `arcadia_longboard` board offsets
- [ ] C3. Rename identifiers (`car` -> `board`/`vehicle`) + swap `car_start` audio (later phase)

## Risks / notes
- Dog native ~2.78 tall, ~5.44 long (forward = Z); outer `scale={0.32}` in `CarController` -> ~0.9 tall, ~1.7 long.
- `colliders="hull"` wraps the combined dog+board; try `cuboid` if driving feels off.
- Boards are NOT uniformly scaled/oriented: longboard & surfboard are Z-aligned; skateboard is tiny + X-aligned; arcadia is in cm with a ~490 Y offset -> handled per-board in `BOARD_CONFIG`.
- Triplex cannot edit transforms buried in a JS config object, so the dog transform should be a literal prop.
- The dog "resizing" on swap is the lobby shrink animation, not a real scale change; A5 fixes it.
