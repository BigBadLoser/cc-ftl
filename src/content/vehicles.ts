import type { VehicleDef } from '../sim';

/** Only shuttles for now; pods (mining, construction) and their 3x3 'pod' bays come later. Speed is sector tiles per second at piloting 0 (a role.pilot, piloting 3, flies 30% faster). */
export const vehicles = {
  // A pilot plus 4 passengers. One burst-laser volley (66 module damage) nearly kills it; point defence nibbles.
  'vehicle.shuttle': { name: 'Shuttle', class: 'shuttle', asset: 'vehicle.shuttle', speed: 8, maxHp: 90, capacity: 4, evasion: 0.3, cargo: 40, eva: { suits: 3, hoverGap: 4.5 } },
} satisfies Record<string, VehicleDef>;
