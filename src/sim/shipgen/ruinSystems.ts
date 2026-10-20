import { rotatedSize } from '../modules/footprint';
import { at, modTiles, moduleMap } from './ruinGrid';
import type { ModuleRuin, RuinCtx, RuinModule } from './ruinTypes';

/**
 * Systems: every surviving module is intact, damaged or destroyed. Combat wrecks are wrecked around the impacts and
 * lightly elsewhere; old derelicts wear down everywhere. Damaged modules can be repaired, destroyed ones stripped for
 * parts (some are slag). Power is off, or on emergency when a reactor survived a recent fight. Doors jam open or shut.
 */
export function systemsStage(c: RuinCtx): void {
  const combat = c.meta.cause === 'combat';
  c.modules.forEach((m, index) => {
    const def = c.defs[m.def];
    if (!def) return;
    const tiles = modTiles(c, index);
    const near = Math.min(...c.meta.impacts.map((p) => Math.min(...tiles.map((t) => Math.hypot(t.x - p.x, t.y - p.y) - p.r))), 99);
    let pDestroy: number, pDamage: number;
    if (combat) {
      const hot = near <= 1 ? 0.85 : near <= 3 ? 0.45 : 0;
      pDestroy = Math.min(0.95, hot * (0.5 + c.intensity) + 0.08 * c.intensity);
      pDamage = 0.25 + 0.5 * c.intensity;
    } else {
      pDestroy = 0.05 + 0.3 * c.intensity + (near <= 1 ? 0.2 : 0);
      pDamage = 0.35 + 0.5 * c.intensity;
    }
    const roll = c.rng.next();
    const state: ModuleRuin = roll < pDestroy ? 'destroyed' : roll < pDestroy + (1 - pDestroy) * pDamage ? 'damaged' : 'intact';
    const hp = state === 'destroyed' ? 0 : state === 'damaged' ? round2(0.15 + c.rng.next() * 0.6) : round2(0.8 + c.rng.next() * 0.2);
    const rec: RuinModule = {
      index, def: m.def, state, hp,
      salvage: state === 'damaged' ? 'repair' : state === 'destroyed' ? (c.rng.chance(0.6) ? 'strip' : 'none') : 'none',
    };
    const [w, h] = rotatedSize(def, m.rot);
    if (state === 'destroyed' && m.def !== 'module.light') rec.art = `decay.burnt.${Math.min(2, w)}x${Math.min(2, h)}`;
    if (m.def === 'module.fabricator' || m.def === 'module.robotFabricator') {
      if (state !== 'destroyed') rec.art = m.rot ? `module.fabricator.r${m.rot}.dormant` : 'module.fabricator.dormant';
    }
    c.meta.modules.push(rec);
  });
  const reactorAlive = c.meta.modules.some((r) => (c.defs[r.def]?.power ?? 0) > 0 && r.state !== 'destroyed');
  c.meta.power = reactorAlive && c.rng.chance(combat ? 0.65 : 0.12) ? 'emergency' : 'off';
  for (const r of c.meta.modules) {
    if (r.def !== 'module.light') continue;
    if (r.state === 'destroyed') r.art = 'module.light.broken';
    else if (c.meta.power === 'off') r.art = 'module.light.off';
    else if (r.state === 'damaged') { r.art = 'module.light.off'; r.flicker = true; }
  }
  doors(c);
}

function doors(c: RuinCtx): void {
  const mods = moduleMap(c);
  const combat = c.meta.cause === 'combat';
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (at(c, x, y) !== 'D' || (mods[y * c.width + x] as number) >= 0) continue; // airlock doors belong to the airlock
      // Blast-warped doors near an impact jam open; elsewhere doors closed on the breach alarm, and some never reopened.
      const hot = c.meta.impacts.some((p) => Math.hypot(x - p.x, y - p.y) < p.r + 2);
      const roll = c.rng.next();
      const open = hot && combat ? 0.5 : 0.03 + 0.12 * c.intensity;
      const shut = 0.15 + 0.25 * c.intensity;
      c.meta.doors.push({ x, y, state: roll < open ? 'stuckOpen' : roll < open + shut ? 'stuckShut' : 'free' });
    }
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
