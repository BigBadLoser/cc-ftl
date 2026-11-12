import type { Recipe } from '../sim/shipgen/assembly/recipe';

/**
 * Station recipes for the assembly model (docs/STATION_FLOW_WHEEL.md): what a station is composed of and how its parts
 * stand to each other. Prototype: two structures, each in a few variations made by changing parameters only.
 */

/**
 * A modular tree as a cluster: sections joined directly, each growing off the end or the side of one already there
 * (the old tree's way). The dock block first, the secure rooms as a gated section.
 */
const cluster = (name: string, o: { rooms: [number, number]; rowDepth?: number; link: [number, number]; cross: boolean; spacing: number }): Recipe => ({
  name,
  root: { kind: 'core' },
  spacing: o.spacing,
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'section' }, neck: 0, docks: true, section: { rooms: [2, 6], cross: true }, link: 0 },
    { takes: ['commons', 'freight', 'works'], per: 'department', host: { on: 'section' }, neck: 0, section: { rooms: o.rooms, cross: o.cross, ...(o.rowDepth ? { rowDepth: o.rowDepth, even: true } : {}) }, link: o.link, most: 1 },
    { takes: ['habitation', 'defence'], per: 'department', host: { on: 'section' }, neck: 0, section: { rooms: o.rooms, cross: o.cross, ...(o.rowDepth ? { rowDepth: o.rowDepth, even: true } : {}) }, link: o.link, most: 1 },
    { takes: ['secure'], per: 'together', host: { on: 'section' }, neck: 0, gated: true, section: { rooms: [3, 8], cap: true }, link: 0 },
  ],
});

/**
 * A scrapper's tree: small modules of whatever rooms came to hand, each on a short stub off one already there; the dock
 * block first, the machinery as one gated module. `mix` false keeps a module to one department.
 */
const scrap = (name: string, o: { rooms: [number, number]; stub: [number, number]; spacing: number; mix: boolean; scatter?: boolean }): Recipe => ({
  name,
  root: { kind: 'core' },
  spacing: o.spacing,
  ...(o.scatter ? { cabins: 'scatter' as const } : {}),
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'section' }, neck: 0, docks: true, section: { rooms: [2, 6], cross: true }, link: 0 },
    o.mix
      ? { takes: ['commons', 'freight', 'works', 'habitation', 'defence'], per: 'together', mix: true, host: { on: 'section' }, neck: o.stub, section: { rooms: o.rooms, cross: true }, link: 0 }
      : { takes: ['commons', 'freight', 'works', 'habitation', 'defence'], per: 'department', host: { on: 'section' }, neck: o.stub, section: { rooms: o.rooms, cross: true }, link: 0, most: 1 },
    { takes: ['secure'], per: 'together', host: { on: 'section' }, neck: 0, gated: true, section: { rooms: [3, 8], cap: true }, link: 0 },
  ],
});

/** A tree on a trunk: department branches off a short trunk, joined directly; the dock block at its head. */
const trunked = (name: string, o: { pairs: number; step: [number, number]; rooms: [number, number]; link: [number, number]; most: number }): Recipe => ({
  name,
  root: { kind: 'trunk', pairs: o.pairs, step: o.step },
  spacing: 2,
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'trunk' }, neck: 0, docks: true, section: { rooms: [2, 6] }, link: 0 },
    { takes: ['commons', 'freight', 'works'], per: 'department', host: { on: 'trunk' }, neck: 0, section: { rooms: o.rooms, cap: true }, link: o.link, most: o.most },
    { takes: ['secure'], per: 'together', host: { on: 'trunk' }, neck: 0, gated: true, section: { rooms: [3, 8], cap: true }, link: 0 },
    { takes: ['habitation', 'defence'], per: 'department', host: { on: 'trunk' }, neck: 0, section: { rooms: o.rooms, cap: true }, link: o.link, most: o.most },
  ],
});

/**
 * A compound: an inhabited ring or arc with a substantial industrial block joined to it. The secure rooms are the gated
 * far end of that block (one mass, its machinery behind a gate) or stand on the arc's other tip; the harbour is a dock
 * block on the rim.
 */
const compound = (name: string, o: {
  outline: 'disc' | 'square'; inner: boolean; gap?: { side: 'n' | 'e' | 's' | 'w'; from: number };
  works: ('n' | 'e' | 's' | 'w')[] | 'tip'; secure: 'behind' | 'tip'; dock: ('n' | 'e' | 's' | 'w')[]; neck: number; rowDepth: number;
}): Recipe => ({
  name,
  root: { kind: 'ring', takes: ['habitation', 'defence', 'commons'], outline: o.outline, cut: 2, inner: o.inner, ...(o.gap ? { gap: o.gap } : {}) },
  spacing: 2,
  branches: [
    { takes: ['works', 'freight'], per: 'together', host: o.works === 'tip' ? { on: 'tip' } : { on: 'rim', prefer: o.works }, neck: o.neck, section: { rooms: [4, 8], rowDepth: o.rowDepth, even: true }, link: 0 },
    { takes: ['secure'], per: 'together', host: o.secure === 'tip' ? { on: 'tip' } : { on: 'after', rule: 0 }, neck: 0, gated: true, section: { rooms: [3, 8], rowDepth: o.secure === 'tip' ? 6 : o.rowDepth, even: true, cap: true }, link: 0 },
    { takes: ['harbour'], per: 'together', host: { on: 'rim', prefer: o.dock, roll: true }, neck: 0, docks: true, section: { rooms: [2, 6] }, link: 0 },
  ],
});

export const stationRecipes = {
  tree: [
    scrap('scattered cabins: one department a module, on stubs', { rooms: [2, 4], stub: [2, 4], spacing: 2, mix: false, scatter: true }),
    scrap('scattered cabins: mixed modules on stubs', { rooms: [2, 4], stub: [2, 3], spacing: 2, mix: true, scatter: true }),
    scrap('scattered cabins: modules joined directly', { rooms: [2, 4], stub: [0, 0], spacing: 0, mix: false, scatter: true }),
    scrap('cabin blocks (before): mixed modules on stubs', { rooms: [2, 4], stub: [2, 3], spacing: 2, mix: true }),
  ],
  compound: [
    compound('ring, works block with the machinery behind a gate', { outline: 'disc', inner: true, works: ['s', 'n'], secure: 'behind', dock: ['w', 'e'], neck: 0, rowDepth: 9 }),
    compound('arc open to the south, works off its back', { outline: 'disc', inner: true, gap: { side: 's', from: 12 }, works: ['n'], secure: 'behind', dock: ['w', 'e'], neck: 0, rowDepth: 8 }),
    compound('half ring: works on one tip, machinery on the other', { outline: 'disc', inner: true, gap: { side: 'e', from: 4 }, works: 'tip', secure: 'tip', dock: ['w'], neck: 0, rowDepth: 7 }),
    compound('square with bastions', { outline: 'square', inner: true, works: ['e', 'w'], secure: 'behind', dock: ['w', 'e'], neck: 0, rowDepth: 8 }),
  ],
} as const satisfies Record<string, readonly Recipe[]>;
