import type { ItemDef } from '../sim';

/** Raw and refined resources. Stack sizes are units per floor stack or storage slot. */
export const items = {
  'item.scrap': { name: 'Scrap', tags: ['raw', 'salvage'], stackSize: 100 },
  'item.metal': { name: 'Metal', tags: ['refined', 'building'], stackSize: 100 },
  'item.electronics': { name: 'Electronics', tags: ['refined', 'components'], stackSize: 50 },
  // Flammable: loose polymer on a burning tile burns and feeds the fire.
  'item.polymer': { name: 'Polymer', tags: ['refined', 'building'], stackSize: 50, flammability: 0.6 },
  // Robot spare parts: mend robots (25 hp each), salvaged from robot wrecks.
  'item.parts': { name: 'Spare parts', tags: ['refined', 'components'], stackSize: 50 },
  'item.ice': { name: 'Ice', tags: ['raw', 'water'], stackSize: 50 },
  // Food: hungry crew eat one from storage (+50 hunger). Printed at a galley from scrap. Flammable packaging.
  'item.ration': { name: 'Ration', tags: ['food'], stackSize: 50, flammability: 0.2, food: { nutrition: 50 } },
  // Starship fuel: every jump on the starmap burns some (more for long routes; hyperlanes are cheaper per distance).
  // Trade stations sell it. Volatile: a loose stack on a burning tile feeds the fire.
  'item.fuel': { name: 'Fuel', tags: ['fuel'], stackSize: 50, flammability: 0.7, price: 6 },
  // Ammo for missile launchers. Explosive: loose missiles fuel fires.
  'item.missile': { name: 'Missile', tags: ['ammo'], stackSize: 20, flammability: 0.5 },
  // Crafted at the fabricator; a vehicle bay turns it into a stowed shuttle (vehicle.assign).
  'item.shuttle': { name: 'Shuttle', tags: ['vehicle'], stackSize: 1, vehicle: 'vehicle.shuttle' },
  // Hand weapons: crew equip them from storage (crew.equip, or automatically for a role's loadout). Range in tiles.
  'item.sidearm': { name: 'Sidearm', tags: ['weapon', 'ranged'], stackSize: 5, hand: { kind: 'ranged', damage: 12, range: 8, cooldownSec: 1, accuracy: 0.7 } },
  'item.rifle': { name: 'Rifle', tags: ['weapon', 'ranged'], stackSize: 5, hand: { kind: 'ranged', damage: 18, range: 14, cooldownSec: 1.6, accuracy: 0.75 } },
  // Ion pistol: weak, but every hit stuns ion-vulnerable targets (robots).
  'item.ion_pistol': { name: 'Ion pistol', tags: ['weapon', 'ranged'], stackSize: 5, hand: { kind: 'ranged', damage: 4, range: 8, cooldownSec: 1.4, accuracy: 0.7, ion: true } },
  'item.blade': { name: 'Blade', tags: ['weapon', 'melee'], stackSize: 5, hand: { kind: 'melee', damage: 20, range: 1, cooldownSec: 1.2, accuracy: 0.8 } },
} satisfies Record<string, ItemDef>;
