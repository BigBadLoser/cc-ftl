import { describe, expect, it } from 'vitest';
import { Container, type IRenderLayer } from 'pixi.js';
import { createWorldStack } from './worldLayers';

const depthLayer = (root: Container) => root.children.find((c) => 'renderLayerChildren' in c) as unknown as IRenderLayer;
const named = (name: string, z: number) => {
  const c = new Container();
  c.label = name;
  c.zIndex = z;
  return c;
};

describe('world stack', () => {
  it('sorts the sprites of every region by zIndex plus the region depth, and keeps ties in add order', () => {
    const W = createWorldStack();
    const a = W.region(false);
    const b = W.region(false);
    a.setOrigin(0, 0, 0);
    b.setOrigin(0, 0, 10);
    a.sorted.addChild(named('a12', 12), named('a5', 5), named('a10first', 10));
    b.sorted.addChild(named('b0', 0), named('b3', 3));
    W.low.addChild(named('low11', 11));
    const L = depthLayer(W.root);
    L.sortRenderLayerChildren();
    expect(L.renderLayerChildren.map((c) => c.label)).toEqual(['a5', 'a10first', 'b0', 'low11', 'a12', 'b3']);
  });

  it('drops a removed sprite from the shared layer', () => {
    const W = createWorldStack();
    const a = W.region(false);
    const s = named('s', 1);
    a.sorted.addChild(s);
    s.destroy();
    expect(depthLayer(W.root).renderLayerChildren).toHaveLength(0);
  });
});
