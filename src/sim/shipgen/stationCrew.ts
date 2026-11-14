import type { StationDef, StationSize } from './stationTypes';

/**
 * How many crew a station has, from the posts its rooms need (the user: the tier numbers "seem sort of arbitrary, crew
 * numbers seem inflated"). Every post is a job a room or a machine makes; security is the kind's share on top.
 */

/** The airlock docks an assembled station of this kind has at a size: its own count where the kind gives one, two at least. */
export const docksOf = (def: StationDef, size: StationSize): number => Math.max(2, def.assemblyDocks?.[size] ?? def.tiers[size].docks);

export interface CrewPosts {
  command: number;
  engineers: number;
  gunners: number;
  dockhands: number;
  pilots: number;
  workers: number;
  medics: number;
  security: number;
}

const SIZE = { outpost: 0, station: 1, hub: 2 } as const;

export function crewPosts(def: StationDef, size: StationSize): CrewPosts {
  const t = def.tiers[size], k = SIZE[size];
  const kindRooms = [...(def.assemblyRooms ?? def.rooms), ...(def.assemblyAlso ?? [])];
  const count = (pred: (r: (typeof kindRooms)[number]) => boolean): number => kindRooms.filter(pred).reduce((n, r) => n + r.count[size], 0);
  // A worker for each lab, refinery, breaker or farm, and for each workshop; one for every two market stalls.
  const work = count((r) => (r.role === 'industry' || r.role === 'farm') && r.dept !== 'defence');
  const stalls = count((r) => r.dept === 'market');
  const workshops = size === 'hub' ? 2 : 1;
  const posts = {
    command: k + 1,
    // The shield generators and, from station size, the battery room: one engineer for every two, one at least.
    engineers: 1 + Math.floor((t.shields + (k > 0 ? 1 : 0)) / 2),
    gunners: Math.ceil(t.guns / 4),
    dockhands: Math.ceil(docksOf(def, size) / 2),
    // A pilot for each shuttle bay (one at least), one for every two mining pods.
    pilots: Math.max(1, t.bays ?? 0) + Math.ceil((t.pods ?? 0) / 2),
    workers: work + workshops + Math.ceil(stalls / 2),
    medics: k,
  };
  const base = Object.values(posts).reduce((n, v) => n + v, 0);
  // Security on top, so that they are the kind's share of the whole crew.
  const security = Math.max(1, Math.round((base * def.security) / (1 - def.security)));
  return { ...posts, security };
}

export const crewSize = (def: StationDef, size: StationSize): number => Object.values(crewPosts(def, size)).reduce((n, v) => n + v, 0);
