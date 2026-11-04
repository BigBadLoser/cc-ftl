import type { DroneDef } from '../sim';

/**
 * Drone types (DESIGN.md "Drones"; sim/drones). Each is data: the jobs it does, best first, and its numbers. All numbers are provisional.
 * Rates are fractions of a crew member's at workSpeed 1 (repair 3 hp/s, extinguish 90/s): a drone is slower than an engineer.
 */
const body = {
  speed: 3,
  maxHp: 40,
  // About 3 minutes flying on a full battery, 2 working; it heads home under 25 and goes out again once it is over 70.
  charge: { drainPerSec: 0.5, workMult: 1.5, lowBelow: 25, launchAbove: 70 },
  ionStunSec: 12,
  wreck: [{ item: 'item.parts', count: 1 }, { item: 'item.scrap_tech', count: 2 }],
};

export const drones = {
  // Repairs damaged modules at half an engineer's speed and puts out small fires (big ones are left to the crew).
  'drone.repair': {
    ...body,
    name: 'Repair drone',
    jobs: [{ kind: 'extinguish', rate: 0.6, maxFire: 120 }, { kind: 'repair', rate: 0.5 }],
    tint: 0xffa040,
  },
  // Flies to the downed (patches them so they stop bleeding) and the wounded (heals them slowly to three quarters). Beds and medics do the rest.
  'drone.medic': {
    ...body,
    name: 'Medic drone',
    jobs: [{ kind: 'firstAid', patchSec: 4, healPerSec: 1, healTo: 0.75 }],
    tint: 0x60f0a0,
  },
  // Guards the ship in space while a fight is on: circles it 4 tiles off the hull and shoots down incoming missiles, enemy drones and
  // shuttles (shuttles only chip, like point defence). Never fires at a ship, so it cannot start a fight. Quicker and frailer than the others.
  'drone.defence': {
    ...body,
    name: 'Defence drone',
    speed: 6,
    maxHp: 30,
    jobs: [{ kind: 'intercept', range: 14, gap: 4, fireSec: 0.8, hitChance: 0.45, droneDamage: 8, shuttleDamage: 4 }],
    tint: 0x70b0ff,
  },
} satisfies Record<string, DroneDef>;
