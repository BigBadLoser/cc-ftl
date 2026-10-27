import { writable } from 'svelte/store';

/** The right edge (px, plus a gap) of the combat panel while it sits docked on the left, else 0. Floating windows' default spots keep right of it. */
export const combatRight = writable(0);
