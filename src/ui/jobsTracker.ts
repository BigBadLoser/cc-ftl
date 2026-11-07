import type { UiJob, UiJobs } from './api';

/** One line of the accepted-jobs tracker. */
export interface TrackerRow {
  key: string;
  kind: UiJob['kind'];
  /** The tracker's short title (a delivery's goods left out); `full` is the whole title, for the hover. */
  title: string;
  full: string;
  /** Under the title: for a job in this node what to do ("Deliver here", "Target in this node"), else where it is ("Kord Beta · 2 jumps"), or what is wrong ("Crate missing · 2 jumps"). */
  line: string;
  turnsLeft: number;
  reward: number;
  /** The time is short (at most URGENT_TURNS left): the row gets the amber edge. */
  urgent: boolean;
  /** The line says what is wrong (amber text), not where or what to do. Not urgent by itself: only time is. */
  problem: boolean;
}

/** The tracker split in two: jobs that can be worked in this node now, then the rest, nearest first. */
export interface TrackerGroups {
  here: TrackerRow[];
  away: TrackerRow[];
}

/** Turns left at or under which a job is urgent. */
export const URGENT_TURNS = 3;

const far = (j: UiJob): string => (j.hops === null ? 'out of range' : `${j.hops} jump${j.hops === 1 ? '' : 's'}`);
const todo = (j: UiJob): string => (j.kind === 'delivery' ? 'Deliver here' : j.kind === 'survey' ? 'Survey here' : 'Target in this node');

function row(j: UiJob): TrackerRow {
  const problem = j.kind === 'delivery' && !j.ready;
  const line = problem ? (j.here ? 'Crate missing' : `Crate missing · ${far(j)}`) : j.here ? todo(j) : `${j.where} · ${far(j)}`;
  const title = j.kind === 'delivery' ? 'Deliver a sealed crate' : j.title;
  return { key: j.key, kind: j.kind, title, full: j.title, line, turnsLeft: j.turnsLeft, reward: j.reward, urgent: j.turnsLeft <= URGENT_TURNS, problem };
}

/** The tracker rows for the jobs the player holds: this node's first (in the order taken), then the others by distance (unreachable last). */
export function trackerGroups(jobs: Pick<UiJobs, 'active'>): TrackerGroups {
  const here = jobs.active.filter((j) => j.here).map(row);
  const away = jobs.active
    .filter((j) => !j.here)
    .map((j, i) => ({ j, i }))
    .sort((a, b) => (a.j.hops ?? Infinity) - (b.j.hops ?? Infinity) || a.i - b.i)
    .map(({ j }) => row(j));
  return { here, away };
}
