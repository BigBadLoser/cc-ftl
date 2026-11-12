import type { Recipe } from '../sim/shipgen/assembly/recipe';

/**
 * Station recipes for the assembly model (docs/STATION_FLOW_WHEEL.md): what a station is composed of and how its parts
 * stand to each other. Prototype: two structures, each in a few variations made by changing parameters only.
 */

/** A modular tree: department branches off a trunk, each a chain or a comb of modules; the secure one behind a gate. */
const tree = (name: string, o: { most: number; pairs: number; step: [number, number]; neck: [number, number]; link: [number, number]; rooms: [number, number]; fork: number; spacing: number; arrange: 'series' | 'sides' }): Recipe => ({
  name,
  root: { kind: 'trunk', pairs: o.pairs, step: o.step },
  spacing: o.spacing,
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'trunk' }, neck: 0, section: { rooms: [2, 4], cap: true }, link: o.link },
    { takes: ['freight', 'works', 'commons'], per: 'department', host: { on: 'trunk' }, neck: o.neck, section: { rooms: o.rooms, cap: true }, link: o.link, fork: o.fork, arrange: o.arrange, most: o.most },
    { takes: ['secure'], per: 'together', host: { on: 'trunk' }, neck: [3, 5], gated: true, section: { rooms: [3, 6], cap: true }, link: 4 },
    { takes: ['habitation', 'defence'], per: 'department', host: { on: 'trunk' }, neck: o.neck, section: { rooms: o.rooms, cap: true }, link: o.link, fork: o.fork, arrange: o.arrange, most: o.most },
  ],
});

/** A compound: an inhabited ring or arc, a substantial industrial block joined to it, the secure rooms beyond that behind a gate, a pier. */
const compound = (name: string, o: { outline: 'disc' | 'square'; inner: boolean; gap?: { side: 'n' | 'e' | 's' | 'w'; from: number }; works: ('n' | 'e' | 's' | 'w')[] | 'tip'; pier: ('n' | 'e' | 's' | 'w')[] | 'tip'; neck: [number, number]; rowDepth?: number }): Recipe => ({
  name,
  root: { kind: 'ring', takes: ['habitation', 'defence', 'commons'], outline: o.outline, cut: 2, inner: o.inner, ...(o.gap ? { gap: o.gap } : {}) },
  spacing: 2,
  branches: [
    { takes: ['works', 'freight'], per: 'together', host: o.works === 'tip' ? { on: 'tip' } : { on: 'rim', prefer: o.works }, neck: o.neck, section: { rooms: [4, 8], ...(o.rowDepth ? { rowDepth: o.rowDepth, even: true } : {}) }, link: [3, 5] },
    { takes: ['secure'], per: 'together', host: { on: 'after', rule: 0 }, neck: 3, gated: true, section: { rooms: [3, 7], cap: true }, link: 4 },
    { takes: ['harbour'], per: 'together', host: o.pier === 'tip' ? { on: 'tip' } : { on: 'rim', prefer: o.pier }, neck: 2, pier: true, section: { rooms: [2, 4], cap: true }, link: 4 },
  ],
});

export const stationRecipes = {
  tree: [
    tree('ribs: paired chains, even steps', { most: 2, pairs: 0.9, step: [20, 20], neck: [4, 4], link: [4, 4], rooms: [3, 4], fork: 0, spacing: 2, arrange: 'series' }),
    tree('combs: modules on the sides of stems', { most: 4, pairs: 0.5, step: [16, 28], neck: [2, 4], link: [14, 18], rooms: [2, 3], fork: 0, spacing: 2, arrange: 'sides' }),
    tree('scrappy: small modules, forks, uneven', { most: 3, pairs: 0.2, step: [8, 30], neck: [2, 10], link: [3, 8], rooms: [2, 3], fork: 0.6, spacing: 2, arrange: 'series' }),
  ],
  compound: [
    compound('ring with a works block and a pier', { outline: 'disc', inner: true, works: ['s', 'n'], pier: ['w', 'e'], neck: [0, 0], rowDepth: 8 }),
    compound('arc open to the south, works off its back', { outline: 'disc', inner: true, gap: { side: 's', from: 8 }, works: ['n'], pier: ['w', 'e'], neck: [2, 4] }),
    compound('half ring, the works on its tip', { outline: 'disc', inner: true, gap: { side: 'e', from: 4 }, works: 'tip', pier: ['w'], neck: [2, 2], rowDepth: 7 }),
    compound('single-loaded arc (too small for its rooms)', { outline: 'disc', inner: false, gap: { side: 'e', from: 4 }, works: ['s', 'n'], pier: ['w'], neck: [0, 0], rowDepth: 7 }),
    compound('square with bastions, staggered bays', { outline: 'square', inner: true, works: ['e', 'w'], pier: ['w', 'e'], neck: [3, 5] }),
  ],
} as const satisfies Record<string, readonly Recipe[]>;
