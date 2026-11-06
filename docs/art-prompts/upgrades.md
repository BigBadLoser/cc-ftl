# Prompt: weapon upgrade items for cc-ftl (the whole first batch)

(Paste `common.md` above this prompt.)

**Branch:** `art/weapon-upgrades`, based on `main` once the weapon upgrades PR (issue #338) has merged. If it hasn't merged yet, base it on `combat/weapon-upgrades` and say so.

**Task:** build item sprites for the whole first batch of weapon upgrades in one family: the three in the game now and the seven planned behaviour upgrades (DESIGN.md "Weapon upgrades and flak", the first-batch table). Doing them together keeps them one consistent set. The three built ones are placeholders today: other items' sprites with a tint (`placeholderIcon` in `src/content/upgrades.ts`). Your sprites replace them, and the `placeholderIcon` fields get deleted when they're wired. The seven planned ones are art only for now: add them to the manifest, but they get wired when their upgrades are built (slice 2).

**Context:**
- Design: `docs/DESIGN.md`, the weapon upgrades section (grep for "upgrade"). An upgrade is a module part. Crew fit it into a weapon's upgrade slot. It is built at the fabricator, bought at stations, and dropped by enemy ships.
- The items as the player meets them:
  - stacked on the floor and in crates;
  - carried by a crew member while fitting one;
  - pictured in the module inspector's upgrade slot (about 40 px);
  - pictured in the trade window and stock lists.
- The small combat rows use line icons (a bolt, a snowflake and a shield, from `src/ui/upgradeIcon.ts`), not these sprites. Echo those shapes so the two read as the same thing, but don't copy them literally.

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
- Shot effects (tints, trails, blasts) for the behaviour upgrades are out of scope here: they come with slice 2's code.

**Sprites:**
- Follow the existing item sprite set exactly. Look at how `item.electronics` and `item.parts` are built: the `.s`, `.m` and `.l` stack sizes on the floor and in crates, `.held` in a crew member's hand, and the sizes and camera they use.
- Ids: `item.upg_capacitor.s`, `.m`, `.l` and `.held`, and the same for every other upgrade id above, all listed in the manifest.
- Put the family's colours in their own palette set (`"set"` in `palette_extra.json`).

**First preview:**
- Shoot it in the render lab, not the game (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`). Add a panel showing:
  - all ten items at each stack size and held, at 1x and 3x, the three built ones first;
  - each beside `item.electronics` and `item.parts` for scale;
  - each at about 40 px, as the inspector's upgrade slot shows it.
- Send me the preview and stop. Don't wire anything until I've picked a direction.

**After approval:**
- Wire the three built upgrades' sprites, then delete the `placeholderIcon` fields and any code that existed only for them. The seven planned ones stay in the manifest, unwired.
- Run `npm run check:fast` and shoot the module inspector with an upgrade fitted.
- Open the PR against `main` with the before and after shots.
