import type { ItemDef } from '../sim';

/** Raw and refined resources. Stack sizes are units per floor stack or storage slot. */
export const items = {
  // Salvage (DESIGN.md "Salvaging derelicts"): stripped from derelicts by type, processed at a scrapper. Placeholder art: the old scrap pile.
  'item.scrap_hull': { name: 'Hull scrap', tags: ['raw', 'scrap'], stackSize: 100, price: 3 },
  'item.scrap_tech': { name: 'Tech scrap', tags: ['raw', 'scrap'], stackSize: 100, price: 3 },
  'item.scrap_energy': { name: 'Energy scrap', tags: ['raw', 'scrap'], stackSize: 100, price: 3 },
  'item.scrap_weapons': { name: 'Weapons scrap', tags: ['raw', 'scrap'], stackSize: 100, price: 3 },
  'item.scrap_comfort': { name: 'Comfort scrap', tags: ['raw', 'scrap'], stackSize: 100, price: 3 },
  // Woven stuff; Comfort scrap is its first source (a loom-type module will make it later).
  'item.cloth': { name: 'Cloth', tags: ['refined', 'building'], stackSize: 50, price: 6, flammability: 0.5 },
  'item.metal': { name: 'Metal', tags: ['refined', 'building'], stackSize: 100, price: 8 },
  'item.electronics': { name: 'Electronics', tags: ['refined', 'components'], stackSize: 50, price: 16 },
  // Flammable: loose polymer on a burning tile burns and feeds the fire.
  'item.polymer': { name: 'Polymer', tags: ['refined', 'building'], stackSize: 50, price: 9, flammability: 0.6 },
  // Robot spare parts: mend robots (25 hp each), salvaged from robot wrecks.
  'item.parts': { name: 'Spare parts', tags: ['refined', 'components'], stackSize: 50, price: 12 },
  // Raw ores from asteroid rock: refined at a refinery (metal, electronics). Ice is used as is.
  'item.iron_ore': { name: 'Iron ore', tags: ['raw', 'ore'], stackSize: 100, price: 4 },
  'item.rare_ore': { name: 'Rare ore', tags: ['raw', 'ore'], stackSize: 50, price: 12 },
  'item.ice': { name: 'Ice', tags: ['raw', 'water'], stackSize: 50, price: 3 },
  // Split from ice at a refinery.
  'item.water': { name: 'Water', tags: ['refined', 'life'], stackSize: 50, price: 4 },
  'item.oxygen': { name: 'Oxygen', tags: ['refined', 'life'], stackSize: 50, price: 5 },
  // Food: hungry crew eat one from storage (+50 hunger). Printed at a galley. Flammable packaging.
  'item.ration': { name: 'Ration', tags: ['food'], stackSize: 50, price: 5, flammability: 0.2, food: { nutrition: 50 } },
  // Ammo for missile launchers. Explosive: loose missiles fuel fires.
  // Starship fuel: every jump on the starmap burns some (more for long routes; hyperlanes are cheaper per distance).
  // Volatile: a loose stack on a burning tile feeds the fire.
  'item.fuel': { name: 'Fuel', tags: ['fuel'], stackSize: 50, price: 6, flammability: 0.7 },
  'item.missile': { name: 'Missile', tags: ['ammo'], stackSize: 20, price: 24, flammability: 0.5 },
  // A delivery job's sealed crate (one per job): it sits on deck apart from storage until it is handed over.
  'item.cargo_crate': { name: 'Cargo crate', tags: ['cargo'], stackSize: 1, cargo: true },
  // Crafted at the fabricator; a vehicle bay turns it into a stowed shuttle (vehicle.assign).
  'item.shuttle': { name: 'Shuttle', tags: ['vehicle'], stackSize: 1, price: 650, vehicle: 'vehicle.shuttle' },
  // Hand weapons: crew equip them from storage (crew.equip, or automatically for a role's loadout). Range in tiles.
  // `tier`: 1 basic, 2 middle grade, 3 the best (depots sell surplus up to tier 2).
  'item.sidearm': { name: 'Sidearm', tags: ['weapon', 'ranged'], stackSize: 5, price: 45, tier: 1, hand: { kind: 'ranged', damage: 12, range: 8, cooldownSec: 1, accuracy: 0.7, art: { id: 'sidearm', family: '1h' } } },
  'item.rifle': { name: 'Rifle', tags: ['weapon', 'ranged'], stackSize: 5, price: 95, tier: 3, hand: { kind: 'ranged', damage: 18, range: 14, cooldownSec: 1.6, accuracy: 0.75, art: { id: 'rifle', family: '2h' } } },
  // Ion pistol: weak, but every hit stuns ion-vulnerable targets (robots).
  'item.ion_pistol': { name: 'Ion pistol', tags: ['weapon', 'ranged'], stackSize: 5, price: 70, tier: 2, hand: { kind: 'ranged', damage: 4, range: 8, cooldownSec: 1.4, accuracy: 0.7, ion: true, art: { id: 'ion_pistol', family: '1h' } } },
  'item.blade': { name: 'Blade', tags: ['weapon', 'melee'], stackSize: 5, price: 30, tier: 1, hand: { kind: 'melee', damage: 20, range: 1, cooldownSec: 1.2, accuracy: 0.8, art: { id: 'blade', family: '1m' } } },
  // --- Contraband (black markets, DESIGN.md): the `contraband` tag. Legitimate traders refuse it; navy and corporation scans confiscate it. ---
  // A delivery crate broken open (a breach of contract) spills these instead of the goods it held.
  'item.stolen_goods': { name: 'Stolen goods', tags: ['contraband', 'stolen'], stackSize: 50, price: 14 },
  // Taken off a captured ship.
  'item.looted_goods': { name: 'Looted goods', tags: ['contraband', 'loot'], stackSize: 50, price: 18 },
  // An illegal hand weapon: strong and unlicensed. Sold only at black markets.
  'item.disruptor': { name: 'Disruptor', tags: ['weapon', 'ranged', 'contraband'], stackSize: 5, price: 160, tier: 3, hand: { kind: 'ranged', damage: 22, range: 12, cooldownSec: 1.3, accuracy: 0.72, art: { id: 'rifle', family: '2h' } } },
  // The zealot machine bazaar's wares.
  'item.ai_core': { name: 'AI core', tags: ['machine'], stackSize: 5, price: 420 },
  'item.robot_parts': { name: 'Robot parts', tags: ['machine', 'components'], stackSize: 50, price: 30 },
  'item.drone_tech': { name: 'Drone tech', tags: ['machine', 'components'], stackSize: 10, price: 140 },
} satisfies Record<string, ItemDef>;
