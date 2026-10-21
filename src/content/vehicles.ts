import type { VehicleDef } from '../sim';

/** Shuttles and mining pods (3x3 'pod' bays); construction pods come later. Speed is sector tiles per second at piloting 0 (a role.pilot, piloting 3, flies 30% faster). */
export const vehicles = {
  // A pilot plus 4 passengers. One burst-laser volley (66 module damage) nearly kills it; point defence nibbles.
  'vehicle.shuttle': { name: 'Shuttle', class: 'shuttle', asset: 'vehicle.shuttle', speed: 8, maxHp: 90, capacity: 4, evasion: 0.3, cargo: 40, eva: { suits: 3, hoverGap: 4.5 } },
  // Crewless mining pod (3x3 pod bay): flies to asteroid ore, lasers it into a small hold, flies home; crew haul the ore to
  // storage. Fragile and quick to dodge.
  'vehicle.mining_pod': { name: 'Mining pod', class: 'pod', asset: 'vehicle.mining_pod', speed: 6, maxHp: 30, capacity: 0, evasion: 0.4, cargo: 24, crewless: true, mining: { unitsPerSec: 2 } },
} satisfies Record<string, VehicleDef>;
