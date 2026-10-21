/** Typed key for a component store. Create with defineComponent. */
export interface ComponentKey<T> {
  readonly name: string;
  /** Phantom field so T is part of the type; never set at runtime. */
  readonly _type?: T;
}

const NAMES: string[] = [];

/** Declare a component type. Components are plain serializable data; refer to entities by ID. */
export function defineComponent<T>(name: string): ComponentKey<T> {
  if (!NAMES.includes(name)) NAMES.push(name);
  return { name };
}

/** Names of every component declared so far (in declaration order). The packet translation table must cover each. */
export function componentNames(): readonly string[] {
  return NAMES;
}

/** One entity's components by store name (values by reference), as `World.detach` returns and `World.restore` takes. */
export type EntityData = Record<string, unknown>;

/** JSON-able snapshot of a World. */
export interface WorldData {
  nextId: number;
  alive: number[];
  stores: Record<string, [number, unknown][]>;
}

interface Store {
  data: Map<number, unknown>;
  /** Bumped whenever membership changes (add of a new entity, remove). */
  version: number;
}

interface CachedQuery {
  stamp: number;
  result: number[];
}

/**
 * Minimal ECS. Entity IDs are incrementing integers and are never reused.
 * Queries return IDs in ascending order, so iteration is deterministic.
 */
export class World {
  private nextId = 1;
  private alive = new Set<number>();
  private stores = new Map<string, Store>();
  private cache = new Map<string, CachedQuery>();

  /** Create a new entity and return its ID. */
  createEntity(): number {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  /** Destroy an entity, removing it from every store. */
  destroyEntity(id: number): void {
    if (!this.alive.delete(id)) return;
    for (const store of this.stores.values()) {
      if (store.data.delete(id)) store.version++;
    }
  }

  /** Remove an entity and return its components by store name (sorted by name). The id is not reused. */
  detach(id: number): EntityData {
    const out: EntityData = {};
    if (!this.alive.has(id)) return out;
    for (const name of [...this.stores.keys()].sort()) {
      const store = this.stores.get(name) as Store;
      if (store.data.has(id)) out[name] = store.data.get(id);
    }
    this.destroyEntity(id);
    return out;
  }

  /**
   * Bring back an entity under its old id with these components (a lifted ship or an archived sector coming back). Ids are
   * never reused, so the id is free unless it is alive; throws if it is alive or was never issued.
   */
  restore(id: number, data: EntityData): void {
    if (this.alive.has(id) || id <= 0 || id >= this.nextId) throw new Error(`World.restore: id ${id} is alive or was never issued`);
    this.alive.add(id);
    for (const name of Object.keys(data).sort()) {
      const store = this.store(name);
      store.data.set(id, data[name]);
      store.version++;
    }
  }

  /** IDs of every living entity, ascending. */
  ids(): number[] {
    return [...this.alive].sort((a, b) => a - b);
  }

  /** True if the entity exists. */
  isAlive(id: number): boolean {
    return this.alive.has(id);
  }

  /** Number of living entities. */
  get entityCount(): number {
    return this.alive.size;
  }

  /** Add (or overwrite) a component on a living entity. */
  add<T>(id: number, key: ComponentKey<T>, value: T): void {
    if (!this.alive.has(id)) throw new Error(`World.add: entity ${id} is not alive`);
    const store = this.store(key.name);
    if (!store.data.has(id)) store.version++;
    store.data.set(id, value);
  }

  /** Get a component, or undefined. */
  get<T>(id: number, key: ComponentKey<T>): T | undefined {
    return this.stores.get(key.name)?.data.get(id) as T | undefined;
  }

  /** True if the entity has the component. */
  has(id: number, key: ComponentKey<unknown>): boolean {
    return this.stores.get(key.name)?.data.has(id) ?? false;
  }

  /** Remove a component. Returns true if it was present. */
  remove(id: number, key: ComponentKey<unknown>): boolean {
    const store = this.stores.get(key.name);
    if (!store || !store.data.delete(id)) return false;
    store.version++;
    return true;
  }

  /**
   * IDs of entities having all given components, ascending. The result is cached until
   * membership of a relevant store changes; treat it as read-only.
   */
  query(...keys: ComponentKey<unknown>[]): readonly number[] {
    const stores = keys.map((k) => this.store(k.name));
    const cacheKey = keys.map((k) => k.name).join('|');
    const stamp = stores.reduce((sum, s) => sum + s.version, 0);
    const hit = this.cache.get(cacheKey);
    if (hit && hit.stamp === stamp) return hit.result;

    const smallest = stores.reduce((a, b) => (b.data.size < a.data.size ? b : a), stores[0] as Store);
    const result: number[] = [];
    for (const id of smallest.data.keys()) {
      if (stores.every((s) => s.data.has(id))) result.push(id);
    }
    result.sort((a, b) => a - b);
    this.cache.set(cacheKey, { stamp, result });
    return result;
  }

  /** Plain JSON-able snapshot. Component values are included by reference. */
  serialize(): WorldData {
    const stores: WorldData['stores'] = {};
    for (const name of [...this.stores.keys()].sort()) {
      const entries = [...(this.stores.get(name) as Store).data.entries()];
      stores[name] = entries.sort((a, b) => a[0] - b[0]);
    }
    return { nextId: this.nextId, alive: [...this.alive].sort((a, b) => a - b), stores };
  }

  /** Rebuild a World from serialize() output. */
  static deserialize(data: WorldData): World {
    const world = new World();
    world.nextId = data.nextId;
    world.alive = new Set(data.alive);
    for (const [name, entries] of Object.entries(data.stores)) {
      const store = world.store(name);
      for (const [id, value] of entries) store.data.set(id, value);
      store.version++;
    }
    return world;
  }

  private store(name: string): Store {
    let s = this.stores.get(name);
    if (!s) {
      s = { data: new Map(), version: 0 };
      this.stores.set(name, s);
    }
    return s;
  }
}
