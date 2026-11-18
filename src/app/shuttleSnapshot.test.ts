import { describe, expect, it } from 'vitest';
import { stampShip } from '../sim/combat/ships';
import { newGame } from '../sim/newGame';
import type { ModuleDef } from '../sim/registry';
import { generateShip } from '../sim/shipgen/generate';
import type { FactionDef } from '../sim/shipgen/types';
import { wreckShip } from '../sim/combat/wreck';
import { content } from '../content';
import { factions } from '../content/factions';
import { buildShuttles } from './shuttleSnapshot';

describe('shuttle snapshot targets', () => {
  it('marks a ship wrecked in play as a derelict even without ruin data', () => {
    const g = generateShip(factions['faction.civilian'] as FactionDef, 'faction.civilian', 3, 1, content.modules as Record<string, ModuleDef>);
    const sim = newGame(1, content);
    const ship = stampShip(sim, g.template, { faction: 'hostile', x: 300, y: 60, state: 'active' });
    expect(buildShuttles(sim).targets.find((t) => t.ship === ship)?.derelict).toBeUndefined();
    wreckShip(sim, ship);
    const d = buildShuttles(sim).targets.find((t) => t.ship === ship)?.derelict;
    expect(d?.cause).toBe('combat');
  });
});
