/** One thing the player can click: a short label, whether it works now, its box in CSS pixels of the page and a safe point to click. */
export interface PlayElement {
  label: string;
  kind: string;
  enabled: boolean;
  box: { x: number; y: number; w: number; h: number };
  /** The centre of the box, or another point of it that is not covered. Click here. */
  at: { x: number; y: number };
  /** The control's `data-testid`, when it has one (a stable name across layouts). */
  id?: string;
  /** A switch, checkbox or tab: its state. A text field or select: its value. */
  value?: string | boolean;
}

const SELECTOR = [
  'button', 'a[href]', 'input', 'select', 'textarea', 'summary',
  '[role=button]', '[role=tab]', '[role=menuitem]', '[role=checkbox]', '[role=switch]', '[role=option]', '[role=link]', '[role=radio]', '[role=slider]',
].join(',');
const LABEL_MAX = 48;

const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const round = (v: number) => Math.round(v * 10) / 10;

function labelOf(el: Element): string {
  const named = squash(el.getAttribute('aria-label'));
  if (named) return named.slice(0, LABEL_MAX);
  const by = el.getAttribute('aria-labelledby');
  const ref = by ? squash(el.ownerDocument.getElementById(by.split(' ')[0] ?? '')?.textContent) : '';
  if (ref) return ref.slice(0, LABEL_MAX);
  const text = squash((el as HTMLElement).innerText ?? el.textContent);
  if (text) return text.slice(0, LABEL_MAX);
  const alt = squash(el.querySelector('img[alt]')?.getAttribute('alt'));
  return (alt || squash(el.getAttribute('title')) || squash(el.getAttribute('placeholder')) || squash(el.getAttribute('data-testid')) || '(no label)').slice(0, LABEL_MAX);
}

function visible(el: Element, win: Window): boolean {
  const e = el as HTMLElement;
  if (typeof e.checkVisibility === 'function' && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
  const cs = win.getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none';
}

/** The visible, clickable controls of the page (DOM only; the game canvas is added by the caller). */
export function domElements(doc: Document = document): PlayElement[] {
  const win = doc.defaultView ?? window;
  const vw = win.innerWidth, vh = win.innerHeight;
  const out: PlayElement[] = [];
  for (const el of doc.querySelectorAll(SELECTOR)) {
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
    if (!visible(el, win)) continue;
    // The visible part of the box; a control covered by a modal or another panel is not clickable and left out.
    const x0 = Math.max(r.left, 0), y0 = Math.max(r.top, 0), x1 = Math.min(r.right, vw), y1 = Math.min(r.bottom, vh);
    const probes: [number, number][] = [[(x0 + x1) / 2, (y0 + y1) / 2], [x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x0 + 2, y1 - 2], [x1 - 2, y1 - 2]];
    const hit = probes.find(([px, py]) => {
      const top = doc.elementFromPoint(px, py);
      return !!top && el.contains(top);
    });
    if (!hit) continue;
    const input = el instanceof HTMLInputElement ? el : null;
    const role = el.getAttribute('role');
    const kind = input ? (input.type === 'checkbox' || input.type === 'radio' ? input.type : 'input') : el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement ? 'input' : role ?? (el.tagName === 'A' ? 'link' : 'button');
    const checked = input && (input.type === 'checkbox' || input.type === 'radio') ? input.checked : el.getAttribute('aria-checked') ?? el.getAttribute('aria-selected') ?? el.getAttribute('aria-pressed');
    const text = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement ? el.value : undefined;
    const id = el.getAttribute('data-testid');
    out.push({
      label: labelOf(el), kind,
      enabled: !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true',
      box: { x: round(r.left), y: round(r.top), w: round(r.width), h: round(r.height) },
      at: { x: round(hit[0]), y: round(hit[1]) },
      ...(id ? { id } : {}),
      ...(text !== undefined ? { value: text } : checked !== null && checked !== undefined ? { value: checked === true || checked === 'true' } : {}),
    });
  }
  return out;
}

/** The first heading or label of an open dialog, so a model knows a panel covers the game. */
export function openDialog(doc: Document = document): string | undefined {
  for (const d of doc.querySelectorAll('[role=dialog],[role=alertdialog]')) {
    const r = d.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !visible(d, doc.defaultView ?? window)) continue;
    const name = squash(d.getAttribute('aria-label')) || squash(d.querySelector('h1,h2,h3')?.textContent) || squash((d as HTMLElement).innerText).slice(0, 40);
    return name || 'dialog';
  }
  return undefined;
}
