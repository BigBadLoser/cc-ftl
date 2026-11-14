import { HAZARD_AIR, airHazardAt, tileHazards } from './crew/hazard';
import type { Grid } from './grid';
import { airlockDoorAt } from './modules/airlock';
import { roomKind } from './roomKind';
import type { Sim } from './sim';
import { DoorJam, Struct } from './structure';

/** What one side of a door is: a named room, open Space, or Hull (wall or anything else that is not a room). */
export interface DoorSide {
  /** The room's name (`roomKind`), "Space" or "Hull". */
  label: string;
  /** True when a crew member could breathe here unsuited (no thin air or CO2); always false in Space and Hull. */
  breathable: boolean;
  /** True when any hazard (bad air, heat, cold, fire, smoke) would shut a vent on this side (`airHazardAt`). */
  hazard: boolean;
  o2: number;
  co2: number;
  temp: number;
}

/** Plain-data readout of a door tile for the player inspector. */
export interface DoorInfo {
  airlock: boolean;
  /** The door's state in words: Open, Shut, Closing, Jammed open, Jammed shut. */
  state: string;
  /** The two sides, in tile order (west/north first). */
  sides: [DoorSide, DoorSide];
}

function sideAt(sim: Sim, grid: Grid, x: number, y: number): DoorSide {
  const kind = grid.inBounds(x, y) ? grid.get('struct', x, y) : Struct.Space;
  const base = { o2: grid.inBounds(x, y) ? grid.get('o2', x, y) : 0, co2: grid.inBounds(x, y) ? grid.get('co2', x, y) : 0, temp: grid.inBounds(x, y) ? grid.get('temp', x, y) : 0 };
  if (kind === Struct.Space) return { label: 'Space', breathable: false, hazard: true, ...base };
  if (kind === Struct.Wall || kind === Struct.Door) return { label: 'Hull', breathable: false, hazard: false, ...base };
  const room = grid.get('room', x, y);
  return { label: room ? roomKind(sim, grid, room) : 'Corridor', breathable: (tileHazards(grid, x, y, false, false) & HAZARD_AIR) === 0, hazard: airHazardAt(grid, x, y), ...base };
}

/** The door at (x, y) as the player sees it, or null when the tile is not a door. The one owner of a door's words and sides. */
export function doorInfo(sim: Sim, grid: Grid, x: number, y: number): DoorInfo | null {
  if (!grid.inBounds(x, y) || grid.get('struct', x, y) !== Struct.Door) return null;
  const open = (dx: number, dy: number): boolean => {
    const a = grid.inBounds(x - dx, y - dy) ? grid.get('struct', x - dx, y - dy) : Struct.Space;
    const b = grid.inBounds(x + dx, y + dy) ? grid.get('struct', x + dx, y + dy) : Struct.Space;
    return a !== Struct.Wall && b !== Struct.Wall;
  };
  const [dx, dy] = open(1, 0) || !open(0, 1) ? [1, 0] : [0, 1];
  const jam = grid.has('jam') ? grid.get('jam', x, y) : DoorJam.None;
  const v = grid.get('door', x, y);
  const state = jam === DoorJam.Open ? 'Jammed open' : jam === DoorJam.Shut ? 'Jammed shut' : v >= 255 ? 'Open' : v === 0 ? 'Shut' : 'Closing';
  return {
    airlock: airlockDoorAt(sim, grid, x, y) !== null,
    state,
    sides: [sideAt(sim, grid, x - dx, y - dy), sideAt(sim, grid, x + dx, y + dy)],
  };
}
