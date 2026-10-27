import type { GalaxyFactionDef } from './defs';
import { inDanger } from './defs';
import { unit } from './hash';
import { DANGER_MAX, DANGER_STEP, TERRITORY_CELL, TERRITORY_REACH, TERRITORY_REACH_BOOST, TERRITORY_SCALE } from './tuning';

const CELL = TERRITORY_CELL * TERRITORY_SCALE;

/** Weight of a territory seed claiming no faction (open space between the powers). */
const OPEN_SPACE_WEIGHT = 1.2;

/** Danger tier at a map position: rises with distance from the start (0, 0). */
export function dangerAt(x: number, y: number): number {
  return Math.min(DANGER_MAX, Math.floor(Math.hypot(x, y) / DANGER_STEP));
}

interface TerritorySeed {
  x: number;
  y: number;
  faction: string | null;
  reach: number;
}

/**
 * Faction space as a deterministic field: one seed per TERRITORY_CELL x TERRITORY_SCALE cell (jittered, faction drawn by territory weight
 * at the seed's danger tier, or open space), and a point belongs to the seed nearest relative to its reach. The start
 * cell's seed sits at (0, 0) and belongs to the `home` faction. Pure in (seed, cell), so chunks agree at the seams.
 */
export class TerritoryField {
  private seeds = new Map<string, TerritorySeed>();

  constructor(
    readonly seed: number,
    private readonly factions: Readonly<Record<string, GalaxyFactionDef>>,
  ) {}

  private seedAt(tx: number, ty: number): TerritorySeed {
    const key = `${tx},${ty}`;
    let s = this.seeds.get(key);
    if (!s) {
      const home = tx === 0 && ty === 0;
      const x = home ? 0 : (tx - 0.5 + unit(this.seed, tx, ty, 11)) * CELL;
      const y = home ? 0 : (ty - 0.5 + unit(this.seed, tx, ty, 12)) * CELL;
      const danger = dangerAt(x, y);
      const faction = home ? Object.keys(this.factions).find((id) => this.factions[id]?.home) ?? null : this.draw(tx, ty, danger);
      const base = faction ? this.factions[faction]?.territory?.reach ?? TERRITORY_REACH : TERRITORY_REACH;
      s = { x, y, faction, reach: TERRITORY_SCALE * TERRITORY_REACH_BOOST * base * (0.8 + 0.4 * unit(this.seed, tx, ty, 14)) };
      this.seeds.set(key, s);
    }
    return s;
  }

  /**
   * The faction a (non-home) seed claims, in stages so that adding the pirate factions never moves the other powers' map:
   * 1. the first draw, from the factions that claim seeds outright (not `shares` or `near` ones), or open space;
   * 2. a seed won by a faction that others `share` is re-drawn among it and them (the pirate space is shared out among the pirate factions);
   * 3. a seed that is open space or a pirate's, beside a seed whose first draw is a `near` faction's (the machines'), becomes the `near` faction's (the
   *    zealots') with chance `territory.weight`.
   */
  private draw(tx: number, ty: number, danger: number): string | null {
    const first = this.first(tx, ty, danger);
    let faction = first;
    if (first !== null) {
      const sharing = Object.entries(this.factions).filter(([id, f]) => f.territory?.shares === first && f.territory.weight > 0 && inDanger(f.territory.danger, danger) && id !== first);
      if (sharing.length) {
        const pool = [{ id: first, weight: this.factions[first]?.territory?.weight ?? 1 }, ...sharing.map(([id, f]) => ({ id, weight: f.territory!.weight }))];
        let roll = unit(this.seed, tx, ty, 15) * pool.reduce((t, p) => t + p.weight, 0);
        faction = (pool.find((p) => (roll -= p.weight) < 0) ?? pool[pool.length - 1])?.id ?? first;
      }
    }
    if (faction !== null && this.factions[faction]?.kind !== 'pirates') return faction;
    for (const [id, f] of Object.entries(this.factions)) {
      const near = f.territory?.near;
      if (near && inDanger(f.territory?.danger, danger) && unit(this.seed, tx, ty, 16) < f.territory!.weight && this.beside(tx, ty, near)) return id;
    }
    return faction;
  }

  /** The first draw: factions that claim seeds outright, by weight at the seed's danger tier, or open space. */
  private first(tx: number, ty: number, danger: number): string | null {
    const pool: { id: string | null; weight: number }[] = [{ id: null, weight: OPEN_SPACE_WEIGHT }];
    for (const [id, f] of Object.entries(this.factions)) {
      if (!f.territory || f.territory.weight <= 0 || f.territory.near || f.territory.shares || !inDanger(f.territory.danger, danger)) continue;
      pool.push({ id, weight: f.territory.weight });
    }
    let roll = unit(this.seed, tx, ty, 13) * pool.reduce((t, p) => t + p.weight, 0);
    return (pool.find((p) => (roll -= p.weight) < 0) ?? pool[pool.length - 1])?.id ?? null;
  }

  /** Does a neighbouring cell's first draw claim its seed for `faction`? */
  private beside(tx: number, ty: number, faction: string): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx === 0 && ny === 0) continue; // the home seed is never the machines'
        const x = (nx - 0.5 + unit(this.seed, nx, ny, 11)) * CELL;
        const y = (ny - 0.5 + unit(this.seed, nx, ny, 12)) * CELL;
        if (this.first(nx, ny, dangerAt(x, y)) === faction) return true;
      }
    }
    return false;
  }

  /** The faction whose space holds (x, y), or null for open space. */
  factionAt(x: number, y: number): string | null {
    const tx = Math.floor(x / CELL + 0.5);
    const ty = Math.floor(y / CELL + 0.5);
    let best: TerritorySeed | null = null;
    let bestScore = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const s = this.seedAt(tx + dx, ty + dy);
        const score = Math.hypot(s.x - x, s.y - y) / s.reach;
        if (score < bestScore) {
          bestScore = score;
          best = s;
        }
      }
    }
    return best && bestScore < 1 ? best.faction : null;
  }
}
