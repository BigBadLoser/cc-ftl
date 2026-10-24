import type { ItemDef } from '../sim';

/** Raw and refined resources. Stack sizes are units per floor stack or storage slot. */
export const items = {
  'item.scrap': { name: 'Scrap', tags: ['raw', 'salvage'], stackSize: 100, price: 2 },
  'item.metal': { name: 'Metal', tags: ['refined', 'building'], stackSize: 100, price: 6 },
  'item.electronics': { name: 'Electronics', tags: ['refined', 'components'], stackSize: 50, price: 16 },
  // Flammable: loose polymer on a burning tile burns and feeds the fire.
  'item.polymer': { name: 'Polymer', tags: ['refined', 'building'], stackSize: 50, price: 9, flammability: 0.6 },
  // Robot spare parts: mend robots (25 hp each), salvaged from robot wrecks.
  'item.parts': { name: 'Spare parts', tags: ['refined', 'components'], stackSize: 50, price: 12 },
  // Raw ores from asteroid rock: refined at a refinery (metal, electronics). Ice is used as is.
  'item.iron_ore': { name: 'Iron ore', tags: ['raw', 'ore'], stackSize: 100, price: 3 },
  'item.rare_ore': { name: 'Rare ore', tags: ['raw', 'ore'], stackSize: 50, price: 12 },
  'item.ice': { name: 'Ice', tags: ['raw', 'water'], stackSize: 50, price: 3 },
  // Food: hungry crew eat one from storage (+50 hunger). Printed at a galley from scrap. Flammable packaging.
  'item.ration': { name: 'Ration', tags: ['food'], stackSize: 50, price: 5, flammability: 0.2, food: { nutrition: 50 } },
  // Ammo for missile launchers. Explosive: loose missiles fuel fires.
  // Starship fuel: every jump on the starmap burns some (more for long routes; hyperlanes are cheaper per distance).
  // Volatile: a loose stack on a burning tile feeds the fire.
  'item.fuel': { name: 'Fuel', tags: ['fuel'], stackSize: 50, price: 6, flammability: 0.7 },
  'item.missile': { name: 'Missile', tags: ['ammo'], stackSize: 20, price: 24, flammability: 0.5 },
  // Crafted at the fabricator; a vehicle bay turns it into a stowed shuttle (vehicle.assign).
  'item.shuttle': { name: 'Shuttle', tags: ['vehicle'], stackSize: 1, price: 650, vehicle: 'vehicle.shuttle' },
  // Hand weapons: crew equip them from storage (crew.equip, or automatically for a role's loadout). Range in tiles.
  // `tier`: 1 basic, 2 middle grade, 3 the best (depots sell surplus up to tier 2).
  'item.sidearm': { name: 'Sidearm', tags: ['weapon', 'ranged'], stackSize: 5, price: 45, tier: 1, hand: { kind: 'ranged', damage: 12, range: 8, cooldownSec: 1, accuracy: 0.7, art: { id: 'sidearm', family: '1h' } } },
  'item.rifle': { name: 'Rifle', tags: ['weapon', 'ranged'], stackSize: 5, price: 95, tier: 3, hand: { kind: 'ranged', damage: 18, range: 14, cooldownSec: 1.6, accuracy: 0.75, art: { id: 'rifle', family: '2h' } } },
  // Ion pistol: weak, but every hit stuns ion-vulnerable targets (robots).
  'item.ion_pistol': { name: 'Ion pistol', tags: ['weapon', 'ranged'], stackSize: 5, price: 70, tier: 2, hand: { kind: 'ranged', damage: 4, range: 8, cooldownSec: 1.4, accuracy: 0.7, ion: true, art: { id: 'ion_pistol', family: '1h' } } },
  'item.blade': { name: 'Blade', tags: ['weapon', 'melee'], stackSize: 5, price: 30, tier: 1, hand: { kind: 'melee', damage: 20, range: 1, cooldownSec: 1.2, accuracy: 0.8, art: { id: 'blade', family: '1m' } } },
} satisfies Record<string, ItemDef>;
