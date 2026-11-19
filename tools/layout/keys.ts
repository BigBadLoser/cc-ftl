/**
 * The layout lab's keyboard. Letters pick tools; the rest act on the active tool (listed in SHORTCUTS, which the palette's tooltips and
 * the catalog follow). Keys typed into a field are left to it.
 */
import { panned, zoomed } from './camera';
import { dpr, lab, type Tool } from './lab.svelte';
import { move } from './move.svelte';
import { paletteModules, roomTypes, stepIn } from './palette';

export const TOOL_KEYS: Record<string, Tool> = { v: 'select', s: 'move', f: 'floor', w: 'wall', d: 'door', x: 'window', b: 'beam', e: 'space', g: 'room', m: 'module', n: 'note' };
const ARROWS: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

/** Every shortcut, for help text: [keys, what they do]. */
export const SHORTCUTS: readonly [string, string][] = [
  ['V S F W D X B E G M N', 'tools: select, move, floor, wall, door, window, beam, erase, room, module, pin'],
  ['R / Shift+R', 'turn the module ghost, the selected module or the Move piece; back'],
  ['H / Shift+H', 'Move: mirror the piece left-right; top-bottom'],
  ['Arrows (Shift: 5)', 'Move: nudge the box; Select: nudge the selected module; otherwise pan'],
  ['[ / ]', 'previous / next: module (Module), room type (Room), window size (Window)'],
  ['Enter', 'place a pasted piece at the pointer'],
  ['Ctrl+C / X / V', 'copy, cut, paste the Move box'],
  ['Ctrl+Shift+C', 'save the Move box as a shape (Shapes panel)'],
  ['Delete', 'clear the Move box, else delete the selection'],
  ['Esc', 'put back a piece in flight, drop the box, else back to Select'],
  ['+ / - / 0', 'zoom in, out, fit'],
  ['C', 'compare with the generated design'],
  ['Ctrl+Z / Ctrl+Y', 'undo, redo'],
];

/** [ and ]: step the active tool's option. */
function stepOption(step: 1 | -1): void {
  if (lab.tool === 'window') lab.windowSize = Math.max(2, Math.min(4, lab.windowSize + step));
  else if (lab.tool === 'room') lab.role = stepIn(roomTypes.map((r) => r.role), lab.role, step) ?? lab.role;
  else if (lab.tool === 'module') {
    const next = stepIn(paletteModules.map((m) => m.id), lab.armed, step);
    if (next) { lab.arm(next); const g = lab.ghost; if (g) lab.aim(next, g.x, g.y); }
  }
}

export function onKey(e: KeyboardEvent): void {
  if ((e.target as HTMLElement | null)?.closest('input, textarea, [role=combobox]')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  const done = (): void => e.preventDefault();
  if (mod && k === 'z') { done(); if (e.shiftKey) lab.redo(); else lab.undo(); return; }
  if (mod && k === 'y') { done(); lab.redo(); return; }
  if (mod && e.shiftKey && k === 'c') { done(); move.saveShape(); return; }
  if (mod && !lab.compare && (k === 'c' || k === 'x' || k === 'v')) { done(); if (k === 'c') move.copy(); else if (k === 'x') move.cut(); else move.paste(); return; }
  if (mod || e.altKey) return;
  if (k === 'c') { lab.toggleCompare(); return; }
  if (k === '0') { lab.fit(); return; }
  if (k === '+' || k === '=' || k === '-') { const b = lab.gridBox; lab.view = zoomed('grid', lab.view, dpr(), b, b.w / 2, b.h / 2, k === '-' ? -1 : 1); return; }
  const arrow = ARROWS[k];
  if (lab.compare) {
    if (arrow) { done(); lab.view = panned('grid', lab.view, dpr(), -arrow[0] * 60, -arrow[1] * 60); }
    else if (k === 'escape') lab.setTool('select');
    return;
  }
  if (arrow) {
    done();
    const n = e.shiftKey ? 5 : 1;
    if (lab.tool === 'move' && move.box && !move.float) move.nudge(arrow[0] * n, arrow[1] * n);
    else if (!(lab.tool === 'select' && lab.nudgeSelected(arrow[0] * n, arrow[1] * n))) lab.view = panned('grid', lab.view, dpr(), -arrow[0] * 60 * n, -arrow[1] * 60 * n);
    return;
  }
  if (k === 'r') { if (lab.tool === 'move') move.turn(e.shiftKey ? 'ccw' : 'cw'); else lab.rotate(e.shiftKey ? -1 : 1); return; }
  if (k === 'h') { if (lab.tool === 'move') move.turn(e.shiftKey ? 'mirror-y' : 'mirror-x'); return; }
  if (k === '[' || k === ']') { stepOption(k === ']' ? 1 : -1); return; }
  if (k === 'enter') { if (move.float) { done(); move.drop(); } return; }
  if (k === 'delete' || k === 'backspace') { if (lab.tool === 'move') move.clear(); else lab.removeSelected(); return; }
  if (k === 'escape') {
    if (move.float) move.cancelFloat();
    else if (move.box) move.reset();
    else { lab.setTool('select'); lab.armed = null; lab.ghost = null; }
    return;
  }
  const tool = TOOL_KEYS[k];
  if (tool && !e.shiftKey) lab.setTool(tool);
}
