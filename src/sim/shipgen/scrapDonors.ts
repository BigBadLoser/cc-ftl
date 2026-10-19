import type { Block } from './arranger';
import { Builder } from './builder';
import { bandBlock, bankBlock, noseBlock } from './navyBlocks';
import type { Ctx } from './navyKit';
import { arrangeHull } from './navyLayouts';
import { cargoSpec, dockSpec, pickWeighted, weaponSpec, type RoomSpec, type ShipPlan } from './plan';
import { cutSeam, freeze, notch, survivors } from './salvage';
import { barge, cockpit, drive, freighter, habitat, liner, podString, reactorRoom, station, tower, tug } from './civilBlocks';
import { containerFrame, linerBody, oreCage, truss } from './civilFrames';
import { latticeStation, ringStation } from './civilStations';
import { pickNose } from './topoNavy';
import type { DonorKind, FactionDef } from './types';

/**
 * Salvage donors: what each one is, which of the ship's jobs it can carry, and how it is built. Navy and drone donors
 * are cut from those factions' own generators (the navy blocks, or a whole navy / drone arrangement on a sub-plan),
 * so their refinements carry over; civil and one-off donors come from the shared civil builders (`civilBlocks.ts`). A donor takes what it
 * carries from the shared pool; whatever a cut or damage took off it goes back to the pool for the next donor.
 */

export type Need = 'command' | 'guns' | 'crew' | 'crates' | 'hangar' | 'drive';

/** The ship's jobs not yet carried by a donor. Guns are single mounts (module ids). */
export interface Pool {
  command: RoomSpec | null;
  commandBy: DonorKind | null;
  guns: string[];
  core: RoomSpec[];
  quarters: RoomSpec[];
  support: RoomSpec[];
  docks: number;
  crates: number;
  hangars: RoomSpec[];
  engines: number;
  reactors: number;
  /** Donors still to be built per job: each takes its share of what is left. */
  share: Partial<Record<Need, number>>;
}

export function poolOf(plan: ShipPlan): Pool {
  return {
    command: plan.command, commandBy: null, guns: plan.weapons.flatMap((w) => w.mods), core: [...plan.shields, ...(plan.core ? [plan.core] : [])],
    quarters: [...plan.quarters], support: [...plan.support], docks: 2, crates: plan.cargo.reduce((t, c) => t + c.mods.length, 0),
    hangars: [...plan.hangars], engines: plan.engines,
    // Salvage runs hot: derelict rooms and spare airlocks draw power the plan never counted.
    reactors: plan.reactors + 1, share: {},
  };
}

const clone = (p: Pool): Pool => ({ ...p, guns: [...p.guns], core: [...p.core], quarters: [...p.quarters], support: [...p.support], hangars: [...p.hangars], share: { ...p.share } });
const restore = (p: Pool, s: Pool): void => { Object.assign(p, s); };

/** Take this donor's share of a list (at least `min`). */
function part<T>(p: Pool, need: Need, list: T[], min = 1): T[] {
  const n = Math.max(1, p.share[need] ?? 1);
  return list.splice(0, Math.min(list.length, Math.max(min, Math.ceil(list.length / n))));
}
function partOf(p: Pool, need: Need, total: number, min = 1): number {
  const n = Math.max(1, p.share[need] ?? 1);
  return Math.min(total, Math.max(min, Math.ceil(total / n)));
}

/**
 * What a cut section kept: rooms whose modules survive stay taken, the rest go back to the pool (by module, so specs
 * a generator copied still count).
 */
function settle(p: Pool, b: Builder, taken: { specs: RoomSpec[]; guns: string[]; crates: number; engines: number; reactors: number }): void {
  const left = new Map<string, number>();
  for (const s of survivors(b)) for (const m of s.mods) left.set(m, (left.get(m) ?? 0) + 1);
  const has = (m: string): boolean => { const n = left.get(m) ?? 0; if (n > 0) left.set(m, n - 1); return n > 0; };
  for (const s of taken.specs) {
    if (s.mods.every((m) => has(m))) continue;
    if (s === p.command || s.mods.includes('module.helm')) { p.command = s; p.commandBy = null; } else if (s.role === 'quarters') p.quarters.push(s);
    else if (s.role === 'support') p.support.push(s);
    else if (s.role === 'hangar') p.hangars.push(s);
    else p.core.push(s);
  }
  for (const g of taken.guns) if (!has(g)) p.guns.push(g);
  let crates = 0;
  while (crates < taken.crates && has('module.storage')) crates++;
  p.crates += taken.crates - crates;
  let e = 0;
  while (e < taken.engines && has('module.engine')) e++;
  p.engines += taken.engines - e;
  let r = 0;
  while (r < taken.reactors && has('module.reactor')) r++;
  p.reactors += taken.reactors - r;
}

/** Wear on a hand-made hull: sometimes cut off at a seam (a partial graft), sometimes a corner or two knocked off. */
function wear(c: Ctx, b: Builder, cut: number): void {
  if (c.rng.chance(cut) && cutSeam(b, c.rng, c.rng.chance(0.5) ? 'w' : 'e')) c.parts.push('cut');
  for (let k = c.rng.int(0, 2); k > 0; k--) if (notch(b, c.rng, c.rng.int(2, 3), c.defs)) c.parts.push('damage');
}

type Build = (c: Ctx, f: FactionDef, p: Pool) => Block | null;

/** A real generated section of another faction on a sub-plan: its full arrangement, frozen into one block. */
function generated(c: Ctx, src: FactionDef['salvage'], who: 'navy' | 'drone', sub: ShipPlan): { b: Builder; A: import('./arranger').Arranger } | null {
  const s = src?.[who];
  const fams = (s?.faction.hullFamilies ?? []).filter((h) => s?.families.includes(h.id));
  if (!s || fams.length === 0) return null;
  const fam = pickWeighted(c.rng, fams.map((h) => ({ value: h, weight: 1 })));
  // One candidate: a donor is cut and welded anyway, its proportions do not matter.
  const r = arrangeHull(c.rng, s.faction, fam, sub, c.defs, 1);
  return typeof r === 'string' ? null : { b: r.b, A: r.A };
}

const subPlan = (c: Ctx, over: Partial<ShipPlan>): ShipPlan => ({
  ...c.plan, weapons: [], shields: [], core: null, pd: [], quarters: [], cargo: [], hangars: [], support: [], engines: 0, reactors: 0, ...over,
});

const navyBow: Build = (c, f, p) => {
  if (!p.command || p.commandBy !== 'navyBow') return null;
  const blk = noseBlock(c.rng, pickNose(new Builder(c.rng), f, { ...c.plan, command: p.command, weapons: [] }));
  if (blk) p.command = null;
  return blk && { ...blk, donor: 'navy', label: 'navy: bow' };
};

const navyDrive: Build = (c, _f, p) => {
  if (p.reactors <= 0 && p.engines <= 0) return null;
  const e = Math.min(p.engines, c.rng.int(1, 2));
  const blk = e > 0 ? bankBlock(c.rng, e, Math.max(1, p.reactors)) : null;
  if (!blk) return null;
  p.engines -= e;
  p.reactors = 0;
  return { ...blk, donor: 'navy', label: 'navy: drive' };
};

const navyBattery: Build = (c, _f, p) => {
  const guns = part(p, 'guns', p.guns);
  const extra = p.core.splice(0, c.rng.int(0, 1));
  const specs = [...guns.map((m) => weaponSpec(c.defs, [m])), ...extra];
  if (specs.length === 0) return null;
  const half = Math.ceil(specs.length / 2);
  const blk = bandBlock(c.rng, 'battery', specs.slice(0, half), specs.slice(half), { depth: Math.max(3, ...specs.map((g) => g.h)), hatchN: true, hatchS: true });
  return blk && { ...blk, donor: 'navy', label: 'navy: battery' };
};

/** An old navy hull: a navy arrangement on a small sub-plan, cut off fore or aft of a seam. */
const navyHulk: Build = (c, f, p) => {
  const guns = part(p, 'guns', p.guns);
  const quarters = p.quarters.splice(0, 1);
  const cmd = p.command && p.commandBy === 'navyHulk' ? p.command : null;
  const engines = Math.min(1, p.engines);
  const reactors = Math.min(1, p.reactors);
  const derelict: RoomSpec = { role: 'bridge', mods: [], w: 7, h: 4 };
  const sub = subPlan(c, { command: cmd ?? derelict, weapons: guns.map((m) => weaponSpec(c.defs, [m])), quarters, cargo: [cargoSpec(2)], engines: 1, reactors: 1 });
  const g = generated(c, f.salvage, 'navy', sub);
  if (!g) return null;
  if (cmd) p.command = null;
  p.engines -= engines;
  p.reactors -= reactors;
  // Fore halves keep the bridge, aft halves the drive.
  if (cutSeam(g.b, c.rng, cmd ? 'w' : c.rng.chance(0.5) ? 'w' : 'e', 0.4, 0.2)) c.parts.push('cut');
  settle(p, g.b, { specs: [...(cmd ? [cmd] : []), ...quarters], guns, crates: 0, engines, reactors });
  return freeze(g.b, 'hulk', 'hull section', 'navy', 'human', g.A);
};

/** A drone weapon section: the drone generator's own arrangement of the guns, its processing room gutted. */
const droneSection: Build = (c, f, p) => {
  const guns = part(p, 'guns', p.guns);
  if (guns.length === 0) return null;
  const gutted: RoomSpec = { role: 'core', mods: ['module.storage', 'module.storage'], w: 5, h: 3, stock: true };
  const g = generated(c, f.salvage, 'drone', subPlan(c, { command: gutted, weapons: guns.map((m) => weaponSpec(c.defs, [m])) }));
  return g && freeze(g.b, 'drone', 'weapon section', 'drone', 'robot', g.A);
};

/** Hand-made donors: take their share, draw, wear, settle what the wear took, freeze. */
function civil(origin: string, label: string, cut: number, draw: (c: Ctx, p: Pool, t: { specs: RoomSpec[]; crates: number; engines: number; reactors: number }) => Builder | null): Build {
  return (c, _f, p) => {
    const t = { specs: [] as RoomSpec[], guns: [] as string[], crates: 0, engines: 0, reactors: 0 };
    const b = draw(c, p, t);
    if (!b) return null;
    wear(c, b, cut);
    settle(p, b, t);
    return freeze(b, label.split(' ')[0] as string, label, origin);
  };
}

const takeCmd = (p: Pool, by: DonorKind, t: { specs: RoomSpec[] }): RoomSpec[] => {
  if (!p.command || p.commandBy !== by) return [];
  const s = p.command;
  p.command = null;
  t.specs.push(s);
  return [s];
};
const takeCrates = (p: Pool, t: { crates: number }, min: number): number => {
  const n = Math.max(min, partOf(p, 'crates', p.crates, 0));
  p.crates = Math.max(0, p.crates - n);
  t.crates = n;
  return n;
};
/** Support rooms for a crew donor: all that are left when it is the last crew donor, else one. */
const sup = (p: Pool): RoomSpec[] => p.support.splice(0, (p.share.crew ?? 1) <= 1 ? p.support.length : 1);
const docks = (p: Pool, n: number): RoomSpec[] => { const k = Math.min(n, p.docks); p.docks -= k; return Array.from({ length: k }, dockSpec); };

export const DONORS: Record<DonorKind, { serves: Need[]; build: Build }> = {
  navyBow: { serves: ['command'], build: navyBow },
  navyDrive: { serves: ['drive'], build: navyDrive },
  navyBattery: { serves: ['guns'], build: navyBattery },
  navyHulk: { serves: ['guns', 'command', 'drive'], build: navyHulk },
  droneSection: { serves: ['guns'], build: droneSection },
  freighter: { serves: ['crates', 'hangar'], build: civil('civil', 'freighter', 0.3, (c, p, t) => {
    const north = p.hangars.splice(0);
    const south = p.core.splice(0, 2);
    t.specs.push(...north, ...south);
    return freighter(c.rng, north, takeCrates(p, t, 4), south);
  }) },
  habitat: { serves: ['crew', 'command'], build: civil('civil', 'habitat ring', 0.25, (c, p, t) => {
    const cmd = takeCmd(p, 'habitat', t);
    const crew = [...part(p, 'crew', p.quarters), ...sup(p)];
    const hub = crew.find((r) => r.role === 'support') ?? crew[0] ?? cmd[0];
    if (!hub) return null;
    const rest = [...cmd, ...crew].filter((r) => r !== hub);
    t.specs.push(...crew);
    const dk = docks(p, 2);
    return habitat(c.rng, hub, [...rest.filter((_, i) => i % 2 === 0), ...dk.slice(0, 1)], [...rest.filter((_, i) => i % 2 === 1), ...dk.slice(1)]);
  }) },
  liner: { serves: ['crew'], build: civil('civil', 'liner segment', 0.5, (c, p, t) => {
    const q = part(p, 'crew', p.quarters);
    if (q.length === 0) return null;
    const extra = sup(p);
    const ls = q.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
    const lounge: RoomSpec = { role: 'support', mods: [...ls, ...extra.flatMap((s) => s.mods)], w: 4 + 2 * extra.length, h: 7 };
    // The cabins and lounge hold the quarters' beds and life support; settle by module.
    t.specs.push(...q, ...extra);
    return liner(c.rng, q.reduce((n, r) => n + r.mods.filter((m) => m === 'module.bed').length, 0), lounge);
  }) },
  station: { serves: ['crew', 'command'], build: civil('civil', 'station module', 0.3, (c, p, t) => {
    const rooms = [...takeCmd(p, 'station', t), ...p.support.splice(0, 1), ...p.core.splice(0, 1), ...p.quarters.splice(0, 1)].slice(0, 4);
    t.specs.push(...rooms.filter((r) => !t.specs.includes(r)));
    return rooms.length >= 2 ? station(c.rng, rooms) : null;
  }) },
  barge: { serves: ['crates'], build: civil('mining', 'ore barge', 0.4, (c, p, t) => barge(c.rng, takeCrates(p, t, 6))) },
  podString: { serves: ['crates'], build: civil('civil', 'cargo pods', 0.2, (c, p, t) => podString(c.rng, takeCrates(p, t, 4))) },
  // Bows (v25): a civil freighter cockpit, a liner nose (an observation dome ahead of the bridge), a blunt cut-off
  // block; the navy bow stays one of them.
  cockpitBow: { serves: ['command'], build: civil('civil', 'cockpit bow', 0, (c, p, t) => {
    const cmd = takeCmd(p, 'cockpitBow', t);
    if (cmd.length === 0) return null;
    const beside = p.core.splice(0, 2);
    t.specs.push(...beside);
    return cockpit(c.rng, cmd[0] as RoomSpec, beside);
  }) },
  linerBow: { serves: ['command'], build: civil('civil', 'liner bow', 0, (c, p, t) => {
    const cmd = takeCmd(p, 'linerBow', t);
    if (cmd.length === 0) return null;
    const beside = p.core.splice(0, 2);
    t.specs.push(...beside);
    const b = cockpit(c.rng, cmd[0] as RoomSpec, beside);
    const bridge = b?.parts[0];
    if (!b || !bridge) return null;
    b.attach(bridge, 'w', { role: 'support', mods: [], w: c.rng.int(2, 4), h: Math.max(2, bridge.h - 2 - 2 * c.rng.int(0, 1)) }, 1 + c.rng.int(0, 1));
    return b;
  }) },
  bluntBow: { serves: ['command'], build: civil('navy', 'blunt bow', 0, (c, p, t) => {
    const cmd = takeCmd(p, 'bluntBow', t);
    if (cmd.length === 0) return null;
    const rooms = [...cmd, ...p.core.splice(0, 3)];
    t.specs.push(...rooms.slice(1));
    return station(c.rng, rooms);
  }) },
  // Civilian generator pieces (v23): frames, cages, towers, liner hull chunks, station ring and lattice pieces, drives.
  containerFrame: { serves: ['crates'], build: (c, _f, p) => {
    const n = Math.max(6, partOf(p, 'crates', p.crates, 6));
    p.crates = Math.max(0, p.crates - n);
    const cw = c.rng.int(3, 4);
    const fr = containerFrame(c.rng, n, { lane: c.rng.int(0, 2), gap: c.rng.int(0, 1), cw, ch: c.rng.int(3, 4), bands: 1, stagger: c.rng.chance(0.3) });
    return { ...fr, donor: 'civil', label: 'civil: container frame' };
  } },
  oreCage: { serves: ['crates'], build: (c, _f, p) => {
    const n = Math.max(6, partOf(p, 'crates', p.crates, 6));
    p.crates = Math.max(0, p.crates - n);
    const cg = oreCage(c.rng, n, { hw: c.rng.int(2, 3), hh: c.rng.int(3, 4), gap: c.rng.pick([1, 3]), every: 1, tooth: c.rng.int(1, 3) }, 6);
    return { ...cg, donor: 'mining', label: 'mining: ore cage' };
  } },
  crewTower: { serves: ['crew', 'command'], build: civil('civil', 'crew tower', 0, (c, p, t) => {
    const rooms = [...takeCmd(p, 'crewTower', t), ...part(p, 'crew', p.quarters), ...sup(p)];
    if (rooms.length === 0) return null;
    t.specs.push(...rooms.filter((r) => !t.specs.includes(r)));
    return tower(c.rng, rooms);
  }) },
  linerChunk: { serves: ['crew'], build: civil('civil', 'liner hull', 0.6, (c, p, t) => {
    const q = part(p, 'crew', p.quarters);
    if (q.length === 0) return null;
    const extra = sup(p);
    const ls = q.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
    const lounges: RoomSpec[] = [{ role: 'support' as const, mods: ls, w: 4, h: 3 }, ...extra.map((r) => ({ ...r, w: Math.max(3, r.w) }))].filter((r) => r.mods.length > 0);
    t.specs.push(...q, ...extra);
    const beds = q.reduce((n, r) => n + r.mods.filter((m) => m === 'module.bed').length, 0);
    const form = { peak: 0.3, tail: c.rng.pick([0, 0.3]), nose: c.rng.pick([0.2, 0.5]), amp: c.rng.int(2, 3), extra: 0 };
    return linerBody(c.rng, beds, lounges, c.rng.pick(['teardrop', 'oval'] as const), [2, 2], form);
  }) },
  ringPiece: { serves: ['crew', 'command'], build: civil('civil', 'station ring', 0.5, (c, p, t) => {
    const cmd = takeCmd(p, 'ringPiece', t);
    const crew = [...part(p, 'crew', p.quarters), ...sup(p)];
    const hub = cmd[0] ?? crew.shift();
    if (!hub) return null;
    t.specs.push(...crew, ...(cmd[0] ? [] : [hub]));
    p.docks = Math.max(0, p.docks - 2);
    const o = { extra: c.rng.int(0, 2), weight: [1, 1, 1.6], inner: false };
    return ringStation(c.rng, hub, crew, 0, 0, c.rng.chance(0.5) ? ['w', 'e'] : ['n', 's'], o);
  }) },
  latticePiece: { serves: ['crew'], build: civil('civil', 'station lattice', 0.4, (c, p, t) => {
    const mods = [...part(p, 'crew', p.quarters), ...sup(p), ...p.core.splice(0, 1)];
    if (mods.length < 2) { p.quarters.push(...mods.filter((r) => r.role === 'quarters')); p.support.push(...mods.filter((r) => r.role === 'support')); p.core.push(...mods.filter((r) => r.role !== 'quarters' && r.role !== 'support')); return null; }
    t.specs.push(...mods);
    p.docks = Math.max(0, p.docks - 2);
    return latticeStation(c.rng, mods, 0, { gx: c.rng.int(3, 5), gy: c.rng.int(3, 4), spread: 1.3, holes: 0, pad: 0 });
  }) },
  lightDrive: { serves: ['drive'], build: civil('civil', 'light drive', 0, (c, p, t) => {
    t.engines = Math.min(p.engines, c.rng.int(1, 2));
    t.reactors = Math.max(0, Math.min(2, p.reactors));
    if (t.engines === 0) return null;
    p.engines -= t.engines;
    p.reactors -= t.reactors;
    return drive(c.rng, t.engines, t.reactors, c.rng.pick(['nozzle', 'pair', 'nacelles'] as const));
  }) },
  tug: { serves: ['drive'], build: civil('mining', 'tug', 0, (c, p, t) => {
    t.engines = Math.min(1, p.engines);
    t.reactors = Math.max(1, Math.min(2, p.reactors));
    p.engines -= t.engines;
    p.reactors = Math.max(0, p.reactors - t.reactors);
    return tug(c.rng, cargoSpec(2), t.reactors);
  }) },
};

/** Whatever no donor carried, patched in: a bow for the bridge, a gun band, a habitat, a reactor room. */
export function leftovers(c: Ctx, f: FactionDef, p: Pool): Block[] {
  const out: Block[] = [];
  const add = (k: DonorKind): void => {
    p.share = {};
    if (k === 'navyBow' || k === 'habitat') p.commandBy = k;
    const b = DONORS[k].build(c, f, p);
    if (b) out.push(b);
  };
  if (p.command) add('navyBow');
  if (p.command) add('habitat');
  if (p.hangars.length > 0) add('freighter');
  // Leftover guns are mounted on the hull by the composer (sponsons), never a whole extra battery section.
  if (p.quarters.length > 0 || p.support.length > 0) add('habitat');
  if (p.core.length > 0) add('station');
  const rr = p.reactors > 0 ? reactorRoom(c.rng, p.reactors) : null;
  if (rr) {
    // Cooling fins on the patched reactor, so it reads as a reactor pod, not a slab.
    for (let x = 1; x <= 2 * p.reactors + 2; x += 2) {
      const len = c.rng.int(1, 3);
      truss(rr, x, -4 - len, 1, len, `fin${x}`);
    }
    out.push({ ...freeze(rr, 'reactor', 'patched reactor', 'scrap'), bare: true });
    p.reactors = 0;
  }
  return out;
}

export { clone as clonePool, restore as restorePool };
