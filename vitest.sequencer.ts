import { BaseSequencer, type TestSpecification } from 'vitest/node';
import weights from './tools/testWeights.ts';

/**
 * Longest files first, and shards balanced by time.
 *
 * Wall time of a parallel run is set by how late the long files start, so the heavy ones go first. `tools/testWeights.ts`
 * holds seconds per test file from a past full run (`npm run test:weights` rewrites it); a file it does not list counts as
 * DEFAULT. A stale weight only makes the order a little worse, never wrong.
 *
 * `--shard=i/N` deals the files out largest first to the lightest shard, so the shards finish together. The default
 * sequencer hashes paths, which can pile the heavy files into one shard. Every shard job computes the same split.
 */
const DEFAULT = 2;

export default class WeightedSequencer extends BaseSequencer {
  private weight(spec: TestSpecification): number {
    return (weights as Record<string, number>)[spec.moduleId.slice(this.ctx.config.root.length + 1)] ?? DEFAULT;
  }

  private ordered(files: TestSpecification[]): TestSpecification[] {
    return [...files].sort((a, b) => this.weight(b) - this.weight(a) || (a.moduleId < b.moduleId ? -1 : 1));
  }

  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return this.ordered(files);
  }

  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (!shard) return files;
    const load = Array.from({ length: shard.count }, () => 0);
    const mine: TestSpecification[] = [];
    for (const f of this.ordered(files)) {
      const lightest = load.indexOf(Math.min(...load));
      load[lightest] = (load[lightest] as number) + this.weight(f);
      if (lightest === shard.index - 1) mine.push(f);
    }
    return mine;
  }
}
