// #248: a gunner fetching a weapon must not park on a doorway (the Dart magazine door moved one tile, diagonal to the crate).
import { expect, it } from 'vitest';
import { CrewC, PositionC, homeShip, newGame, shipGrid } from '../../sim';
import { content } from '../index';
it('no crew parks on a door tile after the opening equip trips (#248)', () => {
  const t = (content.ships as Record<string, { rows: string[] }>)['ship.lancer']!;
  const orig = t.rows[12]!;
  const r = orig.split(''); r[22] = '#'; r[21] = 'D'; t.rows[12] = r.join('');
  try {
    const sim = newGame(1, content, 'ship.lancer');
    for (let i = 0; i < 400; i++) sim.step();
    const g = shipGrid(sim, homeShip(sim))!;
    const onDoor = sim.world.query(CrewC).filter((id) => { const p = sim.world.get(id, PositionC)!; return g.get('room', p.x, p.y) === 0; });
    expect(onDoor).toEqual([]);
  } finally { t.rows[12] = orig; }
}, 60000);
