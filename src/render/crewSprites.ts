import { Texture, type Sprite } from 'pixi.js';
import type { LayerSprite } from './assets/loader';
import { cellOf } from './assets/manifest';
import { HALO_PAD, haloTex } from './haloTex';
import { isCombatClip, layerShown } from './handWeapon';
import { pickFrame, resolveClip } from './loadout';

/** The sprites of a crew figure: one per layer, and one additive glow (with an optional halo) per glowing layer. */
export interface FigureSprites {
  parts: { layer: LayerSprite; sprite: Sprite }[];
  glows: { layer: LayerSprite; sprite: Sprite; halo: Sprite | null }[];
}

/**
 * Set every layer's frame for a clip, direction and clip time. A layer without a sheet for the clip is drawn with its
 * fallback or hidden (see resolveClip), and sheets load on demand: until a clip's sheet is there the layer shows its idle
 * (pickFrame). The held weapon is drawn in its combat clips once its sheet and the body's are loaded; until then (and out
 * of combat) the holster stays, so the weapon is neither missing nor drawn twice.
 */
export function drawLayers(f: FigureSprites, clip: string, dir: number, t: number): void {
  const body = f.parts[0];
  const bodyReady = !!body && (!isCombatClip(clip) || pickFrame(body.layer, clip, dir, t)?.clip === resolveClip(body.layer.def, clip));
  const held = f.parts.find((q) => q.layer.def.slot === 'gear.hand');
  const heldOn = !!held && bodyReady && layerShown('gear.hand', clip) && !!pickFrame(held.layer, clip, dir, t);
  for (const { layer, sprite } of f.parts) {
    const slot = layer.def.slot;
    const d = (slot === 'gear.hand' ? heldOn : slot === 'gear.holster' ? !heldOn : true) ? pickFrame(layer, clip, dir, t) : undefined;
    sprite.visible = !!d;
    if (d) {
      sprite.texture = d.tex;
      const cell = cellOf(layer.def, d.clip);
      sprite.position.set(cell.ox - layer.def.anchor.x, cell.oy - layer.def.anchor.y);
    }
  }
  for (const g of f.glows) {
    const d = pickFrame(g.layer, clip, dir, t);
    const tex = d ? g.layer.glowFrame(d.clip, dir, d.col) : null;
    g.sprite.texture = tex ?? Texture.EMPTY;
    g.sprite.visible = !!tex;
    if (d && tex) {
      const cell = cellOf(g.layer.def, d.clip);
      g.sprite.position.set(cell.ox - g.layer.def.anchor.x, cell.oy - g.layer.def.anchor.y);
    }
    if (g.halo) {
      g.halo.visible = !!tex;
      if (d && tex) {
        const cell = cellOf(g.layer.def, d.clip);
        g.halo.texture = haloTex(tex);
        g.halo.position.set(cell.ox - g.layer.def.anchor.x - HALO_PAD, cell.oy - g.layer.def.anchor.y - HALO_PAD);
      }
    }
  }
}
