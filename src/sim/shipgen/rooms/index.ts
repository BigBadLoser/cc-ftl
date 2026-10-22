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

export { pruneDoors } from './doors';
export { drawRoom, furnish, reserveWalkway, placeStep, specStep, roomFill, type RoomDraw } from './furnish';
export type { RoomRecipe, Arrangement, Step } from './types';
