import { Builder } from './builder';
import { bandBlock, noseBlock } from './navyBlocks';
import { bands, chain, deckPair, jobs, mirrorBlock, no, order, propulsion, section, twinDrives, type Ctx, type SectionPlan } from './navyKit';
import { pickNose } from './topoNavy';
import type { FactionDef, NavyGrammar } from './types';

/**
 * Navy hull grammars on the 2D arranger. Major assemblies overlap lengthways or run in parallel layers (decks) rather
 * than sticking out as perpendicular wings; airlocks sit in hull faces (dock rooms inside decks and bands).
 */

const nose = (c: Ctx, f: FactionDef): number | null => {
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  return front ? c.A.placeRoot(front) : null;
};

const pick = <T>(c: Ctx, xs: readonly T[]): T => c.rng.pick(xs);

/** Corvette: a short chain, everything in band sections. */
function linear(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const secs = [...bands('battery', j.guns, 2), ...bands('core', [...j.core, ...j.crew, ...j.stores], c.fam.sectionRooms)];
  const ids = chain(c, root, order(c.rng, secs));
  return !!ids && propulsion(c, ids[ids.length - 1] as number, pick(c, c.fam.propulsion));
}

/** Small hull with parallel decks: guns fore, a core chain, crew decks laid along it. */
function deckPairGrammar(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const secs = [...bands('battery', j.guns, 2), ...bands('core', [...j.core, ...j.stores], c.fam.sectionRooms)];
  const ids = chain(c, root, secs, secs.length - 1);
  if (!ids) return false;
  const host = ids[ids.length - 1] as number;
  if (!propulsion(c, host, pick(c, c.fam.propulsion))) return false;
  return !!deckPair(c, host, host, 'crew', j.crew, pick(c, ['start', 'mid', 'end'] as const)) || no(c, 'decks');
}

/** Frigate: a spine of core and stores sections, long gun-and-crew decks along both sides (parallel layers). */
function spineDecks(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const spine = order(c.rng, bands('core', [...j.core, ...j.stores], c.fam.sectionRooms));
  const ids = chain(c, root, spine, 0);
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, pick(c, c.fam.propulsion.filter((p) => p !== 'wingPods')))) return false;
  // Guns outboard in the decks, crew between them; one long deck per side, or guns and crew as two layers.
  if (c.rng.chance(0.5)) return !!deckPair(c, ids[0] as number, ids[0] as number, 'gun', [...j.guns, ...j.crew], 'start') || no(c, 'decks');
  const inner = deckPair(c, ids[0] as number, ids[0] as number, 'crew', j.crew, 'start');
  if (!inner) return no(c, 'crew decks');
  return !!deckPair(c, inner[0], inner[1], 'gun', j.guns, pick(c, ['start', 'mid'] as const)) || no(c, 'gun decks');
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
  return !!deckPair(c, host, host, 'crew', j.crew, 'end') || no(c, 'wing decks');
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
  const flank = deckPair(c, root, root, 'flank', [...j.crew, ...j.stores], 'mid');
  if (!flank) return no(c, 'flanks');
  return !!deckPair(c, flank[0], flank[1], 'gun', j.guns, pick(c, ['start', 'mid', 'end'] as const)) || no(c, 'gun decks');
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
  const hulls = deckPair(c, root, root, 'hull', [...rest, ...j.guns], 'start');
  if (!hulls) return no(c, 'hulls');
  return twinDrives(c, hulls, pick(c, c.fam.propulsion));
}

/** Cruiser: a broad layered hull, a spine with two layers of decks on each side. */
function layered(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const spine = order(c.rng, bands('core', [...j.core, ...j.stores], c.fam.sectionRooms));
  const ids = chain(c, root, spine, Math.floor((spine.length - 1) / 2));
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, pick(c, c.fam.propulsion))) return false;
  const host = ids[Math.floor((spine.length - 1) / 2)] as number;
  const inner = deckPair(c, host, host, 'crew', j.crew, 'mid');
  if (!inner) return no(c, 'crew decks');
  return !!deckPair(c, inner[0], inner[1], 'gun', j.guns, 'mid') || no(c, 'gun decks');
}

/** Carrier: a hangar block with hull decks along it (real volume), an offset island, nacelles aft. */
function carrierIsland(c: Ctx): boolean {
  const j = jobs(c.plan);
  const hb = section(c, { kind: 'hangar', top: [], bottom: [], sponson: false, centre: c.plan.hangars, extra: [[], []] });
  if (!hb) return no(c, 'hangar');
  const root = c.A.placeRoot(hb);
  c.parts.push('hangar');
  const [bowGuns, ...more] = bands('battery', j.guns, 2);
  const bow = bowGuns ? section(c, bowGuns) : null;
  if (bow && c.A.attach(root, bow, { side: 'w' }) === null) return no(c, 'bow');
  // Crew, core, stores and the remaining guns in hull decks along the hangar: they give it real volume.
  const decks = deckPair(c, root, root, 'hull', [...j.crew, ...j.core, ...j.stores, ...more.flatMap((s: SectionPlan) => [...s.top, ...s.bottom])], 'start');
  if (!decks) return no(c, 'hull decks');
  // Drives at the aft ends of both hull decks, the hangar's stern open between them.
  if (!twinDrives(c, decks, pick(c, c.fam.propulsion))) return false;
  // The island: the command room on a short tower over one deck, off-centre.
  const island = bandBlock(c.rng, 'command', [c.plan.command], [], { depth: c.plan.command.h, hatchS: true });
  const side = c.rng.chance(0.5) ? 'n' : 's';
  const isl = side === 'n' ? island : island && mirrorBlock(island);
  const host = side === 'n' ? decks[0] : decks[1];
  if (!isl || c.A.attach(host, isl, { side, align: pick(c, ['start', 'mid', 'any'] as const), doors: 1 }) === null) return no(c, 'island');
  c.parts.push(`island ${side}`);
  return true;
}

export const GRAMMARS: Record<NavyGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  linear, deckPair: deckPairGrammar, spineDecks, spineWings, citadelFlanked, twinHull, layered, carrierIsland: (c) => carrierIsland(c),
};
