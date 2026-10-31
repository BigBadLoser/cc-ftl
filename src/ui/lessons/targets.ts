import type { UiApi } from '../api';
import { anchorSelector, type LessonAnchor } from './anchors';
import type { LessonCtx } from './types';

/** Half the side of the box drawn around a station that is on screen (CSS px). */
const WORLD_BOX = 56;

export interface ScreenRect { x0: number; y0: number; x1: number; y1: number }

/** What resolving a target can use: the lesson context, the renderer's projection of world things, and the page. */
export interface TargetEnv {
  ctx: LessonCtx;
  api: Pick<UiApi, 'moduleScreenRect' | 'shipScreen'>;
  doc: Pick<Document, 'querySelector' | 'querySelectorAll'>;
}

/**
 * What a step points at. `ui`: an element with that `data-lesson` anchor. `module`: a module in the world (picked from the context, e.g. an
 * enemy weapon), placed with the renderer's screen projection every frame. A new kind is a shape here plus a resolver below.
 */
export interface TargetKinds {
  ui: { anchor: LessonAnchor };
  module: { pick: (ctx: LessonCtx) => number | null };
  /** A ship or station in the node (its entity id): its off-screen marker when it is off screen, else a box around it in the world. */
  ship: { pick: (ctx: LessonCtx) => number | null };
}

export type LessonTarget = { [K in keyof TargetKinds]: { kind: K } & TargetKinds[K] }[keyof TargetKinds];

type Resolver<K extends keyof TargetKinds> = (t: { kind: K } & TargetKinds[K], env: TargetEnv) => ScreenRect | null;

export const TARGET_KINDS: { [K in keyof TargetKinds]: Resolver<K> } = {
  ui: (t, env) => {
    const r = env.doc.querySelector(anchorSelector(t.anchor))?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null;
  },
  module: (t, env) => {
    const id = t.pick(env.ctx);
    return id ? env.api.moduleScreenRect(id) : null;
  },
  ship: (t, env) => {
    const id = t.pick(env.ctx);
    if (id == null) return null;
    // The marker button has no box of its own (arrow and icon are positioned out of it): ring the two together.
    const parts = [...env.doc.querySelectorAll(`[data-testid="poi-${id}"] .arrow, [data-testid="poi-${id}"] .ico`)].map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0);
    if (parts.length) return { x0: Math.min(...parts.map((r) => r.left)), y0: Math.min(...parts.map((r) => r.top)), x1: Math.max(...parts.map((r) => r.right)), y1: Math.max(...parts.map((r) => r.bottom)) };
    const at = env.api.shipScreen(id);
    return at ? { x0: at.x - WORLD_BOX, y0: at.y - WORLD_BOX, x1: at.x + WORLD_BOX, y1: at.y + WORLD_BOX } : null;
  },
};

/** The target's screen rect in viewport CSS px, or null when it is not on screen (the card then sits centred). */
export function resolveTarget(t: LessonTarget, env: TargetEnv): ScreenRect | null {
  return (TARGET_KINDS[t.kind] as Resolver<typeof t.kind>)(t as never, env);
}

export const uiTarget = (a: LessonAnchor): LessonTarget => ({ kind: 'ui', anchor: a });
export const shipTarget = (pick: (ctx: LessonCtx) => number | null): LessonTarget => ({ kind: 'ship', pick });
export const moduleTarget = (pick: (ctx: LessonCtx) => number | null): LessonTarget => ({ kind: 'module', pick });
