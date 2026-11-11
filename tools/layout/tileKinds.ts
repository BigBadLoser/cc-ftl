/** How one tile changed between two layouts ('.' space, '_' floor, '#' wall, 'D' door, '=' beam): the one rule the compare overlay and the change list share. */
export type Kind =
  | 'floor added' | 'floor removed' | 'wall added' | 'wall removed' | 'floor to wall' | 'wall to floor'
  | 'door added' | 'door removed' | 'beam added' | 'beam removed' | 'beam to floor' | 'beam to wall' | 'floor to beam' | 'wall to beam';

export function kindOf(a: string, b: string): Kind | null {
  if (a === b) return null;
  if (b === 'D') return 'door added';
  if (a === 'D') return 'door removed';
  if (a === '=') return b === '.' ? 'beam removed' : b === '_' ? 'beam to floor' : b === '#' ? 'beam to wall' : null;
  if (b === '=') return a === '.' ? 'beam added' : a === '_' ? 'floor to beam' : a === '#' ? 'wall to beam' : null;
  if (a === '.' && b === '_') return 'floor added';
  if (a === '_' && b === '.') return 'floor removed';
  if (a === '.' && b === '#') return 'wall added';
  if (a === '#' && b === '.') return 'wall removed';
  if (a === '_' && b === '#') return 'floor to wall';
  if (a === '#' && b === '_') return 'wall to floor';
  return null;
}

/** The overlay's three colours: something appeared, something went, or one thing became another. */
export const overlayKind = (k: Kind): 'added' | 'removed' | 'changed' => (k.endsWith(' added') ? 'added' : k.endsWith(' removed') ? 'removed' : 'changed');
