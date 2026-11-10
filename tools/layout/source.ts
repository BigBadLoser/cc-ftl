/**
 * Where a design comes from: a faction's ship, a station, or a starter ship's template. `buildDesign` turns a source into a
 * Design through the same generators the CLI and the game use; `options` lists what each field can take.
 */
import { content } from '../../src/content';
import { starterShips } from '../../src/content/ships/starterShips';
import type { StationDef } from '../../src/sim';
import { factionIds, gen, stationIds } from '../shipgen/draw';
import { templateResult } from '../shipgen/templates';
import { designOf, type Design } from './design';

export type SourceKind = 'faction' | 'station' | 'starter';
export interface Source {
  kind: SourceKind;
  /** faction: `faction.navy`; station: `station.trading`; starter: its template id. */
  id: string;
  /** Faction hull family ('' any). */
  family: string;
  /** Station size. */
  size: string;
  /** Station layout ('' any the size allows). */
  layout: string;
  seed: number;
  depth: number;
}
export const DEFAULT_SOURCE: Source = { kind: 'station', id: 'station.trading', family: '', size: 'station', layout: 'stationWheel', seed: 1, depth: 4 };

export const SIZES = ['outpost', 'station', 'hub'] as const;
export const factions = (): string[] => factionIds();
export const stations = (): string[] => stationIds();
export const starters = (): { id: string; name: string }[] => starterShips.map((s) => ({ id: s.id, name: `${s.name} (${s.title})` }));

export function familiesOf(faction: string): string[] {
  const f = (content.factions as Record<string, { hullFamilies?: { id: string }[] }>)[faction];
  return f?.hullFamilies?.map((h) => h.id) ?? [];
}
/** The layouts a station kind uses at a size. */
export function layoutsOf(station: string, size: string): string[] {
  const def = (content.stations as Record<string, StationDef>)[station];
  const tier = def?.tiers[size as keyof StationDef['tiers']];
  return tier ? tier.grammars.map((g) => g.value) : [];
}

/** The generator spec string (what `tools/shipgen/cli.js` takes) for a source. */
export function specOf(s: Source): string {
  if (s.kind === 'faction') return `${s.id}${s.family ? `:${s.family}` : ''}`;
  if (s.kind === 'station') return `${s.id}:${s.size}${s.layout ? `@${s.layout}` : ''}`;
  return s.id;
}

export function buildDesign(s: Source): Design {
  if (s.kind === 'starter') {
    const st = starterShips.find((x) => x.id === s.id) ?? (starterShips[0] as (typeof starterShips)[number]);
    return designOf(templateResult(st.name, st.template), `${st.name} (starter)`);
  }
  // A station's size is picked by the seed (size list, seed 1 the first): one size, so seed only varies the layout.
  const spec = specOf(s);
  const label = s.kind === 'faction' ? `${spec.replace('faction.', '')} seed ${s.seed} depth ${s.depth}` : `${spec.replace('station.', '')} seed ${s.seed}`;
  return designOf(gen(spec, s.seed, s.depth), label);
}
