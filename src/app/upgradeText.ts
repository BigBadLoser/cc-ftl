import type { UpgradeDef } from '../sim';

/** The player-facing lines of an upgrade's effects ("-30% heat per volley"), read off its mods so the text cannot drift from the numbers. */
export function upgradeEffects(up: UpgradeDef): string[] {
  const m = up.mods;
  const pct = (mul: number): string => `${mul < 1 ? '-' : '+'}${Math.round(Math.abs(1 - mul) * 100)}%`;
  if (up.blurb) return [up.blurb];
  const out: string[] = [];
  if (m.heatMul !== undefined) out.push(`${pct(m.heatMul)} heat per volley`);
  if (m.chargeMul !== undefined) out.push(`${pct(m.chargeMul)} charge time`);
  if (m.damageTakenMul !== undefined) out.push(m.damageTakenMul === 0.5 ? 'Half damage from hits and ion' : `${pct(m.damageTakenMul)} damage taken from hits and ion`);
  return out;
}
