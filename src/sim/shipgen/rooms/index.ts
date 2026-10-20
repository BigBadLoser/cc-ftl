import type { RoomRole } from '../types';
import { bridge } from './bridge';
import { engineering } from './engineering';
import { mess } from './mess';
import { quarters } from './quarters';
import { storage } from './storage';
import type { RoomRecipe } from './types';

/** Room recipes by role. Roles without one keep the generic placer (weapons, shields, engines: their mount rules). */
export const RECIPES: Partial<Record<RoomRole, RoomRecipe>> = { bridge, quarters, cargo: storage, support: mess, reactor: engineering };

export { pruneDoors } from './doors';
export { drawRoom, furnish, placeStep, specStep, roomFill, type RoomDraw } from './furnish';
export type { RoomRecipe, Arrangement, Step } from './types';
