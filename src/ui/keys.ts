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
