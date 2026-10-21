# Rendering all art at 2x

How to re-render every sprite at twice the current pixel size on your own machine. Branch: `art/scale-2x` (main plus
the containers, module-pack and crew-weapons art branches, plus the `ART_SCALE` switch).

## What the switch does

`ART_SCALE=2` doubles the pipeline's pixel scale: tiles render at 128x64 instead of 64x32, crew frames at 256x240
(feet anchor 128,188), robot and alien frames at 264x248, and Sol's packs follow automatically (they size from the
tile). Nothing else changes: the same models are rendered at a higher pixel density. Without the variable everything
is exactly as before.

Not scaled (decide after seeing the result):
- Outlines stay 1 px, so they look thinner relative to the sprites.
- Weapons are still drawn 1.25x life size, which was needed at 62 px crew; at 2x 1.0 may look better
  (`SIZE` in `tools/blender/sprites/human_v2_weapons.py`).
- The crew models are still the simplified game-size body: at 2x the faces, hands and clothes look plain. A crew
  detail pass is the follow-up.

## Setup (once)

Linux, or Windows with WSL2 (Ubuntu). The pipeline uses a pinned Linux Blender 4.2.9; native Windows won't work.

```bash
git clone https://github.com/BigBadLoser/cc-ftl.git && cd cc-ftl
git checkout art/scale-2x
npm ci
export BLENDER_HOME=$HOME/tools          # where Blender gets installed (default /opt/tools needs root)
tools/blender/setup.sh                   # downloads Blender, prints its path
```

Keep `BLENDER_HOME` exported in every terminal you render from (or add it to `~/.bashrc`).

Disk: the crew render cache at 1x is about 140 MB, so expect about 0.5-1 GB at 2x, plus about 90 MB of sheets.

## Render

Run the crew workers and the families at the same time, in separate terminals. Each Blender process uses every core,
so with 8+ cores four crew workers plus the families job is about right; with fewer cores run two crew workers.

**Terminal 1: every non-crew family**, one after another into `public/assets`:

```bash
ART_SCALE=2 npm run sprites -- -- public/assets robots,aliens,env,walls,consoles,weapons,roof,robot_bay,vehicle_bay,shuttle,airlock,struct,fx,galley,derelict,eggsac,storage_set,medbay,battery,hydroponics,workbench,ops_consoles,cryo,wallprops,hazards,clutter,decay,corpse,damage,containers,sol,damage_sol
```

**Terminals 2-5: crew workers.** They only fill the render cache (`.cache/sprites/crew`); their output dirs are
thrown away. Split by clip:

```bash
ART_SCALE=2 npm run sprites -- -- /tmp/crew1 crew --clip walk,sleep
ART_SCALE=2 npm run sprites -- -- /tmp/crew2 crew --clip idle,work,eva_float
ART_SCALE=2 npm run sprites -- -- /tmp/crew3 crew --clip sit_idle,sit_work
ART_SCALE=2 npm run sprites -- -- /tmp/crew4 crew --clip aim_1h,fire_1h,aim_2h,fire_2h,aim_heavy,fire_heavy,walk_aim_1h,walk_aim_2h,walk_heavy,ready_1m,swing_1m,ready_2m,swing_2m,crouch_idle,crouch_walk,crouch_aim_1h,crouch_fire_1h,crouch_aim_2h,crouch_fire_2h,crouch_fire_heavy,crouch_ready_1m,lean_l_1h,lean_r_1h,lean_l_2h,lean_r_2h
```

With two workers, run the first two lines and then the last two.

**When all of them have finished: pack the crew** into `public/assets`. Every frame is already cached, so this takes
a few minutes:

```bash
ART_SCALE=2 npm run sprites -- -- public/assets crew
```

The log should say `0 misses`. If it renders anything, a worker didn't finish; let this run complete it.

Crew workers can be stopped and restarted at any time: finished frames stay in the cache.

## How long

The crew is most of it: about 34,000 frames. On the 4-core cloud container, the 1x crew took about 1.5-2 hours; a 2x
frame costs about 3-4 times as much. So expect roughly 6-8 hours on 4 cores, and proportionally less on a bigger CPU.
The families take a few hours together at 2x.

## Check and hand over

1. Spot-check a few sheets in `public/assets/sprites/` (for example `crew.human.body.idle.png`, `env.png`,
   `walls.png`): everything should be twice the size it is on `main`.
2. Commit `public/assets` on `art/scale-2x` and push. Skip `npm run check` for this commit: `heights.test.ts` expects
   the 1x heights in the manifest.
3. The game won't look right until the renderer is switched to 2x (main thread): the 64x32 tile size in `src/render`
   (`iso.ts` and friends), the heights test, camera zoom defaults (zoom 1 at 2x art = today's zoom 2), and anything
   else that assumes 1x pixel sizes. Crew frame sizes, anchors and muzzle offsets come from the manifest.

Don't merge `art/scale-2x` into `main` before the renderer side is done.
