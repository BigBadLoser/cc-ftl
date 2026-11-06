import { mount } from 'svelte';
import '../../src/ui/theme.css';
import KitLab from './KitLab.svelte';

/** The kit lab panel (`?panel=kit`): every shared Chip tone and size and every Meter tone and height, as DOM. */
export function mountKitLab(target: HTMLElement): void {
  for (const e of [document.documentElement, document.body]) { e.style.height = 'auto'; e.style.overflow = 'visible'; e.style.position = 'static'; }
  mount(KitLab, { target });
}
