/** Minimal observable value that satisfies Svelte's store contract (subscribe/set) without importing svelte. */
export interface Readable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export interface Writable<T> extends Readable<T> {
  get(): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
}

export function createStore<T>(initial: T): Writable<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(v) {
      value = v;
      for (const run of [...subs]) run(v);
    },
    update(fn) {
      this.set(fn(value));
    },
    subscribe(run) {
      subs.add(run);
      run(value);
      return () => {
        subs.delete(run);
      };
    },
  };
}
