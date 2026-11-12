import type { RoomSpec } from '../plan';
import { cabinsOf } from '../stationFlowKit';
import { SHOP } from '../stationRings';
import type { Dept, StationFlowDef } from './types';

/**
 * The station's rooms grouped into the flow's departments. A room goes to the first department that lists its role
 * (docks by each department's count); quarters become one-bed cabins; the market's shops are made here, their number
 * from the station's size (the plan does not list them yet). Rooms no department takes are returned as `loose`.
 */
export function departmentsOf(flow: StationFlowDef, rooms: readonly RoomSpec[]): { depts: Dept[]; loose: RoomSpec[] } {
  const depts: Dept[] = flow.depts.map((def) => ({ def, rooms: [], docks: [] }));
  const loose: RoomSpec[] = [];
  const docks = rooms.filter((r) => r.role === 'dock');
  // Docks: counted departments first, then whoever takes the rest.
  for (const d of depts) if (typeof d.def.docks === 'number') d.docks.push(...docks.splice(0, d.def.docks));
  const rest = depts.find((d) => d.def.docks === 'all');
  if (rest) rest.docks.push(...docks.splice(0));
  loose.push(...docks);
  for (const r of rooms) {
    if (r.role === 'dock') continue;
    const d = depts.find((q) => q.def.roles.includes(r.role));
    if (d) d.rooms.push(...cabinsOf(r).map((c) => ({ ...c, dept: d.def.id })));
    else loose.push(r);
  }
  const market = depts.find((d) => d.def.roles.includes('shop'));
  if (market) {
    const n = Math.max(4, Math.min(12, Math.round(rooms.length / 3)));
    // A shop stands with its width along the street and its depth behind.
    for (let i = 0; i < n; i++) market.rooms.push({ role: 'shop', mods: [], w: SHOP.width, h: SHOP.depth, dept: market.def.id });
  }
  return { depts, loose };
}

/** Street frontage a list of rooms takes when lined on one side (each its width and a wall). */
export const frontage = (rooms: readonly RoomSpec[]): number => rooms.reduce((n, r) => n + r.w + 1, 0);
