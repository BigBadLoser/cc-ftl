import type { UiFtl } from './api';

/** Why the drive cannot be charged, in plain words. */
export const FTL_BLOCKERS: Record<NonNullable<UiFtl['blocker']>, string> = {
  noShip: 'No ship to jump.',
  notActive: 'The ship is not under your control right now.',
  noHelm: 'The ship has no helm. Build one.',
  helmOffline: 'The helm has no power (or is broken or disabled).',
  noEngines: 'No powered engine: the drive cannot charge.',
  noCrewAboard: 'No crew available to sit at the helm.',
};

/** The one-line live state of the drive: Idle, Waiting for crew, Pilot heading to helm, Charging x/40 s, Ready. */
export function ftlState(f: UiFtl): string {
  if (f.state === 'ready') return 'Ready';
  if (f.state === 'charging') return `Charging ${Math.floor(f.charge)}/${f.max} s`;
  if (f.state === 'heading') return f.pilot ? `${f.pilot} heading to the helm` : 'Pilot heading to helm';
  if (f.state === 'waiting') return f.blocker ? 'Waiting: ' + FTL_BLOCKERS[f.blocker] : 'Waiting for a free crew member';
  return `Idle ${Math.floor(f.charge)}/${f.max} s`;
}
