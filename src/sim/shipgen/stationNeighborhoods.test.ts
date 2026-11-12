import { describe, expect, it } from 'vitest';
import { planNeighborhoodEnvelopes } from './stationNeighborhoods';
import { generateStation } from './stationGen';
import { architectureOfGenerated } from './stationArchitecturePlan';
import { sourceModuleDeficits } from './stationStructuralIntegration';
import { content } from '../../content';
import type { RoomSpec } from './plan';

const sampleProgram: RoomSpec[] = [
  { role: 'cargo', mods: ['module.storage'], w: 17, h: 10, dept: 'freight' },
  { role: 'cargo', mods: ['module.storage'], w: 17, h: 10, dept: 'freight' },
  { role: 'quarters', mods: ['module.bed', 'module.bed'], w: 6, h: 5, dept: 'habitation' },
  { role: 'quarters', mods: ['module.bed'], w: 3, h: 4, dept: 'habitation' },
  { role: 'shop', mods: ['module.shop'], w: 5, h: 6, dept: 'commons' },
];

describe('program-sized inhabited-wheel neighborhoods', () => {
  it('allocates all exact source requirements to department envelopes without slicing individual rooms', () => {
    const bays = planNeighborhoodEnvelopes(sampleProgram, [[0, Math.PI], [Math.PI, 2 * Math.PI]], 34, 9);
    const placed = bays.flatMap((b) => b.requirements);
    expect(placed).toHaveLength(sampleProgram.length);
    for (const original of sampleProgram) {
      expect(placed.filter((r) => r === original)).toHaveLength(1);
    }
    expect(bays.reduce((n, b) => n + b.requiredArea, 0)).toBe(sampleProgram.reduce((n, r) => n + r.w * r.h, 0));
    expect(bays.every((b) => b.requirements.every((r) => r.dept === b.department))).toBe(true);
    expect(bays.every((b) => b.arc[1] > b.arc[0] && b.depth >= 7)).toBe(true);
  });

  it('uses a genuinely different wheel layout, furnishes through native code, and preserves required modules', () => {
    const station = content.stations['station.trading'];
    const legacy = generateStation(station, 'station.trading', 'station', 1, content.modules, true, 'off');
    const redesigned = generateStation(station, 'station.trading', 'station', 1, content.modules, true, 'neighborhood');
    // Do not let a successful non-wheel fallback masquerade as a working replacement.
    expect(redesigned.topology.includes('stationWheel')).toBe(true);
    expect(redesigned.topology.includes('neighborhoods')).toBe(true);
    expect(redesigned.problems).toHaveLength(0);
    expect(redesigned.template.rows).not.toEqual(legacy.template.rows);
    expect(sourceModuleDeficits(redesigned.architecture?.sourceRequirements ?? [], redesigned.template.modules ?? [])).toHaveLength(0);
    const report = architectureOfGenerated(redesigned).audit();
    expect(report.wallSlabs < architectureOfGenerated(legacy).audit().wallSlabs).toBe(true);
  });
});
