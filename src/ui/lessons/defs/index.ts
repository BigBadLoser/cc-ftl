import type { LessonDef } from '../types';
import { combatLesson } from './combat';
import { hailLesson } from './hail';

/** Every lesson, in priority order (two triggered together open in this order). Help's index is built from this list too. */
export const LESSONS: readonly LessonDef[] = [combatLesson, hailLesson];
