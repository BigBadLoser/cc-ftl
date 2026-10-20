import type { RoomRole } from '../types';
import { bridge } from './bridge';
import { quarters } from './quarters';
import { storage } from './storage';
import type { RoomRecipe } from './types';

/** Room recipes by role. Roles without one keep the generic placer (weapons, shields, engines: their mount rules). */
export const RECIPES: Partial<Record<RoomRole, RoomRecipe>> = { bridge, quarters, cargo: storage };

export { drawRoom, furnish, placeStep, specStep, roomFill, type RoomDraw } from './furnish';
export type { RoomRecipe, Arrangement, Step } from './types';
