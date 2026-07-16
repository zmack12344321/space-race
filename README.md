# 🚀 Space Race

**Space Race** is a browser-based 3D multiplayer game where you play as a **dog** piloting a roster of absurd lunar craft — skateboards, longboards, a go-kart, a flying surfboard, and a UFO — across a procedurally generated moon. It runs entirely in the browser with console-quality physics, instantly, via a URL.

This README is the **Context Guide** for developers and AI assistants: the vision, the current state, the architecture, and the roadmap. Keep it in sync with the game.

---

## 🎮 Vision & Vibe

- **The pitch:** You are a dog. You have a laser UFO and zero impulse control. That's the whole game.
- **Tone:** Funny and self-aware, *not* Tron-cool. The UI talks to the player like a slightly unhinged friend. Examples already in the build:
  - Title tagline (rotates randomly each load): *"We put a dog on a hoverboard. Don't ask."*
  - Username prompt sub-label: *"No, not 'Player1'"*
  - Invite button → *"Beg a friend"*; Respawn → *"Ow. Again."*; Practice → *"Practice (you need it)"*
  - Loading screen → *"Try not to crash. (You will.)"*
  - Pause menu → *"Catching your breath?"*
- **Visuals:** Photoreal-ish, grounded sci-fi — **not** stylized/cartoon 3D. Harsh, high-contrast lunar lighting, pitch-black sky, bright regolith, subtle emissive glows on thrusters/headlights. The humor lives in the copy, not in the art.
- **The feel:** Buttery-smooth, floaty low-gravity physics. Hitting a crater at speed should launch you into a slow, massive arc.

### Core fantasy (what it's becoming)
1. **Lobby social space** — drop in, customize your dog + craft, see friends on a live scoreboard.
2. **Ranked UFO dogfights** — fly the UFO, shoot lasers at friends, lobby scoreboard tracks who's landing the most hits.
3. **Race mode** (future) — checkpoints, lap timers, impromptu races to waypoints.
4. **Adventure/co-op mode** (future) — you and friends explore the procedural moon, find caves with items, haul loot back to a base, and upgrade it.

---

## 📍 Current State (as of this write-up)

**In the build now:**
- Title screen → lobby → loading → game flow.
- Player is a **dog** riding one of several vehicles (see roster below).
- Persistent multiplayer **lobby** on the lunar surface with real-time sync (PartyKit).
- Vehicle switching in-lobby (longboard / skateboard / surfboard / go-kart / UFO).
- In-lobby "garage" podium showing each player's dog + name tag.
- Free-fly sandbox: drive any craft, including the flying UFO.
- Pause menu (Resume / Controls / Settings / Quit), name editing, invite (copy room link), respawn.
- Procedural lunar terrain (chunk-based), rocks, lighting, bloom.
- Rotating random "quip" copy on title / loading / pause screens (`src/utils/quips.js`).
- Custom **Ethnocentric** display font patched at the source so glyph metrics sit flush (no CSS hacks).

**Not yet built (see roadmap):**
- Laser combat / shooting mechanics.
- Lobby scoreboard (hits / KDs).
- Ranked matchmaking around combat.
- Race mode (start lines, checkpoints, lap timers).
- Adventure mode (caves, items, base building/upgrades).
- Final vehicle tuning + polish pass.

### Vehicle roster (current)
| Key | Craft | Notes |
|------|-------|-------|
| `longboard` | Longboard | default; two longboard variants exist (`longboard`, `arcadia_longboard`) |
| `skateboard` | Skateboard | |
| `surfboard_lucid_sn1` | Flying surfboard | hovers |
| `go-kart` | Go-kart | |
| `ufo` | UFO | flying; the future combat craft (lasers) |

Source of truth: `src/components/vehicles/vehicleConfig.js` + `Rider.jsx`.

---

## 🛠️ Tech Stack (and why)

1. **[React Three Fiber (R3F)](https://docs.pmnd.rs/react-three-fiber)** — declarative Three.js renderer for the WebGL scene.
2. **[Rapier (`@react-three/rapier`)](https://rapier.rs/)** — Rust/WASM physics (gravity, collisions, rigid bodies). Superior to Cannon/Ammo.
3. **[`ecctrl`](https://github.com/pmndrs/ecctrl)** — vehicle/character controller on top of Rapier (suspension, friction, jump, camera). Don't hand-roll this.
4. **[PartyKit](https://docs.partykit.io/)** — multiplayer WebSocket backend; low-latency sync of positions/rotations/state.

**Performance is non-negotiable.** Never instantiate objects (`new THREE.Vector3`, etc.) inside `useFrame`/tight loops. Keep visual complexity from starving the Rapier step. Visual meshes and physics colliders are intentionally separated.

---

## 📂 Project Structure (for AI assistants)

- `src/components/core/` — game backbone (`Game.jsx`, `Lobby.jsx`): main loop, multiplayer state, global UI.
- `src/components/environment/` — procedural world.
  - `LunarTerrain.jsx` — ground. **CRITICAL:** visual mesh and physics mesh are separated; Rapier gets an invisible ultra-low-poly collider to avoid WASM freezes on chunk load.
  - `LunarRocks.jsx` / `Rock.jsx` — instanced distant rocks + dynamic rigid-body rocks.
  - `Lunar1.jsx` / `Lunar2.jsx` / `LunarPreview.jsx` — lobby scenes; each player rendered as a `FloatingRider` + `PlayerNameTag` billboard on a podium.
  - `Garage.jsx` — standalone 3D garage scene (same player-card concept).
  - `LunarEnvironment.jsx` — lighting, shadows, skybox.
- `src/components/vehicles/` — driving.
  - `Rider.jsx` / `RiderController.jsx` — dog + craft, integrated with `ecctrl`. In-game name tag is the *same* `PlayerNameTag` as the lobby, just attached to the live moving `EcctrlVehicle`.
  - `Vehicle.jsx`, `SimpleThruster.jsx` — craft models + thrusters.
- `src/components/ui/` — HTML/overlay UI (`UI.jsx`, `PauseMenu.jsx`, `ControlsData.jsx`, `EcctrlControlPanel.jsx`, `BoostMeter.jsx`, `HeatMeter.jsx`).
- `src/utils/quips.js` — rotating self-aware copy arrays + `makeQuipPicker`.
- `src/multiplayer/` — PartyKit sockets + state sync.
- `public/fonts/Ethnocentric-Regular.otf` — display font, **metrics-patched** (ascent 1000 / descent -255 / lineGap 0). If you re-download the raw font, re-patch it or the title spacing breaks.

---

## 🗺️ Roadmap

### Phase 1 — Optimization ✅ (done)
- Separated visual/physics meshes; reduced shadow maps; pre-allocated vectors; `patch-package` fixes.

### Phase 2 — Core Loop & Feel 🚧 (current)
- Finalize vehicle handling + low-grav suspension tuning.
- Dust trails, particle + thruster VFX.
- Lobby scoreboard foundation (track player stats).

### Phase 3 — Ranked Combat 🔜
- UFO laser shooting mechanics.
- Hit detection + scoring; lobby scoreboard shows top shooters.
- Matchmaking around combat rounds.

### Phase 4 — Modes 🔜
- **Race mode:** start lines, checkpoints, lap timers, impromptu waypoint races.
- **Adventure/co-op:** procedural cave exploration, item pickups, base building + upgrades, loot hauling.

### Phase 5 — Polish
- Final vehicle roster pass, audio, onboarding, mobile controls.

---

## 💻 Developer Commands

**Run locally (client + multiplayer server):**
```bash
npm install
npm run dev:worker   # PartyKit local server (localhost:1999)
npm run dev           # Vite frontend (localhost:5173)
```
Shareable room links use the `?room=` URL param.

**Deploy:**
```bash
npm run deploy:worker        # Cloudflare PartyKit worker
vercel --prod --build-env VITE_PARTYKIT_HOST=space-race.<your-subdomain>.workers.dev
```

> **AI Assistant Note:** Prioritize performance above all. Lean on `ecctrl` for movement; never let visual complexity starve the physics step; keep `quips.js` the single source of self-aware copy so the tone stays consistent.
