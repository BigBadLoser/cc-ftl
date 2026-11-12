import type { UiEnemyWeapon } from '../api';

export interface EnemyWeaponRow {
  /** Status word: Destroyed, Stood down, Offline, Aimed 2.4s, Fired, Ready (charged and waiting, as the player's weapon card says), or Charging. */
  status: string;
  /** The row takes the shot's colour: from the commit until its shot has landed or missed. */
  shotColor: boolean;
  /** Destroyed or offline: shown dimmed. */
  dim: boolean;
}

export function enemyWeaponRow(w: Pick<UiEnemyWeapon, 'destroyed' | 'stalled' | 'eta' | 'fired' | 'charge' | 'standDown'>): EnemyWeaponRow {
  let status = 'Charging';
  if (w.destroyed) status = 'Destroyed';
  else if (w.standDown) status = 'Stood down';
  else if (w.stalled) status = 'Offline';
  else if (w.eta !== null) status = `Aimed ${w.eta.toFixed(1)}s`;
  else if (w.fired) status = 'Fired';
  else if (w.charge >= 1) status = 'Ready';
  return { status, shotColor: w.eta !== null || w.fired, dim: w.stalled || w.destroyed || w.standDown };
}
