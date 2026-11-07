# Prompt: weapon upgrade items for cc-ftl (the whole first batch)

(Paste `common.md` above this prompt.)

**Branch:** `art/weapon-upgrades`, based on `main` once the weapon upgrades PR (issue #338) has merged. If it hasn't merged yet, base it on `combat/weapon-upgrades` and say so.

**Task:** build item sprites for the whole first batch of weapon upgrades in one family: the three in the game now and the seven planned behaviour upgrades (DESIGN.md "Weapon upgrades and flak", the first-batch table). Doing them together keeps them one consistent set. The three built ones are placeholders today: other items' sprites with a tint (`placeholderIcon` in `src/content/upgrades.ts`). Your sprites replace them, and the `placeholderIcon` fields get deleted when they're wired. The seven behaviour upgrades are built in slice 2 (branch `combat/behaviour-upgrades`, also on `placeholderIcon`). If slice 2 has merged when you start, wire all ten; if not, add the seven to the manifest and leave them unwired.

**Context:**
- Design: `docs/DESIGN.md`, the weapon upgrades section (grep for "upgrade"). An upgrade is a module part. Crew fit it into a weapon's upgrade slot. It is built at the fabricator, bought at stations, and dropped by enemy ships.
- The items as the player meets them:
  - stacked on the floor and in crates;
  - carried by a crew member while fitting one;
  - pictured in the module inspector's upgrade slot (about 40 px);
  - pictured in the trade window and stock lists.
- The small combat rows (the weapon bar and the enemy card) show the fitted upgrade as a simple line icon (`src/ui/upgradeIcon.ts`), and these stay: nothing reads at 13 px. Hovering that icon opens a card with the item sprite at about 40 px, so the 40 px view is the one that has to read well in the UI (user decision, 2026-11-07).

**Items:**
- `item.upg_capacitor`, **Quick capacitor** (faster weapon charge): a chunky charge cell or capacitor bank with contacts. Yellow is the accent: a glowing band or terminals.
- `item.upg_coolant`, **Coolant jacket** (less heat per volley): a ribbed sleeve or wrap with coolant lines. Icy cyan is the accent: frosted fins or a coolant window.
- `item.upg_housing`, **Hardened housing** (the weapon takes half damage): an armoured shell or plate segment with bolts. Steel grey, heavier and blockier than the other two.

Planned behaviour upgrades, each fitting one weapon type. Ids are proposed; keep them unless they clash with something in `src/content`:
- `item.upg_prism`, **Prism splitter** (burst laser: 5 weaker shots): a faceted crystal or prism in a cradle. Laser colours split across the facets.
- `item.upg_focus`, **Heavy focus** (burst laser: 2 shield-piercing shots): a thick lens barrel, a single concentrated lens.
- `item.upg_frag`, **Frag slug** (mass driver: bigger blast): a stubby slug cartridge scored into fragments.
- `item.upg_rail`, **Rail coil** (mass driver: pierces 2 layers, runs very hot): long parallel rails wound with copper coils, a heat glow at one end.
- `item.upg_nuke`, **Nuclear warhead** (missiles: huge blast; black market only): a warhead nose cone with hazard markings. It should feel illicit and dangerous; the radiation trefoil is fine as a mark, though there is no radiation system.
- `item.upg_chain`, **Chain coil** (ion cannon: ion arcs as lightning into crew): a coil or tesla emitter with forked prongs, an electric blue-violet accent.
- `item.upg_thermite`, **Thermite** (incendiary: burns and breaches): a canister or charge pack with an orange-red accent.

Across all ten:
- They must tell apart by silhouette alone, not only by colour. Weapon-specific upgrades share a cue (for example a small coloured tag or band) for the weapon they fit, so a player can sort them at a glance.
- Faction feel: navy upgrades precise, pirate ones crude, zealot ones fire-based (DESIGN.md). One clean design per item for now; faction variants come later, if ever.
- They are military-industrial parts: the same family as the weapons (`weapons_mil.md`), not consumer gadgets.
- Shot effects (tints, trails, blasts) are slice 2's code; this session only supplies the neutral shot sprites they tint ("Shot sprites" below).

**Sprites:**
- Follow the existing item sprite set exactly. Look at how `item.electronics` and `item.parts` are built: the `.s`, `.m` and `.l` stack sizes on the floor and in crates, `.held` in a crew member's hand, and the sizes and camera they use.
- Ids: `item.upg_capacitor.s`, `.m`, `.l` and `.held`, and the same for every other upgrade id above, all listed in the manifest.
- Put the family's colours in their own palette set (`"set"` in `palette_extra.json`).

**Shot sprites:**
- The behaviour upgrades tint their weapon's shot (slice 2, `WeaponDef.look`, `src/render/shotLook.ts`). Today the tint multiplies the already coloured shot sprites, so some come out muddy (the rail coil brown, the nuke olive). Build a neutral (white or light grey) version of each shot sprite the behaviour upgrades use (burst laser, mass driver, missile, ion, incendiary), matched to the existing ones in size and frames, so the tint can colour it cleanly. Look at how the existing shot sprites are made and named first.

**First preview:**
- Shoot it in the render lab, not the game (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`). Add a panel showing:
  - all ten items at each stack size and held, at 1x and 3x, the three built ones first;
  - each beside `item.electronics` and `item.parts` for scale;
  - each at about 40 px on the dark UI panel colour (`--panel` in `src/ui/theme.css`), as the inspector slot and the hover card show it;
  - each neutral shot sprite beside the coloured one, and tinted with each upgrade colour that uses it.
- Send me the preview and stop. Don't wire anything until I've picked a direction.

**After approval:**
- Wire the three built upgrades' sprites, then delete the `placeholderIcon` fields and any code that existed only for them. Do the same for the seven behaviour upgrades if slice 2 has merged; otherwise they stay in the manifest, unwired.
- Wire the neutral shot sprites into `shotLook.ts` for upgraded shots and drop any code-drawn placeholder tint that existed only for them.
- Run `npm run check:fast`. Shoot the module inspector with an upgrade fitted, the upgrade hover card, and a volley of each upgraded shot in a fight.
- Open the PR against `main` with the before and after shots.
