/** Byte budget with least-recently-used eviction candidates, for decoded sprite sheets. Pure bookkeeping, no textures. */

export interface BudgetEntry {
  bytes: number;
  /** Clock value (ms) of the last time something used the entry. */
  lastUse: number;
  /** Pinned entries count toward the resident total but are never offered for eviction. */
  pinned: boolean;
}

export class ByteBudget {
  readonly entries = new Map<string, BudgetEntry>();
  private total = 0;

  constructor(readonly limit: number) {}

  /** Decoded bytes currently held. */
  get resident(): number {
    return this.total;
  }

  add(key: string, bytes: number, now: number, pinned = false): void {
    this.remove(key);
    this.entries.set(key, { bytes, lastUse: now, pinned });
    this.total += bytes;
  }

  touch(key: string, now: number): void {
    const e = this.entries.get(key);
    if (e && now > e.lastUse) e.lastUse = now;
  }

  remove(key: string): void {
    const e = this.entries.get(key);
    if (!e) return;
    this.total -= e.bytes;
    this.entries.delete(key);
  }

  /**
   * Keys to evict to get back under the limit: unpinned entries last used before `before`, least recently used first,
   * only as many as needed. Empty while under the limit.
   */
  victims(before: number): string[] {
    if (this.total <= this.limit) return [];
    const idle = [...this.entries].filter(([, e]) => !e.pinned && e.lastUse < before).sort((a, b) => a[1].lastUse - b[1].lastUse);
    const out: string[] = [];
    let left = this.total;
    for (const [k, e] of idle) {
      if (left <= this.limit) break;
      out.push(k);
      left -= e.bytes;
    }
    return out;
  }
}
