import type { World } from '../sim/ecs';
import { playingAt } from '../sim/ai/machines/leisureSpots';
import { JobC, PositionC } from '../sim/crew/components';
import { isSettled } from '../sim/crew/helpers';
import { StorageC } from '../sim/items/components';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { depthKey } from './iso';
import { hullOutward, hullRow, hullSide, rotatedSize } from '../sim/modules/footprint';
import { ContainerC } from '../sim/containers/components';
import { PlotC } from '../sim/farm/components';
import { cropStage } from './cropStage';

/** Storage reads 'full' from this share of its slots upward. */
const FULL_SHARE = 0.75;

/** Fill class of a storage module from its slots in use. */
export function storageFill(world: World, id: number): 'empty' | 'partial' | 'full' {
  const s = world.get(id, StorageC);
  if (!s || s.stacks.length === 0) return 'empty';
  return s.stacks.length >= s.capacity * FULL_SHARE ? 'full' : 'partial';
}

/** Share of an ore bin's slots in use up to which it shows its first and second fill sprite. */
const BIN_FILLS = [0.25, 0.6] as const;

/**
 * Art state of a storage module: `.empty/.partial/.full`, or for a def with `storageArt` (ore bins) `.empty`, else
 * `.<kind>.<fill1|fill2|full>` (an empty kind, as the scrap cage has: `.<fill>`) by the mapped item filling the most slots and the slots in use. Items with no kind are ignored.
 */
export function storageState(world: World, id: number, def: ModuleDef): string {
  const s = def.storageArt ? world.get(id, StorageC) : undefined;
  if (!def.storageArt || !s) return storageFill(world, id);
  if (s.stacks.length === 0) return 'empty';
  const by = new Map<string, number>();
  for (const q of s.stacks) {
    const kind = def.storageArt[q.item];
    if (kind !== undefined) by.set(kind, (by.get(kind) ?? 0) + 1);
  }
  const kind = [...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (kind === undefined) return storageFill(world, id);
  const share = s.stacks.length / Math.max(1, s.capacity);
  return `${kind ? `${kind}.` : ''}${share <= BIN_FILLS[0] ? 'fill1' : share <= BIN_FILLS[1] ? 'fill2' : 'full'}`;
}

/** Craft jobs by module id, for the renderer's "is it crafting" test. */
export function craftProgress(world: World): Map<number, number> {
  const out = new Map<number, number>();
  for (const id of world.query(JobC)) {
    const j = world.get(id, JobC);
    if (j?.kind === 'craft' && j.target) out.set(j.target, j.progress);
  }
  return out;
}

/** Console modules whose operator is seated at the chair (an 'operate' job on it, its crew settled on the job tile). */
export function mannedConsoles(world: World): Set<number> {
  const out = new Set<number>();
  for (const jobId of world.query(JobC)) {
    const j = world.get(jobId, JobC);
    if (j?.kind !== 'operate' || !j.target || !j.reservedBy) continue;
    const p = world.get(j.reservedBy, PositionC);
    if (p && isSettled(p) && p.x === j.x && p.y === j.y) out.add(j.target);
  }
  return out;
}

/** Leisure modules with someone playing (settled on a stand tile of a break). */
export const playedModules = (world: World): Set<number> => new Set(playingAt(world).keys());

/** Research modules with a crew member settled in their chair (the job tile), working its job. */
export function workedLabs(world: World): Set<number> {
  const out = new Set<number>();
  for (const jobId of world.query(JobC)) {
    const j = world.get(jobId, JobC);
    if (j?.kind !== 'research' || !j.target || !j.reservedBy) continue;
    const p = world.get(j.reservedBy, PositionC);
    if (!p || !isSettled(p)) continue;
    if (p.x === j.x && p.y === j.y) out.add(j.target);
  }
  return out;
}

/** Frames per second of a looping `.active` animation. The manifest does not carry animations.json, so this is the pack's rate (4 fps) for every module. */
export const ANIM_FPS = 4;

/** What the renderer knows about a module beyond the sim state: power off, the render clock, and whether the art has an id (no load queued). */
export interface ModuleLook {
  off: boolean;
  now: number;
  /** Hit points and their maximum: the art's `.damaged` (below half) and `.destroyed` (0) states. */
  hp?: number;
  maxHp?: number;
  has(id: string): boolean;
}

/** Frames of a looping state: `base`, `base.f1`, `base.f2`... while the art has them consecutively (1 = not animated). */
export function frameCount(has: (id: string) => boolean, base: string): number {
  let n = 1;
  while (has(`${base}.f${n}`)) n++;
  return n;
}

/** Frame index at render time `now` (ms) of an animation of `count` frames. */
export const animFrame = (now: number, count: number, fps = ANIM_FPS): number => Math.floor((Math.max(0, now) / 1000) * fps) % count;

/** A module reads as damaged below this share of its max hp (the containers' rule). */
export const DAMAGED_BELOW = 0.5;
/** A powered damaged machine's lights flicker: lit this long, then dark this long (ms of render time). */
export const FLICKER_LIT_MS = 340;
export const FLICKER_DARK_MS = 170;

/**
 * The state art of a module ahead of its idle chain, first match wins:
 * - `<asset>.rN.destroyed` at 0 hp;
 * - `.damaged` under half hp, which while powered alternates with the dark `.damaged.flicker` (340 ms lit, 170 ms dark) and while
 *   unpowered stays on `.damaged.flicker`;
 * - `.unpowered` while off;
 * - the current `.active` frame (`.active`, `.active.f1`...) when the art animates.
 * Each only when the art has the id. `anim` names an animation whose frames swap texture (no rebuild).
 */
export function stateArt(def: ModuleDef, rot: number, active: boolean, look?: ModuleLook): { head: string[]; anim?: string } {
  if (!look) return { head: [] };
  const base = `${def.asset}.r${rot}`;
  if (look.hp !== undefined && look.maxHp) {
    if (look.hp <= 0 && look.has(`${base}.destroyed`)) return { head: [`${base}.destroyed`] };
    const lit = `${base}.damaged`;
    const dark = `${base}.damaged.flicker`;
    if (look.hp > 0 && look.hp < look.maxHp * DAMAGED_BELOW && look.has(lit)) {
      if (!look.has(dark)) return { head: [lit] };
      if (look.off) return { head: [dark] };
      const on = Math.max(0, look.now) % (FLICKER_LIT_MS + FLICKER_DARK_MS) < FLICKER_LIT_MS;
      return { head: [on ? lit : dark], anim: lit };
    }
  }
  if (look.off && look.has(`${base}.unpowered`)) return { head: [`${base}.unpowered`] };
  if (!active) return { head: [] };
  const n = frameCount(look.has, `${base}.active`);
  if (n < 2) return { head: [] };
  const f = animFrame(look.now, n);
  return { head: [f ? `${base}.active.f${f}` : `${base}.active`], anim: `${base}.active` };
}

/**
 * A derelict ruin's look merged into a layer's chain: the ruin's own art first (an explicit override), then the first `headLen`
 * ids (the live state art: destroyed, damaged / flicker, unpowered, active), then the ruin's `.damaged` / `.destroyed` suffix
 * stand-ins, then the rest. The live state wins over the equivalent suffix, so a flickering or unpowered ruin shows its dark frame.
 */
export const mergeRuinChain = (chain: string[], headLen: number, art: string[], suffix: string[]): string[] =>
  [...art, ...chain.slice(0, headLen), ...suffix, ...chain.slice(headLen)];

/**
 * Asset ids to try for a module, most specific first: the rotation variant (`.r0`..`.r3`) with the state variant
 * (`.active`, or storage `.empty/.partial/.full`), the rotation variant, then the plain state variant and the plain
 * asset. A non-square module drawn from the plain asset at an odd rotation is mirrored (moduleView). With a `look`, the
 * `.unpowered` art or the current `.active` animation frame comes first (see `stateArt`).
 */
export function moduleAssets(world: World, id: number, m: Module, def: ModuleDef, active: boolean, look?: ModuleLook): string[] {
  const state = def.storage ? `.${storageState(world, id, def)}` : active ? '.active' : '';
  const rot = `.r${m.rot}`;
  return [...stateArt(def, m.rot, active, look).head, `${def.asset}${rot}${state}`, `${def.asset}${rot}`, `${def.asset}${state}`, def.asset];
}

/**
 * Art ids of a container shell, most specific first, and its stand-in key: damaged under half hp, destroyed at 0. The
 * door end (the clamped short end, `n e s w`) picks the sprite: `container.<W>x<H>.r<N>.<end>[.state]` first.
 */
export function containerChain(def: ModuleDef, rot: number, hp: number, end = 'n', variant = ''): { chain: string[]; key: string } {
  const a = def.asset;
  const state = hp <= 0 ? '.destroyed' : hp < def.maxHp / 2 ? '.damaged' : '';
  const r = `.r${rot}`;
  const v = variant ? [`${a}${r}.${end}${variant}${state}`, `${a}${r}.${end}${variant}`] : [];
  return { chain: [...v, `${a}${r}.${end}${state}`, `${a}${r}.${end}`, `${a}${r}${state}`, `${a}${r}`, `${a}${state}`, a], key: `${a}${state}` };
}

/** Shell variants of the container art (`.v1` stencil code and hazard roof edge, `.v2` flat panelled and rusted; none = the plain one), picked by the container's id. */
export const containerVariant = (id: number): string => ['', '.v1', '.v2'][id % 3] as string;
/** Company logos of the container art; a ship's containers mostly carry the logo its seed picks, now and then another. */
export const CONTAINER_LOGOS = ['halvard', 'meridian', 'vantor', 'talos', 'sable'] as const;
export const containerLogo = (id: number, seed: number): string => CONTAINER_LOGOS[(seed + (id % 4 === 0 ? 1 + (id % 3) : 0)) % CONTAINER_LOGOS.length] as string;

/** The footprint tile in the middle of a container's clamped side (where the clamp mark sits). */
function clampTile(def: ModuleDef, m: Module, side: string): { x: number; y: number } {
  const [w, h] = rotatedSize(def, m.rot);
  if (side === 'n') return { x: m.x + (w >> 1), y: m.y };
  if (side === 's') return { x: m.x + (w >> 1), y: m.y + h - 1 };
  if (side === 'w') return { x: m.x, y: m.y + (h >> 1) };
  return { x: m.x + w - 1, y: m.y + (h >> 1) };
}

/** The front-most footprint tile (largest x + y) on diagonal `d` = x - y of the footprint [x, x + w) x [y, y + h): the depth key of that diagonal's screen strip. */
export function diagonalFront(x: number, y: number, w: number, h: number, d: number): { x: number; y: number } {
  const tx = x + w - 1;
  const ty = y + h - 1;
  const dd = Math.min(tx - y, Math.max(x - ty, d));
  const fx = Math.min(tx, dd + ty);
  return { x: fx, y: fx - dd };
}

/** Which footprint tiles a stand-in sprite of a layer is repeated on (real art is one sprite per layer). */
export type LayerTiles = 'all' | 'hull' | 'rest';

/** One sprite layer of a module: tried in order, with `key` naming its stand-in. */
export interface ModuleLayer {
  chain: string[];
  key: string;
  tiles: LayerTiles;
  /** Depth offset over the module's key (a console's desk front draws over its seated operator). */
  dz?: number;
  /** Its glow is light that falls on whoever sits at the module (a game table's hologram), so it paints over them even from a layer above SEAT_DZ. */
  glowOver?: boolean;
  /** Lies outside the hull (an engine bell): sorts by the tile just beyond the hull row's front tile. */
  out?: boolean;
  /** Real art is cut into screen strips, one per footprint diagonal, each sorted by its front-most tile (a pit crew walk around). */
  strips?: boolean;
  /** One sprite on this tile (the airlock's parts are 1x1 sprites each anchored at their own tile), not at the footprint's front tile. */
  at?: { x: number; y: number };
  /** With `at`: a deck mark, sorted under everything standing on the floor. */
  flat?: boolean;
  /** A livery overlay of a container shell (`<shell>.paint`, `<shell>.lv`): recoloured by the ship's livery; drawn only if the art has it. */
  overlay?: 'paint' | 'lv';
  /** A hydroponics bed's base: a code-drawn trough (render/bedBox.ts) stands in while the manifest lacks its sheet. `lit` while the bed runs. */
  bed?: { lit: boolean };
  /** A hydroponics bed's crop layer: drawn from the art when it has the id, else from a code-drawn stand-in (render/cropOverlay.ts). */
  crop?: { crop: string; stage: 'sprout' | 'grow' | 'ripe' };
  /** Drawn only if the art has it (never a stand-in): container paint, lv and logo layers. */
  /** A colour multiplied into this layer's art and glow (a status lamp drawn white, lit in the colour of its state). */
  tint?: number;
  optional?: boolean;
  /** The chain's head is a frame of this looping animation (an `.active` base id): the view swaps the texture as frames advance instead of rebuilding. */
  anim?: string;
  /** Stays drawn on a roofed ship (hull block, collar); the other parts are under the roof. */
  roofVisible?: boolean;
  /** Roofed, dropped where the grid draws the new hull's exterior piece on this tile (the airlock's hull block stays
   *  only where the hull has no art there, e.g. in a region with rock walls). */
  hullFallback?: { x: number; y: number };
  /** Always recoloured by this colour of the ship's hull paint, as the hull's own pieces are (an engine's end cut: the cut tops' black). */
  paint?: 'armour' | 'deco';
}

/** Depth offset of a seated operator over the console's key, and of the desk-front overlay over it. */
export const SEAT_DZ = 0.02;
export const FRONT_DZ = 0.03;

/** Targetable on enemy ships: weapons, engines, shield generators and the AI core (what the combat overlay can aim at). */
export const isTargetable = (def: ModuleDef): boolean => !!(def.weapon || def.engine || def.shieldGen || def.aiCore);

/** True when a module shows its `.active` art: engines and machines while powered, consoles while manned, fabricators while crafting, research benches while worked. */
export function showsActive(def: ModuleDef, on: boolean, crafting: boolean, manned: boolean): boolean {
  if (!on) return false;
  if (def.leisure) return manned; // a game table or arcade in use
  if (def.console) return manned;
  if (def.crafting) return crafting;
  if (def.research) return manned;
  return !!(def.hullEdge || def.shieldGen || def.aiCore || def.recovery); // a recovery pod bubbles whenever it is powered
}

/**
 * The sprite layers of a module, bottom first.
 *  - Engines: `<asset>.hull.r{n}` (the bulkhead, never cut; with the walls up or roofed it stands in a gap of the hull wall, otherwise the hull tile draws it), the
 *    machine `<asset>.machine.r{n}` (cut by the wall; `.machine.open.r{n}` when the walls are down, `open`), the hull's thruster block
 *    `<asset>.block.r{n}` (`engineBlock`: in every view, outside the hull) and the bell outside the hull `<asset>.bell.r{n}`, both
 *    sorted by the tile beyond the hull row (`out`); `.active` while burning.
 *  - Weapons: the floor bay `<asset>.bay.r{n}`; the turret above it is drawn by turretView.
 *  - Consoles and seated modules (the research bench): the usual chain, then the desk-front overlay `<asset>.front.r{n}[.active]` over the seated operator.
 *  - Everything else: the usual chain from `moduleAssets`.
 */
/**
 * Whether an engine stands behind the hull's thruster block (`<asset>.block.r{n}`): its hull row faces the camera (+x or +y). Its
 * hull layer is then the row's two inner tiles of plain hull, full height in every view without a roof (the whole assembly
 * shows), closed at either end by a black cut; the far rotations keep the old bulkhead.
 */
export function engineBlock(def: ModuleDef, rot: number): boolean {
  const side = hullSide(def, rot);
  return side === 'e' || side === 's';
}

export function moduleLayers(world: World, id: number, m: Module, def: ModuleDef, active: boolean, open = false, livery?: { seed: number } | null, look?: ModuleLook): ModuleLayer[] {
  const a = def.asset;
  const r = `.r${m.rot}`;
  if (def.container) {
    // The shell (`container.<W>x<H>[.rN].<end>[.vN][.damaged|.destroyed]`), its livery overlays (paint, trim, a company logo; none
    // on a destroyed one: burnt off) and the clamp gripping it on the frame side.
    const box = world.get(id, ContainerC);
    const clamp = box?.clamp ?? 'n';
    const shell = containerChain(def, m.rot, m.hp, clamp, containerVariant(id));
    const at = clampTile(def, m, clamp);
    const dressed = m.hp > 0 && livery;
    const over = (suffix: string): string[] => shell.chain.map((c) => c + suffix);
    return [
      { ...shell, tiles: 'all', strips: true },
      ...(dressed ? [
        { chain: over('.paint'), key: `${shell.key}.paint`, tiles: 'all', overlay: 'paint', optional: true, strips: true, dz: 0.001 },
        { chain: over('.lv'), key: `${shell.key}.lv`, tiles: 'all', overlay: 'lv', optional: true, strips: true, dz: 0.002 },
        { chain: over(`.logo.${containerLogo(id, livery.seed)}`), key: `${shell.key}.logo`, tiles: 'all', optional: true, strips: true, dz: 0.003 },
      ] as ModuleLayer[] : []),
      { chain: [`container.clamp.${clamp}`, 'container.clamp'], key: 'container.clamp', tiles: 'all', at, dz: 0.04 },
    ];
  }
  if (def.hullEdge) {
    const burn = active ? ['.active'] : [];
    const variant = (part: string) => [...burn.map((b) => `${a}.${part}${r}${b}`), `${a}.${part}${r}`];
    const machine = [...(open ? variant('machine.open') : []), ...variant('machine'), ...burn.map((b) => `${a}.machine${b}`), `${a}.machine`];
    // The thruster block hangs outside the hull like the bell, just under it (the bell comes out of its port).
    const block: ModuleLayer[] = engineBlock(def, m.rot) ? [{ chain: [`${a}.block${r}`], key: `${a}.block`, tiles: 'hull', out: true, dz: -0.01, optional: true }] : [];
    return [
      { chain: [`${a}.hull${r}`, `${a}.hull`], key: `${a}.hull`, tiles: 'hull' },
      // The hull row's end cut over it, in the hull's paint (its black is the belly cut tops' around it).
      ...(engineBlock(def, m.rot) ? [{ chain: [`${a}.end${r}`], key: `${a}.end`, tiles: 'hull', optional: true, paint: 'armour', dz: 0.0005 } as ModuleLayer] : []),
      { chain: machine, key: active ? `${a}.machine.active` : `${a}.machine`, tiles: 'rest' },
      ...block,
      { chain: variant('bell'), key: `${a}.bell`, tiles: 'rest', out: true },
    ];
  }
  if (def.plot) {
    // A bed: the base `.on` (a crop in the soil and the bed running) or `.off`, and over it the crop at its stage when one is planted.
    // Its damage art (`.damaged` / flicker, `.destroyed`) comes first; a destroyed bed shows no crop.
    const plot = world.get(id, PlotC);
    const lit = !!plot?.planted && m.powered && m.enabled && m.hp > 0;
    const s = lit ? 'on' : 'off';
    const st = stateArt(def, m.rot, active, look);
    const hurt = st.head.filter((h) => /\.(damaged(\.flicker)?|destroyed)$/.test(h));
    const chain = [...hurt, `${a}${r}.${s}`, `${a}.${s}${r}`, ...moduleAssets(world, id, m, def, active, look)];
    const base: ModuleLayer = { chain, key: a, tiles: 'all', bed: { lit }, ...(hurt.length && st.anim ? { anim: st.anim } : {}) };
    if (!plot || !plot.planted || m.hp <= 0) return [base];
    const crop = plot.planted.replace(/^crop\./, '');
    const stage = cropStage(plot.need ? plot.grown / plot.need : 0, plot.ready);
    return [base, { chain: [`${a}.crop.${crop}.${stage}${r}`], key: `${a}.crop`, tiles: 'all', dz: 0.01, crop: { crop, stage } }];
  }
  if (def.weapon || def.pointDefense) return [{ chain: [`${a}.bay${r}`, `${a}.bay`], key: `${a}.bay`, tiles: 'all' }];
  const main: ModuleLayer = { chain: moduleAssets(world, id, m, def, active, look), key: a, tiles: 'all', anim: stateArt(def, m.rot, active, look).anim };
  if (def.leisure) return leisureLayers(main, a, r, active, look);
  if (!def.console && !def.seated) return [main];
  const front = active ? [`${a}.front${r}.active`, `${a}.front${r}`] : [`${a}.front${r}`];
  return [main, { chain: front, key: `${a}.front`, tiles: 'all', dz: FRONT_DZ }];
}

/** Depth offset of a game table's hologram over its players (the front overlay is at FRONT_DZ). */
export const HOLO_DZ = 0.04;

/**
 * A leisure module (the game table, the arcade): the body, then the overlay `<asset>.front.r{n}[.state]` over the seated players and, while in use, the
 * hologram `<asset>.holo.r{n}.active`. The overlays animate in step with the body; each is only there if the art has it.
 */
function leisureLayers(main: ModuleLayer, a: string, r: string, active: boolean, look?: ModuleLook): ModuleLayer[] {
  const looped = (base: string, key: string, dz: number, fallback: string[], glowOver = false): ModuleLayer => {
    const n = active && look ? frameCount(look.has, base) : 1;
    const f = n > 1 && look ? animFrame(look.now, n) : 0;
    return { chain: [...(n > 1 ? [f ? `${base}.f${f}` : base] : []), ...fallback], key, tiles: 'all', dz, optional: true, ...(n > 1 ? { anim: base } : {}), ...(glowOver ? { glowOver } : {}) };
  };
  const out = [main, looped(`${a}.front${r}.active`, `${a}.front`, FRONT_DZ, active ? [`${a}.front${r}.active`, `${a}.front${r}`] : [`${a}.front${r}.unpowered`, `${a}.front${r}`])];
  if (active) out.push(looped(`${a}.holo${r}.active`, `${a}.holo`, HOLO_DZ, [`${a}.holo${r}.active`], true));
  return out;
}

/**
 * Depth key of a layer's additive glow. It sits just over the layer, except for a layer that draws over the seated operator
 * (a console's desk front): its glow stays under the operator, so the screens' light never paints over their head. A `glowOver` layer
 * (a hologram) keeps its glow over the layer, and so over the seated players.
 */
export function glowKey(layer: ModuleLayer, key: number): number {
  return !layer.glowOver && layer.dz !== undefined && layer.dz >= SEAT_DZ ? key - layer.dz + SEAT_DZ - 0.005 : key + 0.01;
}

/**
 * Depth key of layer `i` of a module drawn on a tile whose own module key is `key`. An engine's bell sorts by the tile
 * beyond its hull row (`out`). On a roofed ship the engine's other layers (bulkhead and machine) sort under the roof plates of its footprint
 * (just before its rear-most tile's plate), so the roof hides everything inboard and only the bulkhead top and the bell
 * show, like the hull around it. Drawn at its front tile they would paint over the roof.
 */
export function layerKey(def: ModuleDef, m: Module, layer: ModuleLayer, i: number, roofed: boolean, key: number): number {
  if (layer.at) {
    // Parts on their own tile: a deck mark is flat, the collar hangs outside the hull like a bell, the rest sort by their tile.
    if (layer.flat) return depthKey(layer.at.x, layer.at.y) - 0.5;
    if (layer.out) return depthKey(layer.at.x, layer.at.y) + 0.5;
    return key + (layer.dz ?? i * 0.001);
  }
  if (layer.out) {
    // The bell hangs outside the hull toward space: it draws over the hull behind it and under anything nearer.
    const row = hullRow(def, m.x, m.y, m.rot);
    const side = hullSide(def, m.rot);
    const front = row.reduce((p, t) => (t.x + t.y > p.x + p.y ? t : p), row[0] ?? { x: m.x, y: m.y });
    const o = side ? hullOutward(side) : { x: 0, y: 0 };
    return depthKey(front.x + o.x, front.y + o.y) + 0.5 + (layer.dz ?? 0);
  }
  if (roofed && def.hullEdge) return depthKey(m.x, m.y) + 0.85 + i * 0.001;
  return key + (layer.dz ?? i * 0.001);
}
