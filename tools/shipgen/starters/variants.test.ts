import { describe, expect, it } from 'vitest';
import { homeShip, hullLoad, newGame } from '../../../src/sim';
import { validateTemplate } from '../../../src/sim/shipgen';
import { SHIPS, count, mods, withShip } from './kits';

/**
 * Every hand-drawn starter variant (tools/shipgen/starters/*.ts) stays playable by the starter ships' rules
 * (src/content/ships/starterShips.test.ts): a valid template with its ship's kit, beds, a galley, one helm, two life
 * supports and an airlock, and a hull its engines can carry. The minute-long run is in variants.slow.test.ts.
 */
for (const { ship, variants, kit } of SHIPS) {
  describe.each(variants)(`${ship} variant $name`, (v) => {
    it('is a valid template with the ship\'s kit, a bed per crew member, a galley, one helm and two life supports', () => {
      const t = v.template;
      expect(validateTemplate(t, mods)).toEqual([]);
      kit(t);
      expect(count(t, (d, id) => !!d.bed && id !== 'module.med_bed')).toBeGreaterThanOrEqual(t.crew!.length);
      expect(count(t, (d) => !!d.galley)).toBeGreaterThanOrEqual(1);
      expect(count(t, (d) => d.console === 'helm')).toBe(1);
      expect(count(t, (d) => (d.o2PerSec ?? 0) > 0)).toBeGreaterThanOrEqual(2);
      expect(count(t, (d) => !!d.airlock)).toBeGreaterThanOrEqual(1);
    });

    it('fits its engines', () => {
      const sim = newGame(1, withShip(v.template), 'ship.variant');
      const load = hullLoad(sim, homeShip(sim));
      expect(load.ratio, `${load.tiles} tiles on ${load.capacity}`).toBeLessThan(0.85);
    });
  });
}
