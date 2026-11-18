import type { RoomRole } from '../types';
import { bridge } from './bridge';
import { engineering } from './engineering';
import { mess } from './mess';
import { quarters } from './quarters';
import { storage } from './storage';
import { armoury, drill, farm, garden, industry, plaza } from './station';
import { dock, hangar, shields } from './systems';
import type { RoomRecipe } from './types';

/**
 * Ship room recipes by role. Halls, AI cores and gun rooms have none (a gun room holds its guns only). Mount rooms keep the generic placer for their mounts. Ships
 * only: stations are furnished by rule alone (rooms/rules).
 */
export const RECIPES: Partial<Record<RoomRole, RoomRecipe>> = {
  bridge, quarters, cargo: storage, support: mess, reactor: engineering, shields, dock, hangar, farm, industry, armoury, plaza, garden, drill,
};

export { pruneDoors } from './doors';
export { drawRoom, furnish, hostCompanions, reserveWalkway, placeStep, specStep, roomFill, type RoomDraw } from './furnish';
export type { RoomRecipe, Arrangement, Step } from './types';
