import { describe, expect, it } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { createWorldStack } from './worldLayers';

describe('halo depth', () => {
  it('sorts a halo just in front of its glow and behind anything in front of the source tile', () => {
    const W = createWorldStack();
    const a = W.region(true);
    a.setOrigin(0, 0, 0);
    const key = 40.2;
    const glow = new Sprite(Texture.EMPTY);
    glow.zIndex = key + 0.01;
    glow.label = 'glow';
    const halo = new Sprite(Texture.EMPTY);
    halo.zIndex = key + 0.015;
    halo.label = 'halo';
    const front = new Container();
    front.zIndex = key + 0.5; // a body or crew one step toward the viewer
    front.label = 'front';
    const behind = new Container();
    behind.zIndex = key - 0.5;
    behind.label = 'behind';
    a.sorted.addChild(front, halo, behind, glow);
    const L = W.root.children.find((c) => 'renderLayerChildren' in c) as unknown as { sortRenderLayerChildren(): void; renderLayerChildren: Container[] };
    L.sortRenderLayerChildren();
    expect(L.renderLayerChildren.map((c) => c.label)).toEqual(['behind', 'glow', 'halo', 'front']);
  });
});
