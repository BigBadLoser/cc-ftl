/** Counts of a loaded save (tools only): entities per component store, jobs by kind. */
import { content } from '../../src/content';
import { deserialize } from '../../src/sim';
import { JobC } from '../../src/sim/crew/components';

export function dumpSave(json: string): Record<string, unknown> {
  const sim = deserialize(json, content);
  const stores: Record<string, number> = {};
  const w = sim.world.serialize();
  for (const [k, v] of Object.entries(w.stores)) stores[k] = v.length;
  const jobs: Record<string, { open: number; reserved: number }> = {};
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC)!;
    const e = (jobs[j.kind] ??= { open: 0, reserved: 0 });
    if (j.reservedBy) e.reserved++; else e.open++;
  }
  return { tick: sim.tick, alive: w.alive.length, stores, jobs };
}
