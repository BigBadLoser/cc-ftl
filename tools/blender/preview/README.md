# Hull preview harness

Renders hull and belly pieces straight from the sprite code (no sheets, no manifest) and composes them into test
ships, so art changes can be checked in place: cut away, roofed with the walls on, with the bay looks mixed, and
tinted with a hull colour. It is how the belly and exterior hull reviews were made.

## Scale

`render.py` renders at the 64x32 baseline (`ART_SCALE` 1). The game's sheets are 128x64 (`sprites/scale.py`),
where the art's px literals are doubled. Judge line work at 64x32 here, and know that the game shows it twice
as big.

## Render pieces

```
B=$(tools/blender/setup.sh | tail -1)      # the Blender binary
cd tools/blender/preview
SPRITE_SS=4 $B -b --factory-startup --python render.py -- <repo root> <out dir> <jobs file> ["id,id,..."]
```

Each job writes `<out dir>/<sprite id>.npz` (`rgba`, anchor `a`). A failing job prints `FAIL` and the rest go
on; an empty one prints `EMPTY`.

| Jobs file | What | Options (env) |
| --- | --- | --- |
| `jobs_floors.py` | the two floor tiles under the rooms | |
| `jobs_belly_look.py` | belly pieces (under layer, low over layer) in one bay look, for every key of the ships | `LOOK` (20 plain, 21 grille, 22 blister, 26 fins, 27 plate, 28 conduit), `SHIPS` |
| `jobs_belly_deco.py` | the same, plus each piece's tint mask (`.deco`) | `LOOK`, `SHIPS`, `DECO_ONLY=1` |
| `jobs_extset.py` | the exterior run set as the game builds it (near runs and corners, a1–a3 designs) | `MASKS=1`: tint masks too (`.deco`, `.seam`) |
| `jobs_gen.py` | the generic exterior pieces (diagonals, far sides, notches) and roof stand-ins for the ships' keys | `SHIPS` |
| `jobs_gendeco.py` | the generic pieces' tint masks | `SHIPS` |

Ships (`belly_shapes.py`): `oct3`, `oct1` (chamfered rooms), `taper2` (a body narrowing to a nose), `cross`
(notched corners), `steps`, and `s<seed>` for a hull-catalog ship (`s653`, `s872`, `s1040`, `s2420` have narrow
notches, holes and short diagonals). `SHIPS` defaults to `oct3 taper2 s1040 s2420`.

## Compose ships

```
python3 belly_mock.py <out.png> <scale> <ship> low <npz dir> [<npz dir> ...]
```

Each sprite comes from the first dir that has it, so put fresh renders first: a stale dir earlier in the list
silently wins (`SRC=1` prints which dir each kind came from). The options are in the script's docstring; the
common ones:

- Cut away: `python3 belly_mock.py out.png 2 taper2 low <belly dir> <floors dir>`
- Looks mixed: `MIX=<look20 dir>,<look22 dir>,...` (one dir per look, picked per tile by a hash).
- Roofed, walls on, as the game picks pieces: `EXTVAR=1 EXT=2`, with the run set and generic dirs after the belly
  and floor dirs.
- Tinted: `TINT=r,g,b` multiplies the colour over each piece's mask (`.deco`, less its `.seam`).

Example, a roofed teal ship with three looks mixed:

```
O=/tmp/pv
for L in 20 22 27; do LOOK=$L SHIPS=taper2 SPRITE_SS=4 $B -b --factory-startup --python render.py -- ../../.. $O/look$L jobs_belly_deco.py; done
SPRITE_SS=4 $B -b --factory-startup --python render.py -- ../../.. $O/floors jobs_floors.py
MASKS=1 SPRITE_SS=4 $B -b --factory-startup --python render.py -- ../../.. $O/extset jobs_extset.py
SHIPS=taper2 SPRITE_SS=4 $B -b --factory-startup --python render.py -- ../../.. $O/gen jobs_gen.py
SHIPS=taper2 SPRITE_SS=4 $B -b --factory-startup --python render.py -- ../../.. $O/gen jobs_gendeco.py
MIX=$O/look20,$O/look22,$O/look27 TINT=110,215,205 EXTVAR=1 EXT=2 \
  python3 belly_mock.py $O/ship.png 2 taper2 low $O/look20 $O/floors $O/extset $O/gen
```

## Checks

- `showpieces.py <out.png> <npz> ...`: pieces side by side at 4x on magenta, each with its tile's diamond.
- `foot_scan.py <mask.npz>`: lone dots along the line where the exterior's foot meets the belly
  (`belly_mock.py ... EXTMASK=<mask.npz> EXT=2`). The ledge's anti-aliased highlight shows up as alternating
  hits on corners; that is expected.
- `roof_rule.py`: the game's roof plating rule (`roofArt.roofTile`), ported for the mock.
