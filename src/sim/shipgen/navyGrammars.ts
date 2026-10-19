import { Builder } from './builder';
import { blockFrom, localBuilder } from './blocks';
import { bankBlock, clusterBlock, deckBlock, noseBlock } from './navyBlocks';
import { bands, chain, deckPair, evenDepth, jobs, mirrorBlock, no, order, propulsion, section, spanOf, twinDrives, type Ctx, type SectionPlan } from './navyKit';
import { componentBattleship, componentFrigate, linearHull } from './components';
import { rollProfile } from './profile';
import { pickNose } from './topoNavy';
import type { FactionDef, NavyGrammar } from './types';
import type { RoomSpec } from './plan';
import { pairUp } from './topoNavy';
import { shuffle } from './plan';
import { runLen } from './topoParts';

/**
 * Navy hull grammars on the 2D arranger. Major assemblies overlap lengthways or run in parallel layers (decks) rather
 * than sticking out as perpendicular wings; airlocks sit in hull faces (dock rooms inside decks and bands).
 */

const nose = (c: Ctx, f: FactionDef): number | null => {
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  return front ? c.A.placeRoot(front) : null;
};

const pick = <T>(c: Ctx, xs: readonly T[]): T => c.rng.pick(xs);

/**
 * Rooms per side in a spine section: few, so a ship with more rooms grows longer before it grows broader (warships
 * are long). Decks then run the length of the spine.
 */
/**
 * Move crew rooms from the decks into the spine until the decks (per side) are no longer than the spine: decks run
 * along the hull, never past its stern, and a ship with more rooms grows longer rather than broader.
 */
function balance(spine: RoomSpec[], deck: RoomSpec[], per: number): void {
  const half = (xs: RoomSpec[]): number => runLen(pairUp(xs)[0]);
  const spineLen = (): number => half(spine) + 2 * Math.ceil(pairUp(spine)[0].length / Math.max(1, per));
  for (let i = deck.length - 1; i >= 0 && half(deck) > spineLen(); i--) {
    if ((deck[i] as RoomSpec).role !== 'weapons') spine.push(...deck.splice(i, 1));
  }
}

const slim = (c: Ctx): number => (c.rng.chance(0.7) ? 1 : Math.min(2, c.fam.sectionRooms));

/** Small hull with parallel decks: guns fore, a core chain, crew decks laid along it. */
function deckPairGrammar(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const guns = bands('battery', j.guns, 2);
  const per = slim(c);
  const spineRooms = [...j.core, ...j.stores];
  balance(spineRooms, j.crew, per);
  const secs = [...guns, ...bands('core', spineRooms, per)];
  evenDepth(c, ['core']);
  const ids = chain(c, root, secs, secs.length - 1);
  if (!ids) return false;
  const host = ids[ids.length - 1] as number;
  if (!propulsion(c, host, pick(c, c.fam.propulsion))) return false;
  // Crew decks run the length of the core sections, behind the guns (their faces stay open).
  const core = ids.slice(guns.length);
  return !!deckPair(c, host, host, 'crew', j.crew, 'start', spanOf(c, core.length > 0 ? core : [host])) || no(c, 'decks');
}

/** Frigate variant: spine with short wing decks amidships carrying their own engine pods (distributed drive). */
function spineWings(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const spine = [...bands('battery', j.guns, 2), ...order(c.rng, bands('core', [...j.core, ...j.stores], c.fam.sectionRooms))];
  const hostAt = Math.max(0, spine.length - 1);
  const ids = chain(c, root, spine, hostAt);
  if (!ids) return false;
  const host = ids[hostAt] as number;
  if (!propulsion(c, ids[ids.length - 1] as number, 'cluster')) return false;
  return !!deckPair(c, host, host, 'crew', j.crew, 'end', { xMin: spanOf(c, ids).xMin }) || no(c, 'wing decks');
}

/** Cruiser: a citadel flanked by long parallel sections, nose fore, one drive aft. */
function citadelFlanked(c: Ctx, f: FactionDef): boolean {
  const j = jobs(c.plan);
  const cit = section(c, { kind: 'core', top: [], bottom: [], sponson: false, centre: j.core.length > 0 ? j.core : j.stores.splice(0, 1), extra: [[], []] });
  if (!cit) return no(c, 'citadel');
  const root = c.A.placeRoot(cit);
  c.parts.push('citadel');
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  if (!front || c.A.attach(root, front, { side: 'w' }) === null) return no(c, 'nose');
  if (!propulsion(c, root, pick(c, c.fam.propulsion))) return false;
  const cit2 = spanOf(c, [root]);
  const flank = deckPair(c, root, root, 'flank', [...j.crew, ...j.stores], 'start', cit2);
  if (!flank) return no(c, 'flanks');
  // Gun decks the length of the flanks (no stub decks), stepped back a little or flush.
  const fl = spanOf(c, [flank[0]]);
  const inset = c.rng.int(0, 2) * 2;
  return !!deckPair(c, flank[0], flank[1], 'gun', j.guns, 'start', { span: fl.span - inset, xMin: fl.xMin + inset }) || no(c, 'gun decks');
}

/** Cruiser: twin parallel hulls, joined by a short citadel forward, each hull with its own drive (a gap between). */
function twinHull(c: Ctx, f: FactionDef): boolean {
  const j = jobs(c.plan);
  const cit = section(c, { kind: 'core', top: [], bottom: [], sponson: false, centre: j.core.length > 0 ? j.core.slice(0, 2) : j.stores.splice(0, 1), extra: [[], []] });
  if (!cit) return no(c, 'citadel');
  const root = c.A.placeRoot(cit);
  c.parts.push('citadel');
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  if (!front || c.A.attach(root, front, { side: 'w' }) === null) return no(c, 'nose');
  const rest = [...j.core.slice(2), ...j.crew, ...j.stores];
  // Side hulls profiled: a stepped outer edge (one room deeper where the hull is broadest), the same for both.
  const profile = rollProfile(() => c.rng.next(), c.depth.habitat ?? 3, (c.depth.habitat ?? 3) + 1);
  const hulls = deckPair(c, root, root, 'hull', [...rest, ...j.guns], 'start', { xMin: spanOf(c, [root]).xMin, profile });
  if (!hulls) return no(c, 'hulls');
  // Drives pushed outboard: the gap between the hulls stays open aft.
  return twinDrives(c, hulls, pick(c, c.fam.propulsion), 'start');
}

/**
 * A hangar with unequal outboard decks. Each bank carries its own functions and
 * aft engine section; the original symmetric layout remains available. This
 * changes the positions of major hull masses without inventing empty sections.
 */
function offsetCarrierDecks(c: Ctx, root: number, rooms: RoomSpec[]): [number, number] | null {
  const [a, b] = pairUp(shuffle(c.rng, [...rooms]));
  // Move one substantial functional compartment to one bank, so the two decks
  // have distinct lengths and don't just mirror one another.
  if (b.length < 2) return null;
  const extra = c.rng.int(1, Math.min(2, b.length - 1));
  a.push(...b.splice(0, extra));
  // A compact carrier should not have one unsupported forty-tile prong.
  // Rebalance large room groups until the two sides differ by at most ~10 tiles.
  const len = (xs: RoomSpec[]): number => xs.reduce((n, r) => n + r.w + 1, 0);
  for (let guard = 0; guard < 8 && len(a) - len(b) > 10 && a.length > 2; guard++) {
    const moved = a.pop();
    if (moved) b.unshift(moved);
  }
  const side0 = (c.variant ?? 0) < 0.5 ? 'n' : 's';
  const side1 = side0 === 'n' ? 's' : 'n';
  const min = spanOf(c, [root]).xMin;
  const d = c.depth.habitat ?? 3;
  const attachDeck = (specs: RoomSpec[], side: 'n' | 's', align: 'start' | 'end'): number | null => {
    const raw = deckBlock(c.rng, 'hull', specs, d);
    if (!raw) return null;
    const blk = side === 'n' ? raw : mirrorBlock(raw);
    for (const port of c.A.free(root, side)) {
      const id = c.A.attach(root, blk, { side, parentPort: port.id, align, xMin: min, doors: 1 });
      if (id !== null) return id;
    }
    return null;
  };
  const one = attachDeck(a, side0, 'end');
  if (one === null) return null;
  const two = attachDeck(b, side1, 'end');
  if (two === null) return null;
  const e = Math.max(1, Math.ceil(c.plan.engines / 2));
  const r = Math.max(1, Math.ceil(c.plan.reactors / 2));
  for (const host of [one, two]) {
    const block = c.rng.chance(0.5) ? bankBlock(c.rng, e, r) : clusterBlock(c.rng, e, r);
    if (!block || c.A.attach(host, block, { side: 'e' }) === null) return null;
  }
  c.parts.push('offset hull banks');
  return side0 === 'n' ? [one, two] : [two, one];
}

/** Carrier: a hangar block with hull decks along it (real volume), an offset island, nacelles aft. */
function carrierIsland(c: Ctx, f: FactionDef): boolean {
  const j = jobs(c.plan);
  const hb = section(c, { kind: 'hangar', top: [], bottom: [], sponson: false, centre: c.plan.hangars, extra: [[], []] });
  if (!hb) return no(c, 'hangar');
  const root = c.A.placeRoot(hb);
  c.parts.push('hangar');
  const [bowGuns, ...more] = bands('battery', j.guns, 2);
  const bow = bowGuns ? section(c, bowGuns) : null;
  const bowId = bow ? c.A.attach(root, bow, { side: 'w' }) : null;
  if (bow && bowId === null) return no(c, 'bow');
  // The island contains the actual command room. An unarmed forepeak gives
  // this broad hangar hull a proper prow without duplicating a helm or guns.
  const forePlan = {
    ...c.plan,
    command: { ...c.plan.command, role: 'cargo' as const, mods: [], stock: true },
    weapons: [],
  };
  const nose = noseBlock(c.rng, pickNose(new Builder(c.rng), f, forePlan));
  const prow = nose ? { ...nose, kind: 'forepeak', label: 'forepeak' } : null;
  if (!prow || c.A.attach(bowId ?? root, prow, { side: 'w' }) === null) return no(c, 'forepeak');
  c.parts.push('forepeak');
  // Crew, core, stores and the remaining guns in hull decks along the hangar: they give it real volume.
  const rooms = [...j.crew, ...j.core, ...j.stores, ...more.flatMap((s: SectionPlan) => [...s.top, ...s.bottom])];
  const offset = (c.variant ?? 0) < 0.55 && rooms.length >= 6;
  const decks = offset
    ? offsetCarrierDecks(c, root, rooms)
    : deckPair(c, root, root, 'hull', rooms, 'start', { xMin: spanOf(c, [root]).xMin });
  if (!decks) return no(c, 'hull decks');
  // Separate banks are already fitted at the ends of staggered hull decks.
  if (!offset && !twinDrives(c, decks, pick(c, c.fam.propulsion), 'start')) return false;
  // The island: the command room grafted straight onto one hull deck's outer wall, off-centre (no stalk).
  const ib = localBuilder(c.rng);
  const cmd = c.plan.command;
  ib.place({ x: 0, y: 0, w: cmd.w + 2, h: cmd.h + 2 }, 'bridge', cmd);
  const island = blockFrom(ib, 'command', 'island', 'human', [{ id: 's', side: 's', x: 1, y: cmd.h + 1, len: cmd.w, access: 'human' }]);
  const side = c.rng.chance(0.5) ? 'n' : 's';
  const isl = side === 'n' ? island : mirrorBlock(island);
  const host = side === 'n' ? decks[0] : decks[1];
  if (c.A.attach(host, isl, { side, align: pick(c, ['mid', 'end', 'any'] as const), doors: 1 }) === null) return no(c, 'island');
  c.parts.push(`island ${side}`);
  return true;
}

/**
 * Carrier: a flight-deck spine, hangars side by side in pairs along it behind the nose, the core and stores aft of
 * them, long shallow hull decks with crew and guns down both sides, one drive aft.
 */
function flightDeck(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const [guns, ...more] = bands('battery', j.guns, 2);
  const bays = bands('hangar', c.plan.hangars, 2);
  const aft = order(c.rng, bands('core', [...j.core, ...j.stores], c.fam.sectionRooms));
  // Vary the major flight-deck assembly: some hulls place engineering between
  // hangar groups instead of concentrating it entirely aft.
  const splitEngineering = bays.length >= 2 && aft.length >= 2 && c.rng.chance(0.5);
  const pivot = splitEngineering ? c.rng.int(1, bays.length - 1) : bays.length;
  const secs = splitEngineering
    ? [...(guns ? [guns] : []), ...bays.slice(0, pivot), aft[0] as SectionPlan, ...bays.slice(pivot), ...aft.slice(1)]
    : [...(guns ? [guns] : []), ...bays, ...aft];
  evenDepth(c, ['core', 'cargo']);
  c.depth.hangar = Math.max(c.depth.hangar ?? 0, ...c.plan.hangars.map((h) => h.h));
  const ids = chain(c, root, secs, (guns ? 1 : 0) + bays.length);
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, pick(c, c.fam.propulsion))) return false;
  c.parts.push('flight deck');
  // Hull decks along the aft (core) sections, behind the hangars; the remaining guns ride in them.
  const aftStart = (guns ? 1 : 0) + bays.length + (splitEngineering ? 1 : 0);
  const deckIds = ids.slice(aftStart);
  const rest = [...j.crew, ...more.flatMap((s: SectionPlan) => [...s.top, ...s.bottom])];
  if (deckIds.length === 0 || rest.length === 0) return true;
  return !!deckPair(c, deckIds[0] as number, deckIds[0] as number, 'hull', rest, 'start', spanOf(c, deckIds)) || no(c, 'hull decks');
}

export const GRAMMARS: Record<NavyGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  linear: linearHull, deckPair: deckPairGrammar, spineWings, citadelFlanked, twinHull, componentFrigate, componentBattleship, carrierIsland, flightDeck,
};
