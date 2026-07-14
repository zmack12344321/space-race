# 🚀 Space Race

**Space Race** is a highly-optimized, browser-based 3D multiplayer racing and exploration game set on the moon. 

This README serves as the ultimate **Context Guide** for developers (and AI assistants) to understand the architecture, the "why" behind the tech stack, the vibe of the game, and the roadmap for the future.

---

## 📖 Game Design Document (GDD)

### What is Space Race?
**Space Race** is a massive, multiplayer, physics-based sandbox and racing game set on a procedurally generated moon. It runs entirely in the browser, offering console-quality physics and rendering instantly via a simple URL.

### Who is it for?
- Players looking for a visually stunning, frictionless, instant-play browser game.
- Fans of physics sandboxes (like *BeamNG.drive* or *Kerbal Space Program* rover driving) mixed with casual racing.

### 🌌 The Vibe & Visual Design
- **The Mood:** Desolate, massive, and eerily beautiful. Think of the stark contrast of the Apollo moon landings, but injected with sci-fi, high-speed adrenaline.
- **Visuals:** High-contrast lighting with harsh, sharp shadows. Pitch-black skies against blindingly bright lunar regolith. Vehicles feature subtle emissive glows (thrusters, headlights) that pop against the monochromatic terrain.
- **The Feel:** *Buttery smooth and floaty.* The low-gravity physics are the star of the show. Hitting a crater at 150km/h should launch the player into a massive, slow-motion arc. The suspension should visibly compress and react to every pebble and bump.

### 🎮 The Core Gameplay Loop
1. **Spawn & Explore:** Players drop into a persistent multiplayer lobby on the lunar surface. They can seamlessly hop into different vehicles (Hoverbikes, Rovers, Drones).
2. **Freeroam Sandbox:** The terrain is infinite (chunk-based). Players can test their vehicle's limits, scale massive craters, and discover extreme jumps.
3. **Racing & Competition (Upcoming):** Players will eventually be able to trigger impromptu races to distant waypoints or navigate obstacle-dense canyons while fighting for first place.

---

## 🛠️ The Tech Stack (And Why We Use It)

This game relies on a very specific, modern React 3D stack. **Do not attempt to rewrite these systems from scratch**—they are chosen for a reason:

1. **[React Three Fiber (R3F)](https://docs.pmnd.rs/react-three-fiber):** The core renderer. It wraps Three.js into declarative React components. It handles the WebGL scene, lighting, and rendering.
2. **[Rapier Physics (`@react-three/rapier`)](https://rapier.rs/):** The physics engine. Written in Rust and compiled to WebAssembly (WASM). It handles gravity, collisions, and rigid bodies. It is vastly superior to older JS physics engines like Cannon or Ammo.
3. **[`ecctrl`](https://github.com/pmndrs/ecctrl):** The vehicle and character controller. Writing a custom physics-based vehicle controller is notoriously difficult. `ecctrl` sits on top of Rapier and handles suspension, wheel friction, jumping, and camera tracking natively.
4. **[PartyKit](https://docs.partykit.io/):** The multiplayer WebSocket backend. It handles real-time player synchronization (positions, rotations, sun angles) with incredibly low latency.

---

## 📂 Project Structure

If you are an AI model trying to help build this game, familiarize yourself with this structure:

- `/src/components/core/` - The backbone of the game (`Game.jsx`, `Lobby.jsx`). Manages the main game loop, multiplayer state, and global UI.
- `/src/components/environment/` - The procedural world generation.
  - `LunarTerrain.jsx`: Generates the ground. **CRITICAL:** Visual terrain and Physics terrain are separated here! We feed Rapier an invisible, ultra-low-poly (8x8) mesh to prevent the WASM engine from freezing when loading chunks.
  - `LunarRocks.jsx` & `Rock.jsx`: Instanced meshes for distant rocks, and dynamic `RigidBody` rocks for close-up collisions.
  - `LunarEnvironment.jsx`: Lighting, shadows, and the skybox.
- `/src/components/vehicles/` - The driving mechanics.
  - `Rider.jsx` & `RiderController.jsx`: Integrates with `ecctrl` to provide the vehicle physics and player input.
- `/src/multiplayer/` - PartyKit socket connections and state sync logic.

---

## 🚀 The Roadmap & Next Steps

1. **Phase 1: Extreme Optimization (Completed ✅)**
   - Separated visual meshes from physics colliders.
   - Reduced shadow maps (4096 -> 2048) and disabled MSAA on high-DPR screens.
   - Pre-allocated `THREE.Vector3` variables to eradicate Garbage Collection (GC) stutters during chunk generation.
   - Patched underlying library deprecation warnings natively via `patch-package`.
   
2. **Phase 2: Gameplay Loop & Mechanics (Current 🚧)**
   - Perfect the vehicle handling and low-gravity suspension via `ecctrl` tuning.
   - Implement actual racing mechanics (start lines, checkpoints, lap timers).
   - Add dust trails, particle effects, and thruster visuals to the vehicles.

3. **Phase 3: Multiplayer Expansion**
   - Sync vehicle states (wheel rotation, suspension compression) across the PartyKit network.
   - Add lobbies, player matchmaking, and custom vehicle colors.

---

## 💻 Developer Commands

**Start the Game (Client + Multiplayer Server):**
```bash
npm install
npm run dev:worker  # Starts the PartyKit local server
npm run dev         # Starts the Vite frontend on localhost:5173
```
*Note: Local multiplayer uses `localhost:1999` by default. Shareable room links use the `?room=` URL param.*

**Deploying to Production:**
Deploy the PartyServer worker to Cloudflare, then deploy the Vercel frontend:
```bash
npm run deploy:worker
vercel --prod --build-env VITE_PARTYKIT_HOST=space-race.<your-worker-subdomain>.workers.dev
```

---
> **AI Assistant Note:** When writing code for Space Race, always prioritize performance. Avoid instantiating new objects (like `new THREE.Vector3`) inside `useFrame` or tight loops. Lean heavily on `ecctrl` for movement, and never let visual complexity overwhelm the Rapier physics step.
