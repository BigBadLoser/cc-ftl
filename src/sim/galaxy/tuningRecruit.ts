/**
 * Crew for hire (recruit.ts): trade stations post candidates, a pure function of (seed, port, RECRUIT_TURNS window, slot), so nothing is saved but the keys
 * already hired (`GalaxyState.recruitLog`). Up to RECRUIT_SLOTS candidates per port, each a role from RECRUIT_ROLES. Crew skills come from their role, so the
 * hire cost scales with how much the role is worth: RECRUIT_BASE + RECRUIT_PER_WORTH x the role's worth + 0..RECRUIT_JITTER (150 to 400 credits).
 */
export const RECRUIT_TURNS = 20;
export const RECRUIT_SLOTS = 3;
export const RECRUIT_BASE = 150;
export const RECRUIT_PER_WORTH = 40;
export const RECRUIT_JITTER = 40;
export const RECRUIT_LOG_MAX = 60;
/** Roles for hire and what each is worth (about the sum of its skill levels; a medic counts as 3). */
export const RECRUIT_ROLES: readonly { role: string; worth: number }[] = [
  { role: 'role.engineer', worth: 5 }, { role: 'role.gunner', worth: 3 }, { role: 'role.medic', worth: 3 },
  { role: 'role.security', worth: 4 }, { role: 'role.pilot', worth: 3 },
];
