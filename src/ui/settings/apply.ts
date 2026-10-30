import type { UiApi } from '../api';
import { settings } from './settings';

/**
 * The settings that act on the page or the game clock, applied live: pause on an urgent alert, pause while the window is in the background
 * (and resume on return, if that paused it), and tooltips off (native `title` tips are parked while the pointer is over them). Returns the
 * disposer. Camera settings are read by app/input.ts, FPS by App.svelte, the start speed by main.ts.
 */
export function applySettings(api: UiApi): () => void {
  let speed: 0 | 1 | 2 | 3 = 0;
  const offs: (() => void)[] = [api.snapshot.subscribe((s) => (speed = s.speed))];

  // Pause on a new urgent alert (the post-fight report is not one).
  let seen: Set<number> | null = null;
  offs.push(api.alerts.subscribe((list) => {
    const fresh = seen !== null && list.some((x) => !seen!.has(x.id) && x.kind !== 'fight.report');
    seen = new Set(list.map((x) => x.id));
    if (fresh && settings.get().pauseOnAlert && speed !== 0) api.setSpeed(0);
  }));

  // Pause in the background; back to that speed on return, unless the player changed it meanwhile.
  let held: 1 | 2 | 3 | null = null;
  const onBlur = () => {
    if (!settings.get().pauseOnBlur || speed === 0) return;
    held = speed;
    api.setSpeed(0);
  };
  const onFocus = () => {
    if (held !== null && speed === 0) api.setSpeed(held);
    held = null;
  };
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  offs.push(() => {
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
  });

  // Tooltips off: move `title` aside on whatever the pointer enters (and its ancestors), put them all back when tips come on again.
  const PARKED = 'data-tip-off';
  const onOver = (e: PointerEvent) => {
    if (settings.get().tooltips) return;
    for (let n = e.target as Element | null; n && n !== document.documentElement; n = n.parentElement) {
      const t = n.getAttribute('title');
      if (t !== null) {
        n.setAttribute(PARKED, t);
        n.removeAttribute('title');
      }
    }
  };
  document.addEventListener('pointerover', onOver, true);
  offs.push(() => document.removeEventListener('pointerover', onOver, true));
  offs.push(settings.subscribe((s) => {
    if (!s.tooltips) return;
    for (const n of document.querySelectorAll(`[${PARKED}]`)) {
      n.setAttribute('title', n.getAttribute(PARKED) ?? '');
      n.removeAttribute(PARKED);
    }
  }));
  return () => offs.forEach((f) => f());
}
