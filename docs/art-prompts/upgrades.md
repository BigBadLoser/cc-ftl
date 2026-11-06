# Prompt: weapon upgrade items for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/weapon-upgrades`, based on `main` once the weapon upgrades PR (issue #338) has merged. If it hasn't merged yet, base it on `combat/weapon-upgrades` and say so.

**Task:** build item sprites for the three weapon upgrades. Today they are placeholders: other items' sprites with a tint (`placeholderIcon` in `src/content/upgrades.ts`). Your sprites replace them, and the `placeholderIcon` fields get deleted when they're wired.

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
- The three must tell apart by silhouette alone, not only by colour. They are military-industrial parts: the same family as the weapons (`weapons_mil.md`), not consumer gadgets.

**Sprites:**
- Follow the existing item sprite set exactly. Look at how `item.electronics` and `item.parts` are built: the `.s`, `.m` and `.l` stack sizes on the floor and in crates, `.held` in a crew member's hand, and the sizes and camera they use.
- Ids: `item.upg_capacitor.s`, `.m`, `.l` and `.held`, and the same for `upg_coolant` and `upg_housing`, all listed in the manifest.
- Put the family's colours in their own palette set (`"set"` in `palette_extra.json`).

**First preview:**
- Shoot it in the render lab, not the game (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`). Add a panel showing:
  - all three items at each stack size and held, at 1x and 3x;
  - each beside `item.electronics` and `item.parts` for scale;
  - each at about 40 px, as the inspector's upgrade slot shows it.
- Send me the preview and stop. Don't wire anything until I've picked a direction.

**After approval:**
- Wire the sprites, then delete the `placeholderIcon` fields and any code that existed only for them.
- Run `npm run check:fast` and shoot the module inspector with an upgrade fitted.
- Open the PR against `main` with the before and after shots.
