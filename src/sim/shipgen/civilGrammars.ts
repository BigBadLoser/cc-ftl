import { mirrorBlock, type Block, type Side } from './arranger';
import { hallBlock } from './blocks';
import { habitat, podString, station } from './civilBlocks';
import { linerBody, type LinerShape } from './civilFrames';
import { arms, byVariant, civil, cratesOf, crewBlock, dome, join, shuffle, stern } from './civilKit';
import { freighter, mining } from './civilShips';
import { latticeStation, ringStation } from './civilStations';
import { dockBlock } from './navyBlocks';
import { jobs, no, type Ctx } from './navyKit';
import type { RoomSpec } from './plan';
import type { CivilGrammar, FactionDef } from './types';

/**
 * Civilian grammars on the shared arranger, from the shared civil builders (`civilBlocks.ts`, also the scrappers'
 * donors) and the civil frames (`civilFrames.ts`, `civilStations.ts`). Lightly armed: point defence in the core room,
 * the odd single light gun on a sponson. Each family has several topologies, drawn once per ship (`c.variant`), and
 * most of them join sideways or lengthways (grafts and beams), not corridor end to corridor end:
 *   freighter  frame (containers slung between beam rails, crew and drive aft), offset (the crew block beside the
 *              cargo mass), tug (a crewed tug pushing a cargo body on a truss)
 *   liner      one wide 2D hull (teardrop, oval, or a flat twin hull), cockpit fore, drive aft
 *   mining     cage (an ore cage beside the crew block), boom (the rig on a long offset boom), struts (v20, minority)
 *   station    ring (rooms round an empty centre, spokes to a hub), lattice (modules on a grid, tubes and beams),
 *              stack (large modules offset along a mast); thrusters inside the structure, no bow or stern
 */


/** Liner bow: the cockpit alone, or with an observation dome (or a stepped pair of domes) ahead of it. */
function linerBow(c: Ctx, root: number): boolean {
  const form = c.rng.pick(['plain', 'dome', 'stepped'] as const);
  c.parts.push(`bow ${form}`);
  if (form === 'plain') return true;
  const d1 = dome(c.rng, c.rng.int(2, 4), c.rng.int(3, 6));
  const a = d1 ? c.A.attach(root, d1, { side: 'w', align: 'mid', doors: 1 }) : null;
  if (a === null) return no(c, 'dome');
  if (form === 'dome') return true;
  const d2 = dome(c.rng, c.rng.int(2, 3), c.rng.int(2, Math.max(2, (d1?.rows.length ?? 5) - 4)));
  return (d2 !== null && c.A.attach(a, d2, { side: 'w', align: 'mid', doors: 1 }) !== null) || no(c, 'dome');
}


/** Liner: one wide hull (cabins in 2D, lounges fore), a cockpit ahead of it, the drive aft. */
function linerHull(c: Ctx): boolean {
  const j = jobs(c.plan);
  const docks = j.crew.filter((r) => r.role === 'dock');
  const root = crewBlock(c, [...j.core, ...docks, ...j.stores]);
  if (root === null) return no(c, 'cockpit');
  const shape = byVariant(c, [['teardrop', 2], ['oval', 2], ['twin', 2]] as [LinerShape, number][]);
  const beds = c.plan.quarters.reduce((t, r) => t + r.mods.filter((m) => m === 'module.bed').length, 0);
  const ls = c.plan.quarters.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
  const lounges: RoomSpec[] = [{ role: 'support' as const, mods: ls, w: c.rng.int(3, 4), h: 3 }, ...c.plan.support.map((s) => ({ ...s, w: Math.max(3, s.w) }))].filter((r) => r.mods.length > 0);
  const cabin = c.rng.pick([[2, 2], [3, 2], [2, 3]] as [number, number][]);
  const form = {
    peak: shape === 'oval' ? c.rng.pick([0.35, 0.5, 0.65]) : c.rng.pick([0.2, 0.3, 0.45]),
    tail: c.rng.pick([0, 0.2, 0.4]), nose: c.rng.pick([0.1, 0.35, 0.6]), amp: c.rng.int(2, 4), extra: c.rng.int(0, 4),
  };
  const body = join(c, root, civil(linerBody(c.rng, beds, lounges, shape, cabin, form), 'habitat', `${shape} hull`));
  if (body === null) return no(c, 'hull');
  c.parts.push(`${shape} ${form.peak}/${form.nose}/${form.tail}`);
  // Blisters: a few small observation domes at seeded places along the hull.
  for (let k = c.rng.int(0, 3); k > 0; k--) {
    const d = dome(c.rng, c.rng.int(2, 4), c.rng.int(2, 3));
    const side = c.rng.chance(0.5) ? 'n' : 's';
    if (d) c.A.attach(body, side === 'n' ? d : mirrorBlock(d), { side, align: 'any', doors: 1 });
  }
  if (c.rng.chance(0.3) && !linerBow(c, root)) return false;
  return stern(c, body) && arms(c, [body], j.guns);
}


/** Station: ring, lattice or stack, picked by seed. */
function stationHull(c: Ctx): boolean {
  const j = jobs(c.plan);
  const crew = j.crew.filter((r) => r.role !== 'dock');
  const topo = byVariant(c, [['ring', 2], ['lattice', 2], ['stack', 2]] as ['ring' | 'lattice' | 'stack', number][]);
  c.parts.push(topo);
  if (topo === 'stack') return stack(c, crew);
  const rooms = [...j.core, ...crew, ...j.stores];
  if (topo === 'ring') {
    const spokes = shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, c.rng.int(2, 4));
    const o = { extra: c.rng.int(0, 5), weight: [c.rng.pick([0.6, 1, 1.6]), c.rng.pick([0.6, 1, 1.6]), c.rng.pick([0.6, 1, 2.5])], inner: c.rng.chance(0.5) };
    c.parts.push(`spokes ${spokes.join('')}${o.inner ? ' thick' : ''}`);
    const b = civil(ringStation(c.rng, c.plan.command, shuffle(c.rng, rooms), c.plan.engines, c.plan.reactors, spokes, o), 'command', 'ring station');
    if (!b) return no(c, 'ring');
    return arms(c, [c.A.placeRoot(b)], j.guns);
  }
  const reactors: RoomSpec[] = [];
  for (let k = c.plan.reactors; k > 0; k -= 2) reactors.push({ role: 'reactor', mods: Array<string>(Math.min(2, k)).fill('module.reactor'), w: 2 * Math.min(2, k) + 2, h: 4 });
  const mods = shuffle(c.rng, [...rooms, ...reactors]);
  const o = { gx: c.rng.int(2, 7), gy: c.rng.int(2, 6), spread: c.rng.pick([0.7, 1.3, 2.2]), holes: c.rng.pick([0, 0.15, 0.3]), pad: c.rng.int(0, 2) };
  c.parts.push(`grid ${o.spread}/${o.gx}x${o.gy}`);
  const b = civil(latticeStation(c.rng, [c.plan.command, ...mods], c.plan.engines, o), 'command', 'lattice station');
  if (!b) return no(c, 'lattice');
  return arms(c, [c.A.placeRoot(b)], j.guns);
}

/** Stack station: large modules offset along a north-south mast, airlocks at its ends, a thruster on an east module. */
function stack(c: Ctx, crew: RoomSpec[]): boolean {
  const j = jobs(c.plan);
  const hubRooms = [c.plan.command, ...j.core.slice(0, 2), ...crew.splice(0, 1)].slice(0, 4);
  const mods: Block[] = [];
  const hub = civil(station(c.rng, hubRooms), 'command', 'station hub');
  const pods = civil(podString(c.rng, Math.max(4, cratesOf(j.stores))), 'cargo', 'cargo pods');
  if (!hub || !pods) return no(c, 'modules');
  mods.push(hub, pods);
  if (crew.length > 0) {
    const hubR = crew.find((r) => r.role === 'support') ?? (crew[0] as RoomSpec);
    const rest = [...crew.filter((r) => r !== hubR), ...j.core.slice(2)];
    const hab = civil(habitat(c.rng, hubR, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'habitat', 'habitat ring');
    if (!hab) return no(c, 'habitat');
    mods.push(hab);
  }
  // Extra modules now and then: a second pod string, a spare habitat-style store ring.
  for (let k = c.rng.int(0, 2); k > 0; k--) {
    const extra = civil(podString(c.rng, c.rng.int(4, 10)), 'cargo', 'cargo pods');
    if (extra) mods.push(extra);
  }
  const H = mods.reduce((t, m) => t + m.rows.length, 0);
  const mast = hallBlock(c.rng, Math.ceil(H * c.rng.pick([0.5, 0.7, 0.9])) + c.rng.int(2, 10), c.rng.int(1, 2), false);
  for (const p of mast.ports) if (p.side === 'e' || p.side === 'w') p.multi = true;
  const root = c.A.placeRoot(mast);
  const order = shuffle(c.rng, mods);
  const aligns = ['start', 'mid', 'end'] as const;
  let side: Side = c.rng.chance(0.5) ? 'e' : 'w';
  let east: number | null = null;
  const hosts: number[] = [];
  for (const [i, m] of order.entries()) {
    const al = c.rng.chance(0.3) ? 'any' : (aligns[Math.min(2, Math.round((i * 2) / Math.max(1, order.length - 1)))] as 'start' | 'mid' | 'end');
    const id = c.A.attach(root, m, { side, align: al }) ?? c.A.attach(root, m, { side: side === 'e' ? 'w' : 'e', align: al });
    if (id === null) return no(c, 'module');
    hosts.push(id);
    if ((c.A.placed[id]?.x ?? 0) > (c.A.placed[root]?.x ?? 0)) east = id;
    if (c.rng.chance(0.7)) side = side === 'e' ? 'w' : 'e';
  }
  c.parts.push(`modules ${order.length}`);
  for (const [d, lock] of [['n', dockBlock(c.rng)], ['s', mirrorBlock(dockBlock(c.rng))]] as const) {
    if (c.A.attach(root, lock, { side: d, align: 'mid', doors: 1 }) === null) return no(c, 'airlock');
  }
  return (east !== null || no(c, 'east module')) && stern(c, east as number) && arms(c, hosts, j.guns);
}

export const CIVIL_GRAMMARS: Record<CivilGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  freighter: (c) => freighter(c), liner: (c) => linerHull(c), mining: (c) => mining(c), station: (c) => stationHull(c),
};

