# Structure looks: wiring faction walls into the renderer

Status: the art side is built, but the game does not use it yet. This note is the hand-off for the main thread.

## What the sheets carry

`tools/blender/sprites/structure.py` rebuilds every default wall, hull and floor tile through a faction look
(`tools/blender/sprites/faction/`: one module a look). Each rebuilt tile keeps the default id, with a look segment added after the family:

```
tile.<fam>.<look>.<rest of the default id>
  tile.hull.navy.full.m10.v1   tile.wall.civil.v2.end.s   tile.hull.scrap.p3.belly.o1.m10   tile.floor.drone.a
```

| look        | after (Space Haven sheet) | notes                                                    |
|-------------|---------------------------|----------------------------------------------------------|
| `navy`      | set 4                     | light plates, maroon band, dark lit header, white caps   |
| `drone`     | set 5                     | grey machinery; outer corners carry a status panel       |
| `civil.v1..4` | set 6                   | white drawers; coral / blue / amber / green colour band   |
| `bastion`   | set 8                     | slate armour; not tied to a faction yet                  |
| `scrap.p1..4` | -                       | default layout with bolted patch plates, rusty colours   |

Some pieces are left out of the look sets and stay default-only: doors, hull ghosts, and the corner fills
(`.m<mask>c<bits>`, `.end.<s|e>.c<n>`). The renderer has to fall back to the default id for these.

## Renderer: one look per tile

`src/render/tiles.ts` (around line 212) builds its chains from `pre = tile.${fam}.${PRE[level]}`. The change is to put
the look in front of the default:

```ts
const pre = `tile.${fam}.${PRE[level]}`;
const lpre = look ? `tile.${fam}.${look}.${PRE[level]}` : null;
// chain: [lpre-variant ids..., then today's ids...] so missing look art falls back cleanly
```

Corner fills come first in today's chain. Put them after the look's plain `m<mask>` id, otherwise a corner tile would
show the default look in the middle of a faction wall. Do this until the look sets include corners
(`structure.CORNER`). Floors work the same way (`tile.floor.<look>.*`).

Pick the look the way `beamLookFor(s.gen?.faction)` does (`src/render/beamArt.ts`, `scene.ts:225`):

```ts
const STRUCT_LOOK_OF = { 'faction.navy': 'navy', 'faction.drones': 'drone', 'faction.civilian': civilV(seed) };
```

- **civil:** pick `civil.v1..v4` from the ship seed (`hash(seed, 4)`), so each civilian ship has its own colourway.
- **Player and handmade ships:** keep the default look.
- **Scrappers:** they use a look per section, described next. A scrapper ship has no single look.

## Scrappers: the donor look per section

Scrapper ships are welded from donor sections. Each section already records where it came from:

- `Block.donor` is carried into `AsmRecord.donor` in `arranger.ts:374`.
- The values today are:
  - `'navy'`: bow, drive, battery and hulk, from `scrapDonors.ts`;
  - `'drone'`;
  - `'civil'`: civilKit, freighter, habitat, liner, station, barge, podString and tug, through `civil(origin, …)` in `scrapDonors.ts:175`;
  - `'scrap'`: improvised tubes, strapped engines, crates, airlocks and the patched reactor.

The donor-to-look mapping:

| donor   | look                                                                 |
|---------|----------------------------------------------------------------------|
| `navy`  | `navy`                                                               |
| `drone` | `drone`                                                              |
| `civil` | `civil.v<n>`, with `n` hashed from (ship seed, assembly id), so two civil donors on one ship can differ |
| `scrap` | `scrap.p<n>`, hashed the same way                                    |
| none    | `scrap.p1`, for hull fill plates and joins                           |

### The sim side: the only real code change

The donor is only in `ShipGenResult.debug` (`CompDebug.assemblies` + `asmOf`) today. That is debug output and is not
kept on the ship. The renderer needs a small, serializable per-tile record. One option:

- Add `GenOrigin.looks?: string[]`, a palette of look names, plus `lookOf: Uint8Array` (or an RLE string), one entry
  per tile in the grid frame (0 = default).
- Fill it in `generate.ts` next to the `debug` block, from `asmOf` and the assembly donors (mapping above). Seeded
  hashing only: no `Math.random`.
- If ships are regenerated from `(shipgen, seed)` on load, there is nothing to save. Recompute it from the generator
  and cache it in the render scene.

A wall tile between two assemblies takes the look of the room side it faces. The simplest rule: the assembly of the
tile itself, or, if the tile has none, the assembly of its first non-hall neighbour. Seams between donor sections will
then show the look changing at the weld. That is the intent.

### Patches and scuffs on top

The `scrap.p*` looks bake their patch plates into the tiles. The user wants donor looks with wear applied on top. Two
ways to do that, cheapest first:

1. **Overlay sprites:** a small `tile.wear.*` set (bolted patches, scorch, scuffs, weld beads along a seam), each
   rendered as a see-through layer on the wall face. Put one on a tile by `tileHash` (for example 1 in 3 wall tiles
   on scrapper ships, and every tile on a donor seam). This needs a new Blender module (relief-only parts on an empty
   strip) and an overlay piece in `tiles.ts`, at `order` 2.
2. **Baked donor-plus-wear sets:** for example `tile.wall.navy.worn.*`. This doubles the sheet count. Not recommended.

Option 1 also gives breach-adjacent scorch and battle damage on any ship.

## Checklist for the main thread

- [ ] `structure` sheets in the manifest. Run `npm run sprites` with the full `STRUCT_LOOKS` set.
- [ ] `tiles.ts`: look prefix in the chains, with fallbacks; corner fills after the look's id.
- [ ] `structLookFor(gen)` for navy, drone and civil (seeded `vN`).
- [ ] Shipgen: a per-tile look record from the donors (`generate.ts`). Renderer: read it on scrapper ships.
- [ ] Wear overlay set and placement (a follow-up).
- [ ] Corner fills in the look sets (`structure.CORNER`). This needs corner handling in the looks' modules (`faction/`).
