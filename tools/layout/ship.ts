/** Ship settings as pure edits of a layout: name, kind (ship or station), faction (what the preview takes its livery and side from) and grid size. */
import { content } from '../../src/content';
import { LIVERIES, SCHEMES } from '../../src/render/roofArt';
import { moduleTiles, type Layout } from './layout';
import { factions, sideOf } from './source';

export const MIN_SIZE = 6, MAX_SIZE = 240;

export const renameShip = (l: Layout, name: string): Layout => (name.trim() && name.trim() !== l.name ? { ...l, name: name.trim() } : l);
/** Station = immobile (the engine check is off). */
export const setKind = (l: Layout, kind: 'ship' | 'station'): Layout => (l.immobile === (kind === 'station') ? l : { ...l, immobile: kind === 'station' });
export const kindOf = (l: Layout): 'ship' | 'station' => (l.immobile ? 'station' : 'ship');

/** The game's factions for the picker. */
export const factionList = (): { id: string; name: string }[] =>
  factions().map((id) => ({ id, name: (content.factions as Record<string, { name?: string }>)[id]?.name ?? id.replace('faction.', '') }));

/**
 * Give the design a faction (its generator faction and side, what the preview stamps it with), or none (a plain player ship). Keeps the seed,
 * depth and role of an existing origin; a blank grid gets seed 1, depth 0.
 */
export function setFaction(l: Layout, id: string | null): Layout {
  if (id === null) {
    if (!l.origin) return l;
    const rest: Layout = { ...l };
    delete rest.origin;
    return rest;
  }
  if (l.origin?.gen.faction === id) return l;
  const gen = { ...(l.origin?.gen ?? { seed: 1, depth: 0 }), faction: id };
  return { ...l, origin: { gen, side: sideOf(id) } };
}

/** The livery colours a faction's ships pick from (its livery's first two schemes: primary and secondary), for a swatch. */
export function liverySwatch(id: string): [string, string] {
  const livery = (content.factions as Record<string, { art?: { livery?: string } }>)[id]?.art?.livery;
  const names = (livery && LIVERIES[livery]) || [];
  const sc = SCHEMES[names[0] ?? 'crimson'];
  const hex = (n: number | undefined): string => `#${(n ?? 0).toString(16).padStart(6, '0')}`;
  return [hex(sc?.P), hex(sc?.S)];
}

/** Where the design was imported from, as text; '' when it was not (a blank grid, or one given a faction by hand has no role). */
export const originText = (l: Layout): string => {
  const g = l.origin?.gen;
  return g?.role ? `${g.faction.replace(/^(faction|station)\./, '')}:${g.role} · seed ${g.seed} · depth ${g.depth}` : '';
};

/**
 * Resize the grid, growing or shrinking from the bottom-right. A shrink that would cut off anything but open space (a tile or a module) is
 * refused, with the reason.
 */
export function resizeGrid(l: Layout, width: number, height: number): { layout: Layout } | { error: string } {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return { error: 'Size must be whole numbers' };
  if (width < MIN_SIZE || height < MIN_SIZE || width > MAX_SIZE || height > MAX_SIZE) return { error: `Size must be ${MIN_SIZE} to ${MAX_SIZE}` };
  if (width === l.width && height === l.height) return { layout: l };
  for (let y = 0; y < l.height; y++) {
    for (let x = 0; x < l.width; x++) {
      if ((x >= width || y >= height) && l.cells[y]?.[x] !== '.') return { error: `Would cut off the ship at ${x},${y}` };
    }
  }
  for (const m of l.modules) {
    const out = moduleTiles(m).find(([x, y]) => x >= width || y >= height);
    if (out) return { error: `Would cut off a module at ${out[0]},${out[1]}` };
  }
  const cells = Array.from({ length: height }, (_, y) => (l.cells[y] ?? '').slice(0, width).padEnd(width, '.'));
  const roomOf = new Array<number>(width * height).fill(-1);
  for (let y = 0; y < Math.min(height, l.height); y++) for (let x = 0; x < Math.min(width, l.width); x++) roomOf[y * width + x] = l.roomOf[y * l.width + x] ?? -1;
  return { layout: { ...l, width, height, cells, roomOf } };
}

/** Plain-language lines for what ship settings changed between two layouts (for the change list and a saved case). */
export function shipChanges(a: Layout, b: Layout): string[] {
  const out: string[] = [];
  if (a.name !== b.name) out.push(`Renamed the ship "${a.name}" to "${b.name}"`);
  if (a.immobile !== b.immobile) out.push(`Made it a ${kindOf(b)}`);
  if (a.origin?.gen.faction !== b.origin?.gen.faction) out.push(b.origin ? `Set the faction to ${b.origin.gen.faction.replace(/^(faction|station)\./, '')}` : 'Removed the faction');
  if (a.width !== b.width || a.height !== b.height) out.push(`Resized the grid from ${a.width} x ${a.height} to ${b.width} x ${b.height}`);
  return out;
}
