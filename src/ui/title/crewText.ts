import type { UiRollCrew } from './titleApi';

/** The roster label's word: Talented, or Rookie for a crew member rolled below the role (the sim calls it 'green'). */
export const labelText = (l: UiRollCrew['label']): string => (l === 'talented' ? 'Talented' : l === 'green' ? 'Rookie' : '');

/** What the label means, on hover. */
export function labelTip(c: Pick<UiRollCrew, 'label' | 'roleName'>): string {
  const role = c.roleName.toLowerCase();
  return `Rolled ${c.label === 'green' ? 'below' : 'above'} ${/^[aeiou]/.test(role) ? 'an' : 'a'} ${role}'s usual skill`;
}

/** The colour block of a trait kind (the inspector's trait lines). */
export const traitColor = (kind: string): string =>
  kind === 'behaviour' ? 'var(--cyan)' : kind === 'tradeoff' ? 'var(--green)' : kind === 'phobia' || kind === 'habit' ? 'var(--amber)' : '#8b939a';
