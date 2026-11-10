/** A save of this version written before #416 (no suit limit) still loads: the retired suit fields are dropped as it is read. */
import { describe, expect, it } from 'vitest';
import { AirlockC, JobC, VehicleC, deserialize, newGame, serialize } from '../sim';
import { content } from './index';

describe('retired save fields (#416)', () => {
  it('drops airlock and vehicle suit counts and the airless passage seat, then plays on', () => {
    const sim = newGame(3, content);
    const data = JSON.parse(serialize(sim)) as { world: { stores: Record<string, [number, Record<string, unknown>][]> } };
    const { stores } = data.world;
    expect(stores.airlock?.length).toBeGreaterThan(0);
    expect(stores.vehicle?.length).toBeGreaterThan(0);
    for (const [, a] of stores.airlock!) a.suits = 2;
    for (const [, v] of stores.vehicle!) v.suits = 1;
    stores.job = [...(stores.job ?? []), [999_999, { category: 'patrol', kind: 'passage', x: 0, y: 0, struct: 0, work: 1, progress: 0, reservedBy: 0, airless: true }]];
    const loaded = deserialize(JSON.stringify(data), content);
    for (const id of loaded.world.query(AirlockC)) expect(loaded.world.get(id, AirlockC)).not.toHaveProperty('suits');
    for (const id of loaded.world.query(VehicleC)) expect(loaded.world.get(id, VehicleC)).not.toHaveProperty('suits');
    expect(loaded.world.get(999_999, JobC)).toMatchObject({ kind: 'passage' });
    expect(loaded.world.get(999_999, JobC)).not.toHaveProperty('airless');
    expect(serialize(loaded)).not.toMatch(/"suits"|"airless"/);
    for (let i = 0; i < 40; i++) loaded.step();
  });
});
