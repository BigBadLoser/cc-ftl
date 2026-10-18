import { Builder } from './builder';
import { bandBlock, noseBlock } from './navyBlocks';
import { bands, chain, deckPair, evenDepth, jobs, mirrorBlock, no, order, propulsion, section, spanOf, twinDrives, type Ctx, type SectionPlan } from './navyKit';
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

/** Rooms per side in a spine section that carries decks: fewer rooms make a longer, slimmer spine for them. */
const slim = (c: Ctx): number => c.rng.int(1, Math.max(1, c.fam.sectionRooms - 1));

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
  const guns = bands('battery', j.guns, 2);
  const secs = [...guns, ...bands('core', [...j.core, ...j.stores], slim(c))];
  evenDepth(c, ['core'], 1);
  const ids = chain(c, root, secs, secs.length - 1);
  if (!ids) return false;
  const host = ids[ids.length - 1] as number;
  if (!propulsion(c, host, pick(c, c.fam.propulsion))) return false;
  // Crew decks run the length of the core sections, behind the guns (their faces stay open).
  const core = ids.slice(guns.length);
  return !!deckPair(c, host, host, 'crew', j.crew, 'start', spanOf(c, core.length > 0 ? core : [host])) || no(c, 'decks');
}

/** Frigate: a spine of core and stores sections, long gun-and-crew decks along both sides (parallel layers). */
function spineDecks(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const spine = order(c.rng, bands('core', [...j.core, ...j.stores], slim(c)));
  evenDepth(c, ['core', 'cargo'], 1);
  const ids = chain(c, root, spine, 0);
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, pick(c, c.fam.propulsion.filter((p) => p !== 'wingPods')))) return false;
  // Long shallow decks the length of the spine, behind the nose: guns outboard, crew between them; one deck per side,
  // or crew and guns as two layers, the outer one shorter (stepped in at the stern).
  const all = spanOf(c, ids);
  if (c.rng.chance(0.5)) return !!deckPair(c, ids[0] as number, ids[0] as number, 'gun', [...j.guns, ...j.crew], 'start', all) || no(c, 'decks');
  const inner = deckPair(c, ids[0] as number, ids[0] as number, 'crew', j.crew, 'start', all);
  if (!inner) return no(c, 'crew decks');
  const outer = spanOf(c, ids.slice(0, Math.max(1, ids.length - 1)));
  return !!deckPair(c, inner[0], inner[1], 'gun', j.guns, 'start', { span: Math.max(outer.span, Math.floor(all.span * 0.7)), xMin: all.xMin }) || no(c, 'gun decks');
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
  const hulls = deckPair(c, root, root, 'hull', [...rest, ...j.guns], 'start', { xMin: spanOf(c, [root]).xMin });
  if (!hulls) return no(c, 'hulls');
  // Drives pushed outboard: the gap between the hulls stays open aft.
  return twinDrives(c, hulls, pick(c, c.fam.propulsion), 'start');
}

/** Cruiser: a broad layered hull, a spine with two layers of decks on each side. */
function layered(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const spine = order(c.rng, bands('core', [...j.core, ...j.stores], slim(c)));
  evenDepth(c, ['core', 'cargo'], 1);
  const ids = chain(c, root, spine, 0);
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, pick(c, c.fam.propulsion))) return false;
  // Two layers the length of the spine: crew decks on it, gun decks on them, each layer stepped in at bow and
  // stern (a broad stepped hull, not a cross).
  const all = spanOf(c, ids);
  const inner = deckPair(c, ids[0] as number, ids[0] as number, 'crew', j.crew, 'start', all);
  if (!inner) return no(c, 'crew decks');
  const step = Math.max(2, Math.floor(all.span / 6));
  return !!deckPair(c, inner[0], inner[1], 'gun', j.guns, 'start', { span: all.span - 2 * step, xMin: all.xMin + step }) || no(c, 'gun decks');
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
  const decks = deckPair(c, root, root, 'hull', [...j.crew, ...j.core, ...j.stores, ...more.flatMap((s: SectionPlan) => [...s.top, ...s.bottom])], 'start', { xMin: spanOf(c, [root]).xMin });
  if (!decks) return no(c, 'hull decks');
  // Drives at the aft ends of both hull decks, pushed outboard: the hangar well behind the hangar stays open aft.
  if (!twinDrives(c, decks, pick(c, c.fam.propulsion), 'start')) return false;
  // The island: the command room on a short tower over one deck, off-centre.
  const island = bandBlock(c.rng, 'command', [c.plan.command], [], { depth: c.plan.command.h, hatchS: true });
  const side = c.rng.chance(0.5) ? 'n' : 's';
  const isl = side === 'n' ? island : island && mirrorBlock(island);
  const host = side === 'n' ? decks[0] : decks[1];
  if (!isl || c.A.attach(host, isl, { side, align: pick(c, ['start', 'mid', 'any'] as const), doors: 1 }) === null) return no(c, 'island');
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
  const secs = [...(guns ? [guns] : []), ...bays, ...aft];
  evenDepth(c, ['core', 'cargo']);
  c.depth.hangar = Math.max(c.depth.hangar ?? 0, ...c.plan.hangars.map((h) => h.h));
  const ids = chain(c, root, secs, (guns ? 1 : 0) + bays.length);
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, pick(c, c.fam.propulsion))) return false;
  c.parts.push('flight deck');
  // Hull decks along the aft (core) sections, behind the hangars; the remaining guns ride in them.
  const deckIds = ids.slice((guns ? 1 : 0) + bays.length);
  const rest = [...j.crew, ...more.flatMap((s: SectionPlan) => [...s.top, ...s.bottom])];
  if (deckIds.length === 0 || rest.length === 0) return true;
  return !!deckPair(c, deckIds[0] as number, deckIds[0] as number, 'hull', rest, 'start', spanOf(c, deckIds)) || no(c, 'hull decks');
}

export const GRAMMARS: Record<NavyGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  linear, deckPair: deckPairGrammar, spineDecks, spineWings, citadelFlanked, twinHull, layered, carrierIsland: (c) => carrierIsland(c), flightDeck,
};
