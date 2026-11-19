/**
 * Where a design comes from: a faction's ship, a station, or a starter ship's template. `buildDesign` turns a source into a
 * Design through the same generators the CLI and the game use; `options` lists what each field can take.
 */
import { content } from '../../src/content';
import { starterShips } from '../../src/content/ships/starterShips';
import { generateOutpost, OUTPOST_KINDS, type OreDef, type OutpostKind, type StationDef } from '../../src/sim';
import { assemblyLayouts, factionIds, gen, stationIds } from '../shipgen/draw';
import { templateResult } from '../shipgen/templates';
import { layoutOfGen, type Layout } from './layout';

export type SourceKind = 'faction' | 'station' | 'outpost' | 'starter' | 'blank';
export interface Source {
  kind: SourceKind;
  /** faction: `faction.navy`; station: `station.trading`; outpost: its kind (`trading`); starter: its template id; blank: ''. */
  id: string;
  /** Faction hull family ('' any). */
  family: string;
  /** Station size. */
  size: string;
  /** Station layout ('' as the game builds it; `assembly.<family>[.n]` one recipe). */
  layout: string;
  seed: number;
  depth: number;
}
export const DEFAULT_SOURCE: Source = { kind: 'station', id: 'station.trading', family: '', size: 'station', layout: '', seed: 1, depth: 4 };

export const SIZES = ['outpost', 'station', 'hub'] as const;
export const factions = (): string[] => factionIds();
export const stations = (): string[] => stationIds();
/** Asteroid outpost kinds: the surface ones (trading, farming, mining) stand on levelled rock, the dug ones are cut into it. */
export const outposts = (): string[] => [...OUTPOST_KINDS.surface, ...OUTPOST_KINDS.dug];
export const starters = (): { id: string; name: string }[] => starterShips.map((s) => ({ id: s.id, name: `${s.name} (${s.title})` }));

export function familiesOf(faction: string): string[] {
  const f = (content.factions as Record<string, { hullFamilies?: { id: string }[] }>)[faction];
  return f?.hullFamilies?.map((h) => h.id) ?? [];
}
/** Every station assembly recipe (any kind's rooms can be assembled by any); '' (the kind's own, as the game picks) is the default. */
export function layoutsOf(station: string, size: string): string[] {
  const def = (content.stations as Record<string, StationDef>)[station];
  return def?.tiers[size as keyof StationDef['tiers']] ? assemblyLayouts() : [];
}

/** The side a faction (or station kind) flies for, as the game reads it: its own `side`, else 'hostile' as the game's spawn does. */
export function sideOf(id: string): string {
  const f = (content.factions as Record<string, { side?: string }>)[id] ?? (content.stations as Record<string, StationDef>)[id];
  return f?.side ?? 'hostile';
}

/** The generator spec string (what `tools/shipgen/cli.js` takes) for a source. */
export function specOf(s: Source): string {
  if (s.kind === 'blank') return '';
  if (s.kind === 'faction') return `${s.id}${s.family ? `:${s.family}` : ''}`;
  if (s.kind === 'station') return `${s.id}:${s.size}${s.layout ? `@${s.layout}` : ''}`;
  if (s.kind === 'outpost') return `outpost.${s.id}`;
  return s.id;
}

/** A blank grid: open space to draw on. */
export function blankLayout(w = 48, h = 36): Layout {
  return { name: 'Blank', width: w, height: h, cells: Array.from({ length: h }, () => '.'.repeat(w)), roomOf: new Array<number>(w * h).fill(-1), rooms: [], modules: [], moduleIds: [], nextModuleId: 0, extra: {}, immobile: true };
}

export function buildLayout(s: Source): { layout: Layout; label: string } {
  if (s.kind === 'blank') return { layout: { ...blankLayout(), name: 'Blank grid' }, label: 'Blank grid' };
  if (s.kind === 'starter') {
    const st = starterShips.find((x) => x.id === s.id) ?? (starterShips[0] as (typeof starterShips)[number]);
    return { layout: layoutOfGen(templateResult(st.name, st.template), `${st.name} (starter)`, false), label: `${st.name} (starter)` };
  }
  if (s.kind === 'outpost') return outpostLayout(s);
  // A station's size is picked by the seed (size list, seed 1 the first): one size, so seed only varies the layout.
  const spec = specOf(s);
  const label = s.kind === 'faction' ? `${spec.replace('faction.', '')} seed ${s.seed} depth ${s.depth}` : `${spec.replace('station.', '')} seed ${s.seed}`;
  const made = gen(spec, s.seed, s.depth);
  const layout = layoutOfGen(made, label, s.kind === 'station');
  // as the game spawns it (stations/spawn.ts, combat/handlers.ts): the generator's id, and the faction's or kind's side
  const origin = s.kind === 'station'
    ? { faction: s.id, seed: s.seed >>> 0, depth: 0, role: s.size }
    : { faction: s.id, seed: s.seed, depth: s.depth, ...(made.role ? { role: made.role } : {}) };
  // a prefab base (its result has a site: pads on open ground) stands on asteroid ground, as the game's outpost stamp puts it
  return { layout: { ...layout, origin: { gen: origin, side: sideOf(s.id) }, ...('site' in made ? { ground: true as const } : {}) }, label };
}

/**
 * An asteroid outpost as the game builds one (`generateOutpost`: the station kind's outpost assembly, a prefab base for the trading
 * outpost, turned until its dock faces the rock's edge, buried airlocks dropped): the base without its asteroid. A surface base stands on
 * levelled ground, which the preview lays round it.
 */
function outpostLayout(s: Source): { layout: Layout; label: string } {
  const kind = s.id as OutpostKind;
  const style = (OUTPOST_KINDS.dug as readonly string[]).includes(kind) ? 'dug' : 'surface';
  const o = generateOutpost(style, s.seed >>> 0, { ores: Object.values(content.ores ?? {}) as OreDef[], modules: content.modules, stations: content.stations as Record<string, StationDef> }, kind);
  if (!o) throw new Error(`no ${kind} outpost fits an asteroid at seed ${s.seed}; try another seed`);
  const label = `${kind} outpost seed ${s.seed}`;
  const layout = layoutOfGen({ ...o.station, template: o.template }, label, true);
  // as the game stamps it (outposts/stamp.ts): an outpost of its station kind, neutral on the surface, hostile dug in
  const origin = { gen: { faction: o.stationKind, seed: o.seed >>> 0, depth: 0, role: 'outpost' }, side: style === 'surface' ? 'neutral' : 'hostile' };
  return { layout: { ...layout, origin, ...(style === 'surface' ? { ground: true as const } : {}) }, label };
}
