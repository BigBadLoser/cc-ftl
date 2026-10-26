import type { UiJob, UiJobs } from './api';

/** One line of the accepted-jobs tracker. */
export interface TrackerRow {
  key: string;
  title: string;
  /** Where it is and how long is left ("Kord Beta · 21 turns left"). */
  fact: string;
  /** What to do or where it stands ("Deliver here", "Target in this node", "3 jumps"), with `warn` when something is wrong. */
  state: string;
  warn: boolean;
}

const turns = (n: number): string => `${n} turn${n === 1 ? '' : 's'} left`;
const far = (j: UiJob): string => (j.hops === null ? 'out of range' : `${j.hops} jump${j.hops === 1 ? '' : 's'}`);

/** The tracker rows for the jobs the player holds, in the order they were taken. */
export function trackerRows(jobs: Pick<UiJobs, 'active'>): TrackerRow[] {
  return jobs.active.map((j) => {
    const missing = j.kind === 'delivery' && !j.ready;
    const state = missing ? 'Crate missing' : j.here ? (j.kind === 'delivery' ? 'Deliver here' : 'Target in this node') : far(j);
    return { key: j.key, title: j.title, fact: `${j.where} · ${turns(j.turnsLeft)}`, state, warn: missing || j.turnsLeft <= 3 };
  });
}
