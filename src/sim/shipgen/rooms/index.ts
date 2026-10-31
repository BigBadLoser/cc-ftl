import type { RoomRole } from '../types';
import { bridge } from './bridge';
import { engineering } from './engineering';
import { mess } from './mess';
import { quarters } from './quarters';
import { storage } from './storage';
import { armoury, drill, farm, garden, hangarDeck, industry, plaza } from './station';
import { dock, engines, hangar, shields, weapons } from './systems';
import type { RoomRecipe } from './types';

/** Room recipes by role. Halls and AI cores have none. Mount rooms keep the generic placer for their mounts. */
export const RECIPES: Partial<Record<RoomRole, RoomRecipe>> = {
  bridge, quarters, cargo: storage, support: mess, reactor: engineering, weapons, shields, engine: engines, dock, hangar, farm, industry, armoury, plaza, garden, drill,
};

/**
 * Modules stations swap for others, whatever the room recipe says: no hydroponics beds outside a farm (scattered through
 * messes and lounges they read as clutter), a planter in their place (not a locker: the lockers of a station belong in
 * quarters, stores and armouries). Farms keep theirs, in rows (rooms/aisles.ts).
 */
const STATION_SWAP: Readonly<Record<string, string>> = { 'module.hydroponics': 'module.planter' };

/** A recipe with modules swapped; a choice list that ends up naming one module twice keeps it once. */
function swapped(recipe: RoomRecipe, swap: Readonly<Record<string, string>>): RoomRecipe {
  return {
    ...recipe,
    arrangements: recipe.arrangements.map((a) => ({
      ...a,
      steps: a.steps.map((st) => {
        const mods = [...new Set((typeof st.mod === 'string' ? [st.mod] : st.mod).map((m) => swap[m] ?? m))];
        return { ...st, mod: mods.length === 1 ? (mods[0] as string) : mods };
      }),
    })),
  };
}

/** Room recipes for stations (immobile hulls): the ship recipes with the station swaps. */
export const STATION_RECIPES: Partial<Record<RoomRole, RoomRecipe>> = {
  ...Object.fromEntries(Object.entries(RECIPES).map(([role, r]) => [role, swapped(r as RoomRecipe, STATION_SWAP)])),
  // Station hangars are hangar decks: shuttle bays out on the floor, not against a wall.
  hangar: hangarDeck,
  farm,
};

export { pruneDoors } from './doors';
export { planBerths, type BerthStyle } from './plans';
export { planAisles } from './aisles';
export { planDesign, DESIGNS, type DesignName } from './designs';
export { drawRoom, furnish, keepDoorApproach, reserveWalkway, placeStep, specStep, roomFill, type RoomDraw } from './furnish';
export { claimCompanion, withCompanions } from './companions';
export type { RoomRecipe, Arrangement, Step } from './types';
