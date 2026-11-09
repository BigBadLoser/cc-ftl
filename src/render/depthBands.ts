import { Container, RenderLayer, type IRenderLayer } from 'pixi.js';
import { sortByKeys } from './depthSort';

/**
 * The depth-sorted world in bands of depth (#389).
 *
 * Every wall, prop, crew member and body sorts by `zIndex + depth base of its scene parent`. Pixi rebuilds the instruction
 * list of a whole render group whenever one zIndex in it changes, and a walking crew member changes its own every frame, so
 * with one group for everything each frame re-collected, re-sorted and re-packed all ~16k sprites. Here the sprites are
 * split by key into bands of `width` depth, each band its own render group drawn in band order, so a step rebuilds only the
 * band it happens in (and the one it moves to). The draw order is exactly the one sorted layer's: a band holds a key range,
 * the bands draw in key order, and inside a band the sort is the same stable sort.
 *
 * How it sits in pixi (8.x): a sprite's scene parent stays its region's container (`DepthParent`, inside the shared `art`
 * group, which carries the transforms), but the sprite itself belongs to its band's render group (`parentRenderGroup`), so
 * every structure, texture and transform change of it reaches the band. Band roots sit at identity inside `art`, so a
 * band's world transform is `art`'s. The scene parents are left out of `art`'s own build (`includeInBuild`).
 */
export class DepthParent extends Container {
  /** The depth this container's children's zIndex values add (a region's x0 + y0). */
  depthBase = 0;

  constructor(private readonly bands: DepthBands) {
    super();
    this.includeInBuild = false; // its children draw through the bands, not from here
    this.on('childAdded', (child: Container) => bands.place(child));
  }

  /** Change the base; every child's key changes with it, so every band is checked. */
  setDepthBase(d: number): void {
    if (d === this.depthBase) return;
    this.depthBase = d;
    this.bands.recheckAll();
  }
}

interface Band {
  index: number;
  root: Container;
  layer: IRenderLayer;
}

type Group = NonNullable<Container['renderGroup']>;

export function depthKey(c: Container): number {
  const p = c.parent;
  return c.zIndex + (p instanceof DepthParent ? p.depthBase : 0);
}

const live = new Set<DepthBands>();
/** Rank space per band (more sprites than any band holds), and the ranks of sprites never sorted (past every band's). */
const BAND_RANKS = 2 ** 24;
const NEW_RANK = 2 ** 52;
const RANK = Symbol('depthRank');
type Ranked = Container & { [RANK]?: number };
/** Debug (same-frame render diffs): bands of this width, or one band for everything (`Infinity`, the old single layer). */
export const DEPTH_BAND_WIDTH = 4;
let bandWidth = DEPTH_BAND_WIDTH;

export function setDepthBandWidth(w: number): void {
  bandWidth = w;
  for (const b of live) b.recheckAll();
}

export class DepthBands {
  private readonly bands = new Map<number, Band>();
  /** Bands in index order (the order of `art`'s first children). */
  private readonly order: Band[] = [];
  private all = false;
  private keys = new Float64Array(256);
  private ties = new Float64Array(256);
  /*
   * RANK: each sprite's place in the whole draw order as of its band's last sort (band index, then position), or after everyone
   * in attach order for a sprite never sorted. Equal keys draw in this order, which is what the one sorted layer did: its
   * stable sort kept equal keys in their previous order, new sprites last. A sprite moving to another band keeps its rank,
   * so it still sorts before the equal keys of a band it climbs into and after those of one it drops into. A field, not a
   * map: every sort reads and writes it for every sprite of the band.
   */
  private attached = 0;

  /** `art` must be a render group root, with only the bands and the scene parents (left out of its build) as children. */
  constructor(private readonly art: Container) {
    live.add(this);
    art.once('destroyed', () => live.delete(this));
    // Before `art`'s transforms and the bands' builds: move every sprite whose key left its band, and give the bands
    // `art`'s update tick (see `syncTick`).
    art.onRender = () => this.prepare();
  }

  private bandIndex(key: number): number {
    return bandWidth === Infinity ? 0 : Math.floor(key / bandWidth);
  }

  private band(i: number): Band {
    let b = this.bands.get(i);
    if (b) return b;
    const root = new Container();
    const layer = new RenderLayer({ sortableChildren: true });
    root.addChild(layer);
    b = { index: i, root, layer };
    layer.sortRenderLayerChildren = () => this.sort(layer, i);
    let at = 0;
    while (at < this.order.length && (this.order[at] as Band).index < i) at++;
    this.order.splice(at, 0, b);
    this.art.addChildAt(root, at);
    root.enableRenderGroup();
    root.onRender = () => this.syncTick(root);
    this.bands.set(i, b);
    return b;
  }

  /**
   * A child was added to a depth parent: pixi has made it part of `art`'s group; it moves to its band's group and layer.
   * Its zIndex is often set just after (`place` then sees the old key): the change marks its band, and `prepare` moves it.
   */
  place(child: Container): void {
    (child as Ranked)[RANK] = NEW_RANK + this.attached++; // (re)attached: after everyone, as the one layer appended it
    this.moveTo(child, this.band(this.bandIndex(depthKey(child))));
  }

  private moveTo(child: Container, b: Band): void {
    const group = child.parentRenderGroup as Group | null;
    if (group) group.removeChild(child);
    child.parentRenderLayer?.detach(child);
    (b.root.renderGroup as Group).addChild(child);
    b.layer.attach(child);
  }

  /** Mark every band for a check and a rebuild (a depth base changed, a region was shown or hidden, the band width changed). */
  recheckAll(): void {
    this.all = true;
  }

  /** Before drawing: sprites whose key left their band's range move to the right band (both bands rebuild this frame). */
  prepare(): void {
    const all = this.all;
    this.all = false;
    let moves: [Container, number][] | null = null;
    for (const b of this.order) {
      const g = b.root.renderGroup as Group;
      if (!all && !g.structureDidChange) continue;
      g.structureDidChange = true;
      const kids = b.layer.renderLayerChildren;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i] as Container;
        const want = this.bandIndex(depthKey(c));
        if (want !== b.index) (moves ??= []).push([c, want]);
      }
    }
    // Moved after the scan (a move can add a band); where a sprite lands in its new band does not matter, the sort uses ranks.
    if (moves) for (const [c, want] of moves) this.moveTo(c, this.band(want));
  }

  /**
   * Pixi stamps each container with the tick of the group pass that last updated its transform and skips it on a match.
   * `art`'s pass updates band sprites too (when their scene parent moved), so a band uses the tick of `art`'s latest pass:
   * a sprite stamped by it this pass is skipped, any older stamp is updated, and the two counters never collide.
   */
  private syncTick(root: Container): void {
    const g = root.renderGroup as Group;
    g.updateTick = (this.art.renderGroup as Group).updateTick - 1;
  }

  private sort(layer: IRenderLayer, index: number): void {
    const a = layer.renderLayerChildren;
    const n = a.length;
    if (this.keys.length < n) this.keys = new Float64Array(n * 2);
    if (this.ties.length < n) this.ties = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const c = a[i] as Container;
      this.keys[i] = depthKey(c);
      this.ties[i] = (c as Ranked)[RANK] ?? NEW_RANK;
    }
    sortByKeys(a, this.keys, this.ties, n);
    const base = index * BAND_RANKS;
    for (let i = 0; i < n; i++) (a[i] as Ranked)[RANK] = base + i;
  }

  /**
   * The full draw order (tests, debugging): every band checked and sorted, in band order. `asBuilt` instead does what a frame
   * does, for tests without a renderer: check and sort only the bands marked for a rebuild, then mark them built.
   */
  drawOrder(asBuilt = false): Container[] {
    if (!asBuilt) this.recheckAll();
    this.prepare();
    const out: Container[] = [];
    for (const b of this.order) {
      const g = b.root.renderGroup as Group;
      if (!asBuilt || g.structureDidChange) this.sort(b.layer, b.index);
      if (asBuilt) g.structureDidChange = false;
      out.push(...(b.layer.renderLayerChildren as Container[]));
    }
    return out;
  }
}
