/** Chords: `Shift+` (optional) and a `KeyboardEvent.code`. */

const MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock']);

/** The chord a key press makes, or null for a lone modifier. Ctrl, Alt and Meta are not part of chords (the game leaves those to the browser). */
export function chordOf(e: Pick<KeyboardEvent, 'code' | 'shiftKey'>): string | null {
  if (!e.code || MODIFIERS.has(e.code)) return null;
  return (e.shiftKey ? 'Shift+' : '') + e.code;
}

/** The physical key of a chord, without its Shift. */
export const codeOf = (chord: string): string => chord.replace(/^Shift\+/, '');

const NAMES: Record<string, string> = {
  Space: 'Space', Backquote: '`', Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Enter: 'Enter',
  Tab: 'Tab', Backspace: 'Backspace', Delete: 'Del', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /',
  NumpadEnter: 'Num Enter', PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End', Insert: 'Ins',
};

/** A chord as the player reads it: `KeyQ` → `Q`, `Shift+Digit1` → `Shift+1`, `ArrowUp` → `↑`. */
export function chordLabel(chord: string): string {
  const shift = chord.startsWith('Shift+');
  const code = codeOf(chord);
  const name = NAMES[code] ?? (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : /^Numpad\d$/.test(code) ? `Num ${code.slice(6)}` : code);
  return shift ? `Shift+${name}` : name;
}
