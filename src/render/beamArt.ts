import { Struct } from '../sim/structure';
import { hash } from './assets/palette';

/** Beam looks in the `struct` sheets: `struct.beam.<look>.*`. */
export type BeamLook = 'navy' | 'drone' | 'civil' | 'scrap';

/** Look of each generated-ship faction. Ships without a faction look (the player's, handmade ones) use the clean civil box truss. */
const LOOK_OF: Record<string, BeamLook> = {
  'faction.navy': 'navy',
  'faction.drones': 'drone',
  'faction.civilian': 'civil',
  'faction.scrapper': 'scrap',
};
export const DEFAULT_BEAM_LOOK: BeamLook = 'civil';

export const beamLookFor = (faction: string | undefined): BeamLook => (faction && LOOK_OF[faction]) || DEFAULT_BEAM_LOOK;

/** Direction bits and names, in mask order: N (-y) 1, E (+x) 2, S (+y) 4, W (-x) 8. */
const DIRS = [
  { bit: 1, name: 'n', dx: 0, dy: -1 },
  { bit: 2, name: 'e', dx: 1, dy: 0 },
  { bit: 4, name: 's', dx: 0, dy: 1 },
  { bit: 8, name: 'w', dx: -1, dy: 0 },
] as const;

/** Sprite ids of one beam tile, bottom first: the tile by connection mask, then the overlays drawn on the same tile. */
export function beamIds(kindAt: (x: number, y: number) => number, x: number, y: number, look: BeamLook): string[] {
  let mask = 0;
  const walls: string[] = [];
  for (const d of DIRS) {
    const k = kindAt(x + d.dx, y + d.dy);
    if (k === Struct.Beam) mask |= d.bit;
    else if (k === Struct.Wall) walls.push(d.name);
  }
  const base = `struct.beam.${look}`;
  // Straight runs vary by a tile hash so long beams don't repeat.
  const variant = mask === 5 || mask === 10 ? ['', '.v1', '.v2'][hash(x * 7919 + y * 104729, 3) % 3] : '';
  const ids = [`${base}.m${mask}${variant}`];
  // A flange on every hull wall the beam touches; a single-arm beam gets an end cap on its free side unless a wall closes it.
  for (const w of walls) ids.push(`${base}.flange.${w}`);
  if (mask === 1 || mask === 2 || mask === 4 || mask === 8) {
    const free = DIRS.find((d) => d.bit === (mask === 1 ? 4 : mask === 2 ? 8 : mask === 4 ? 1 : 2));
    if (free && !walls.includes(free.name)) ids.push(`${base}.cap.${free.name}`);
  }
  return ids;
}
