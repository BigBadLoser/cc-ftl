/** True when the key event's target is somewhere the player types (a text field, a select, a contenteditable): global hotkeys must leave it alone. */
export function isTypingTarget(e: { target: EventTarget | null }): boolean {
  const t = e.target;
  if (!t || typeof (t as HTMLElement).tagName !== 'string') return false;
  const el = t as HTMLElement;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  if (el.isContentEditable) return true;
  const ce = el.getAttribute?.('contenteditable');
  if (ce !== null && ce !== undefined && ce !== 'false') return true;
  return el.getAttribute?.('role') === 'textbox';
}

/**
 * The one modal gate: open modals (the Esc menu, the jump confirmation and the like) hold it, and while any is open every game key handler
 * (App, the combat strip, camera keys in app/input.ts, lessons, the deploy picker, the profiler key) stands aside so the modal's own controls
 * get their keys.
 */
let modals = 0;
export const modalOpen = (): boolean => modals > 0;
/** Mark a modal open; call the returned function once when it closes. */
export function holdModal(): () => void {
  modals++;
  let done = false;
  return () => {
    if (!done) modals--;
    done = true;
  };
}
