import type { Attachment } from 'svelte/attachments';

/** A wheel listener that may call preventDefault (Svelte's `onwheel` is passive). */
export const onWheel = (fn: (e: WheelEvent) => void): Attachment<HTMLElement> => (el) => {
  el.addEventListener('wheel', fn, { passive: false });
  return () => el.removeEventListener('wheel', fn);
};
