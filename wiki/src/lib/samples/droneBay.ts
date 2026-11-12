import type { UiApi, UiModule } from '../../../../src/ui/api';
import { modules } from '../../../../src/content/modules';

const def = modules['module.droneBay'];

// A drone bay as the module inspector shows it: a repair drone out working, a medic drone charging on its pad.
// The module's own numbers (power, hull) come from the game's content.
// Typed against the game's UI types, so a change to the inspector's data fails the wiki check instead of drifting.
export const droneBay = {
  id: 1, ship: 1, def: 'module.droneBay', name: 'Drone bay', x: 0, y: 0, local: { x: 0, y: 0 },
  hp: def.maxHp, maxHp: def.maxHp, repairFirst: false, powerPriority: def.powerPriority, enabled: true, powered: true, power: def.power,
  reserve: null, storage: false, crafting: false, research: false, plot: null, idle: false, bay: null, upgradeSlot: null,
  droneBay: {
    slots: [
      { id: 11, name: 'Repair drone', state: 'out', doing: 'Repairing Shield generator', charge: 64, hp: 30, maxHp: 30, supply: { name: 'Metal', have: 3, cap: 4 } },
      { id: 12, name: 'Medic drone', state: 'docked', doing: 'Charging', charge: 18, hp: 30, maxHp: 30, supply: null },
    ],
    out: 1,
    cap: 2,
  },
} satisfies UiModule;

// The overview's buttons only dispatch; in the wiki they do nothing.
export const inertApi = { dispatch: () => {}, selectModule: () => {} } as unknown as UiApi;
