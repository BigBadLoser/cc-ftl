import { mount } from 'svelte';
import '../../src/ui/theme.css';
import WindowsLab from './WindowsLab.svelte';

/** The windows lab panel (`?panel=windows`): the shared window frame (#336) on each kind of window, as DOM with mock data. */
export function mountWindowsLab(target: HTMLElement): void {
  for (const e of [document.documentElement, document.body]) { e.style.height = 'auto'; e.style.overflow = 'visible'; e.style.position = 'relative'; }
  mount(WindowsLab, { target });
}
