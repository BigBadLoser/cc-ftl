import type { RoomSpec, StationDept } from '../plan';

/** A station room's department: what the recipes group and place rooms by. */
export type Dept = StationDept;

/** The department of a room: the one its spec names, else by its role. */
export function deptOf(r: Pick<RoomSpec, 'role' | 'dept'>): Dept {
  if (r.dept) return r.dept;
  switch (r.role) {
    case 'cargo': return 'freight';
    case 'bridge': case 'armoury': case 'dock': return 'harbour';
    case 'quarters': case 'support': case 'medbay': return 'habitation';
    case 'reactor': case 'shields': case 'core': case 'plant': return 'secure';
    case 'weapons': return 'defence';
    case 'industry': case 'farm': case 'hangar': return 'works';
    default: return 'commons';
  }
}
