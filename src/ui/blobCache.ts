/**
 * A small cache of object URLs (the starmap's baked nebula images) that owns their disposal: it keeps the last `max`
 * entries, and revokes a URL exactly once when it is replaced or evicted, never while it is the one on screen (`show`).
 * Such a URL is revoked when something else is shown (or `show(null)` on close) and it is no longer cached.
 */
export interface BlobCache {
  get(key: string): string | null;
  /** Cache `url` under `key`, replacing and evicting older entries. */
  put(key: string, url: string): void;
  /** Mark the URL on screen (null: none). The one shown before is revoked if it has already left the cache. */
  show(url: string | null): void;
}

export function createBlobCache(revoke: (url: string) => void, max = 2): BlobCache {
  let entries: { key: string; url: string }[] = [];
  let shown: string | null = null;
  const gone = new Set<string>();
  const dispose = (url: string) => {
    if (gone.has(url)) return;
    gone.add(url);
    revoke(url);
  };
  /** Revoke a URL that left the cache, unless it is still displayed or another entry holds it. */
  const release = (url: string) => {
    if (url !== shown && !entries.some((e) => e.url === url)) dispose(url);
  };
  return {
    get: (key) => entries.find((e) => e.key === key)?.url ?? null,
    put(key, url) {
      const out = entries.filter((e) => e.key === key && e.url !== url);
      entries = [...entries.filter((e) => e.key !== key), { key, url }];
      while (entries.length > max) out.push(entries.shift()!);
      for (const e of out) release(e.url);
    },
    show(url) {
      const prev = shown;
      shown = url;
      if (prev && prev !== url) release(prev);
    },
  };
}
