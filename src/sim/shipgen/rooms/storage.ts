import type { RoomRecipe } from './types';

const pack = { count: 'fill', pack: true } as const;

/**
 * Storage and cargo holds. Most are laid out in aisles (rooms/aisles.ts): back-to-back rows of racks or of pallets, an
 * aisle between each pair, the planned crates in the rows. A container hold is packed nearly solid with containers,
 * pallets and crates around ONE clear walkway (a spine joined to every door and protected tile); half the planned crates
 * go in, the rest of the stock space comes from the bigger pieces. The pallet and racked steps are the aisle plans'
 * fallback.
 */
export const storage = {
  fill: 0.85,
  arrangements: [
    {
      name: 'rack aisles', weight: 2, plan: { kind: 'aisles', piece: 'module.storage_rack' }, steps: [
        { mod: 'module.storage', count: 'spec', share: 0.6, wall: 'end', pack: true },
        { mod: 'module.storage_rack', ...pack, wall: 'long', row: true },
      ],
    },
    {
      name: 'pallet aisles', weight: 2, plan: { kind: 'aisles', piece: 'module.storage_pallet' }, steps: [
        { mod: 'module.storage_pallet', ...pack, wall: 'any' },
        { mod: 'module.storage', count: 'spec', share: 0.5, pack: true },
      ],
    },
    {
      name: 'container hold', weight: 1, walkway: 'long', steps: [
        { mod: 'module.cargo_container', ...pack, wall: 'long' },
        { mod: 'module.storage_pallet', ...pack },
        { mod: 'module.storage', count: 'spec', share: 0.5, pack: true },
        { mod: 'module.storage', ...pack },
      ],
    },
  ],
} as const satisfies RoomRecipe;
