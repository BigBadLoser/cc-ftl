import type { Grid } from './grid';
import { ModuleC, type Module } from './modules/components';
import type { ModuleDef } from './registry';
import { roomTiles } from './roomIndex';
import type { Sim } from './sim';

/**
 * What a room is for, by what stands in it: the one owner of a room's type and display name (the door inspector asks it).
 * A module votes by the role flags its content def already carries (`roomKindOfModule`), no module ids; lights, vents and other
 * fixtures carry none and do not vote. A mixed room takes the first kind in `ROOM_KINDS`, ordered most defining first.
 * No vote: a long narrow room is a Corridor, anything else a plain Room.
 */
export const ROOM_KINDS = ['Airlock', 'Bridge', 'Medbay', 'Engineering', 'Weapons', 'Lab', 'Quarters', 'Mess', 'Workshop', 'Garden', 'Storage'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number] | 'Corridor' | 'Room';

/** The kind one module votes for, from its def's role flags, or null for a fixture. */
export function roomKindOfModule(def: ModuleDef): (typeof ROOM_KINDS)[number] | null {
  if (def.airlock) return 'Airlock';
  if (def.bridge || def.console === 'helm') return 'Bridge';
  if (def.medical) return 'Medbay';
  if (def.engine || def.shieldGen || def.fuel || def.battery || def.radiator || def.power > 0) return 'Engineering';
  if (def.weapon || def.console) return 'Weapons';
  if (def.research) return 'Lab';
  if (def.bed) return 'Quarters';
  if (def.galley || def.leisure) return 'Mess';
  if (def.crafting || def.workstation) return 'Workshop';
  if (def.plot) return 'Garden';
  if (def.storage) return 'Storage';
  return null;
}

/** The kind of a room (a `room` id of the grid): see the file comment. */
export function roomKind(sim: Sim, grid: Grid, room: number): RoomKind {
  const tiles = roomTiles(grid).get(room);
  if (!tiles || tiles.length === 0) return 'Room';
  let best: number = ROOM_KINDS.length;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const i of tiles) {
    const lx = i % grid.width, ly = Math.floor(i / grid.width);
    minX = Math.min(minX, lx); maxX = Math.max(maxX, lx); minY = Math.min(minY, ly); maxY = Math.max(maxY, ly);
    const id = grid.get('module', grid.x0 + lx, grid.y0 + ly);
    if (id === 0) continue;
    const m = sim.world.get(id, ModuleC) as Module | undefined;
    const def = m ? sim.content.modules[m.def] : undefined;
    const kind = def ? roomKindOfModule(def) : null;
    if (kind) best = Math.min(best, ROOM_KINDS.indexOf(kind));
  }
  if (best < ROOM_KINDS.length) return ROOM_KINDS[best] ?? 'Room';
  const w = maxX - minX + 1, h = maxY - minY + 1;
  return Math.min(w, h) <= 2 && Math.max(w, h) >= 3 ? 'Corridor' : 'Room';
}
