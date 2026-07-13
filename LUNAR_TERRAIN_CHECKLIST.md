# Infinite Lunar Terrain Checklist

Goal: infinite lunar landscape generated with `three.terrain.js`, drivable with Rapier vehicles, optimized with R3F/Drei patterns.

## Stone Marks

- [x] 1. Add `three.terrain.js` dependency.
- [x] 2. Create deterministic world-coordinate lunar heightfield.
- [x] 3. Generate terrain chunks with `Terrain()` and shared lunar material.
- [x] 4. Add LOD rings: high near, medium mid, low far.
- [x] 5. Add Rapier `trimesh` colliders only for near chunks.
- [x] 6. Wire `lunar` level into `Game.jsx`.
- [x] 7. Reuse lunar sky: HDRI, stars, fog, distant mountains.
- [x] 8. Add Drei performance helpers: `AdaptiveDpr`, `PerformanceMonitor`, `Preload` where useful.
- [x] 9. Respawn riders on terrain height.
- [x] 10. Build passes with `npm run build`.

## Notes

- `three.terrain.js` needs Three r160+. Project has `three@0.163.0`, compatible.
- Built-in random terrain generators use `Math.random()`. Infinite chunks need deterministic world-coordinate sampler to avoid seams.
- Visual chunks can extend far. Physics chunks must stay near player for Rapier cost control.
