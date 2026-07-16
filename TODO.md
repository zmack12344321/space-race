# TODO

## Setup / Cleanup
- [ ] Replace placeholder `public/favicon.svg` with a real Space Race icon (moon / UFO from `_assets-to-import`, or a custom one)

## Assets (`_assets-to-import`)
- [ ] Audit and hook up remaining assets (models, audio, textures, mobile controls)
- [ ] Decide keep vs. discard; organize into `public/`

## Fonts
- [ ] `public/fonts/Ethnocentric-Regular.otf` is **metrics-patched**. If the raw font is ever re-downloaded, re-patch ascent=1000 / descent=-255 / lineGap=0 or title spacing breaks.

## Game
### Now
- [ ] Finalize vehicle handling + low-grav suspension tuning (`ecctrl`)
- [ ] Dust trails, particle + thruster VFX
- [ ] Lobby scoreboard foundation (track player stats)

### Next (see README roadmap)
- [ ] UFO laser shooting mechanics
- [ ] Hit detection + scoring; lobby scoreboard shows top shooters
- [ ] Matchmaking around combat rounds
- [ ] Race mode: start lines, checkpoints, lap timers
- [ ] Adventure/co-op: cave exploration, item pickups, base building + upgrades

## UI copy (self-aware tone)
- [ ] Keep `src/utils/quips.js` as the single source of rotating funny copy.
- [ ] Add quips to any new screens as they're built.
