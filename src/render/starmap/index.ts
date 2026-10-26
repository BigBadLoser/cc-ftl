/**
 * The starmap drawn by Pixi on the GPU. One canvas under the screen's panels, one world container that holds the camera (pan and zoom are
 * its position and scale; the scale sits on a sixteenths-of-an-octave grid, the origin on a whole device px), the baked nebula, and the
 * level in view. Nothing is rebuilt per frame: the levels redraw on a zoom step or a state change, and a frame is drawn only when
 * something changed (camera, scene, a fade, or an animation: the orbits and the pulse, at 30 fps).
 */
import { autoDetectRenderer, Container, Sprite, Texture, TilingSprite, type Renderer } from 'pixi.js';
import type { CreateStarmapGpu, StarmapGlide, StarmapGpu, StarmapGpuScene } from '../../ui/starmapGpu';
import type { UiStarArt } from '../../ui/starmapApi';
import { loadArt, type ArtTextures } from './art';
import type { Cam, Ctx, Level, Scene } from './kit';
import { createLevel1 } from './level1';
import { createLevel2 } from './level2';
import { createLevel3 } from './level3';
import { bakeNebula } from './nebula';
import { readPalette, type Palette } from './palette';
import { parsePoints } from './pixel';

const FADE_MS = 180;
const ANIM_MS = 33;

/** The parts of the map data a level is built from: a level is rebuilt when one of them is a new object. */
const structOf = (s: StarmapGpuScene): unknown[] => {
  const m = s.map;
  return [s.level, m.rev, m.current, m.currentSector, m.sectors, m.nodes, m.edges, m.exits, m.fleets, m.clusters, m.sectorLinks, m.clusterLinks];
};

export const createStarmapGpu: CreateStarmapGpu = (host) => {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;display:block;pointer-events:none';
  host.prepend(canvas);
  const dpr = window.devicePixelRatio || 1;
  const stage = new Container();
  stage.eventMode = 'none';
  /** The starfield tile (`starmap.backdrop`), repeated behind the map at two screen px per art px. It is drawn here, not by the page, so the nebula's screen blend meets it. */
  const backdrop = stage.addChild(new TilingSprite({ texture: Texture.EMPTY, width: 1, height: 1 }));
  backdrop.eventMode = 'none';
  const world = stage.addChild(new Container());
  world.eventMode = 'none';
  const nebulaSprite = world.addChild(new Sprite());
  nebulaSprite.blendMode = 'screen';
  nebulaSprite.visible = false;

  let renderer: Renderer | null = null;
  let dead = false;
  let pal: Palette | null = null;
  let artTex: ArtTextures | null = null;
  let artFor: UiStarArt | null = null;
  let scIn: StarmapGpuScene | null = null;
  let cam: Cam | null = null;
  let glideIn: StarmapGlide | null = null;
  let level: Level | null = null;
  let levelKey: unknown[] = [];
  let fading: { old: Level; t0: number } | null = null;
  let nebulaKey = '';
  let nebulaTex: Texture | null = null;
  let dirty = true;
  let raf = 0;
  let lastDraw = 0;
  let animating = false;

  const scene = (): Scene | null => {
    if (!scIn) return null;
    return {
      map: scIn.map, current: scIn.current, selected: scIn.selected, hover: scIn.hover, picked: scIn.picked, route: scIn.route,
      routePts: parsePoints(scIn.routePts), routeSectors: scIn.routeSectors, only: scIn.only, inset: scIn.inset,
    };
  };

  function request(): void {
    dirty = true;
    if (!raf && !dead) raf = requestAnimationFrame(frame);
  }

  function place(): void {
    if (!cam) return;
    world.scale.set(cam.s);
    world.position.set(Math.round((cam.w / 2 - cam.cx * cam.s) * dpr) / dpr, Math.round((cam.h / 2 - cam.cy * cam.s) * dpr) / dpr);
  }

  function nebula(): void {
    const sc = scIn;
    if (!sc || !artTex?.glowSheet || sc.level === 3) {
      nebulaSprite.visible = false;
      return;
    }
    const baked = bakeNebula(sc.map.nebula, artTex.art, artTex.glowSheet);
    if (!baked) {
      nebulaSprite.visible = false;
      return;
    }
    const key = sc.map.nebula.map((t) => t.id).join('|');
    if (key !== nebulaKey) {
      nebulaKey = key;
      nebulaTex?.destroy(true);
      nebulaTex = Texture.from(baked.canvas, true);
      nebulaTex.source.scaleMode = 'nearest';
      nebulaSprite.texture = nebulaTex;
      nebulaSprite.position.set(baked.x0, baked.y0);
      nebulaSprite.width = baked.side;
      nebulaSprite.height = baked.side;
    }
    nebulaSprite.alpha = sc.level === 1 ? 0.6 : 1;
    nebulaSprite.visible = true;
  }

  function sync(): void {
    const sc = scene();
    if (!sc || !cam || !renderer || !pal || !scIn) return;
    const key = structOf(scIn).concat([artTex]);
    const same = key.length === levelKey.length && key.every((v, i) => v === levelKey[i]);
    if (!same) {
      levelKey = key;
      const ctx: Ctx = { art: artTex, pal, dpr };
      const next = (scIn.level === 1 ? createLevel1 : scIn.level === 2 ? createLevel2 : createLevel3)(ctx, sc, cam);
      next.glide(glideIn);
      if (level) {
        fading?.old.destroy();
        fading = { old: level, t0: performance.now() };
        next.root.alpha = 0;
      }
      world.addChild(next.root);
      level = next;
      nebula();
    } else level?.scene(sc);
  }

  function frame(now: number): void {
    raf = 0;
    if (dead || !renderer) return;
    if (animating && !dirty && now - lastDraw < ANIM_MS) {
      raf = requestAnimationFrame(frame);
      return;
    }
    if (fading) {
      const t = Math.min(1, (now - fading.t0) / FADE_MS);
      fading.old.root.alpha = 1 - t;
      if (level) level.root.alpha = t;
      if (t >= 1) {
        fading.old.destroy();
        fading = null;
        if (level) level.root.alpha = 1;
      }
    }
    animating = (level?.tick(now) ?? false) || !!fading;
    renderer.render({ container: stage });
    lastDraw = now;
    dirty = false;
    if (animating) raf = requestAnimationFrame(frame);
  }

  void (async () => {
    const r = await autoDetectRenderer({
      canvas, width: 1, height: 1, resolution: dpr, autoDensity: true, antialias: false, roundPixels: true, backgroundAlpha: 1, background: 0x04080e,
      preference: 'webgl', powerPreference: 'high-performance',
      // The map picks in its own coordinates (the screen's pointer handlers); pixi's event system would hit-test the scene tree on every move.
      eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
    });
    if (dead) return r.destroy();
    renderer = r;
    // Labels measure their glyphs when made: wait for the pixel font before the first layout.
    await document.fonts?.load("12px Silkscreen").catch(() => undefined);
    if (dead) return;
    pal = readPalette();
    r.background.color = pal.bg;
    const c = cam as Cam | null;
    if (c) {
      r.resize(c.w, c.h);
      backdrop.width = c.w;
      backdrop.height = c.h;
    }
    sync();
    place();
    request();
  })();

  const gpu: StarmapGpu = {
    scene(s) {
      scIn = s;
      if (s.art !== artFor) {
        artFor = s.art;
        const mine = s.art;
        if (mine) {
          void loadArt(mine).then((t) => {
            if (dead || artFor !== mine) return t.destroy();
            artTex?.destroy();
            artTex = t;
            const tile = t.frame('starmap.backdrop');
            if (tile) {
              backdrop.texture = tile;
              backdrop.tileScale.set(2);
              backdrop.visible = true;
            }
            sync();
            request();
          });
        }
      }
      sync();
      request();
    },
    camera(cx, cy, s, w, h) {
      const resized = !cam || cam.w !== w || cam.h !== h;
      cam = { cx, cy, s, w, h, dpr };
      if (resized) {
        renderer?.resize(w, h);
        backdrop.width = w;
        backdrop.height = h;
      }
      place();
      level?.camera(cam);
      fading?.old.camera(cam);
      request();
    },
    glide(g) {
      glideIn = g;
      level?.glide(g);
      request();
    },
    tip: (x, y) => level?.tip(x, y) ?? null,
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      level?.destroy();
      fading?.old.destroy();
      nebulaTex?.destroy(true);
      artTex?.destroy();
      renderer?.destroy();
      canvas.remove();
    },
  };
  return gpu;
};
