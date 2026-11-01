import { writable } from 'svelte/store';

/** The width the open inspector tab asks for (the inspector window grows to it), or null for the window's own width. */
export const inspectorWidth = writable<number | null>(null);
