import type { RoomRole } from '../types';
import { bridge } from './bridge';
import { engineering } from './engineering';
import { mess } from './mess';
import { quarters } from './quarters';
import { storage } from './storage';
import { armoury, drill, farm, garden, industry, plaza } from './station';
import { dock, engines, hangar, shields, weapons } from './systems';
import type { RoomRecipe } from './types';

/** Room recipes by role. Halls and AI cores have none. Mount rooms keep the generic placer for their mounts. */
export const RECIPES: Partial<Record<RoomRole, RoomRecipe>> = {
  bridge, quarters, cargo: storage, support: mess, reactor: engineering, weapons, shields, engine: engines, dock, hangar, farm, industry, armoury, plaza, garden, drill,
};

/** Modules stations never get, whatever the room recipe says (rows of hydroponics beds everywhere read as clutter). */
const STATION_BANNED: readonly string[] = ['module.hydroponics'];

/** A recipe without the banned modules: a step of only banned modules is dropped, a choice list loses them. */
function without(recipe: RoomRecipe, banned: readonly string[]): RoomRecipe {
  return {
    ...recipe,
    arrangements: recipe.arrangements.map((a) => ({
      ...a,
      steps: a.steps.flatMap((st) => {
        const mods = (typeof st.mod === 'string' ? [st.mod] : st.mod).filter((m) => !banned.includes(m));
        if (!mods.length) return [];
        return [{ ...st, mod: mods.length === 1 ? (mods[0] as string) : mods }];
      }),
    })),
  };
}

/** Room recipes for stations (immobile hulls): the ship recipes without the station-banned modules. */
export const STATION_RECIPES: Partial<Record<RoomRole, RoomRecipe>> = Object.fromEntries(
  Object.entries(RECIPES).map(([role, r]) => [role, without(r as RoomRecipe, STATION_BANNED)]),
);

export { pruneDoors } from './doors';
export { planBerths, type BerthStyle } from './plans';
export { planAisles } from './aisles';
export { claimCompanion, withCompanions } from './companions';
export { drawRoom, furnish, keepDoorApproach, reserveWalkway, placeStep, specStep, roomFill, type RoomDraw } from './furnish';
export type { RoomRecipe, Arrangement, Step } from './types';
