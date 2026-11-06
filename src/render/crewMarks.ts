/*
 * Crew status marks: the overhead icons (`crew.mark.*`, sheet `marks`, tools/blender/sprites/crew_marks.py) over a crew
 * member's head (a red cross on the downed, a white flag on those who surrendered, a break's symbol in its tier's thought
 * bubble, a chat's speech bubble), and a red (hostile) or green (yours) foot diamond, still drawn in code.
 */
import { shipIdAtTile } from './regionRules';
import { Container, Graphics, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Atlas } from './assets/loader';
import { CrewC, DeadC, DownedC, PositionC } from '../sim/crew/components';
import { BreakdownC } from '../sim/crew/breakTypes';
import { InteractionC } from '../sim/crew/interactionTypes';
import { AllegianceC, SurrenderedC } from '../sim/fight/components';
import type { Ship } from '../sim/combat/components';
import { Z_PX } from './heights';
import { ART_SCALE as S, iso } from './iso';

export interface CrewMarksHost {
  atlas: Atlas;
  /** Where the crew member's figure is drawn (feet, sector-frame art px) and how far above its feet its bars reach, or null when it is not drawn. */
  figure(id: number): { x: number; y: number; bars: number } | null;
  ship(shipId: number): Ship | undefined;
  /** False where the crew view hides crew (on the interior of a roofed region, or a region not drawn). */
  visible(shipId: number, x: number, y: number): boolean;
}

export interface CrewMarks {
  update(dt: number): void;
  dispose(): void;
}

/**
 * How far above a standing figure's feet an icon's bottom (its anchor) sits: the speech bubble's tail and the thought bubble's puffs end
 * just over the head (world px; the render lab's `marks` panel uses it too).
 */
export const MARK_HEAD = 1.7 * Z_PX;

/** Icon frames per second (crew_marks.FPS). */
const FPS = 4;

/** The icon a crew member shows, most urgent first: downed, surrendered, a break (not while a survival need suspends it), a chat. */
export function markId(world: World, id: number): string | null {
  if (world.has(id, DownedC)) return 'crew.mark.downed';
  if (world.has(id, SurrenderedC)) return 'crew.mark.surrendered';
  const b = world.get(id, BreakdownC);
  if (b && !b.suspended) return `crew.mark.break.${b.kind}.${b.tier}`;
  const talk = world.get(id, InteractionC);
  return talk ? `crew.mark.${talk.icon}` : null;
}

export function createCrewMarks(world: World, parent: Container, host: CrewMarksHost): CrewMarks {
  const g = new Graphics();
  const icons = new Container();
  parent.addChild(g, icons);
  const sprites = new Map<number, Sprite>();
  /** Frame ids per icon id (the sheet's `<id>.0` .. `<id>.n-1`), looked up once. */
  const frames = new Map<string, string[]>();
  let clock = 0;
  return {
    update(dt) {
      clock += dt;
      g.clear();
      const seen = new Set<number>();
      for (const id of world.query(CrewC, PositionC)) {
        const pos = world.get(id, PositionC);
        const shipId = pos ? shipIdAtTile(world, pos.x, pos.y) : 0;
        if (!pos || !host.ship(shipId) || !host.visible(shipId, pos.x, pos.y) || world.has(id, DeadC)) continue;
        const gx = pos.x + (pos.toX - pos.x) * pos.progress;
        const gy = pos.y + (pos.toY - pos.y) * pos.progress;
        const p = iso(gx, gy); // sector tiles
        const mine = world.get(id, AllegianceC)?.faction === 'player';
        g.poly([p.x, p.y - 5 * S, p.x + 10 * S, p.y, p.x, p.y + 5 * S, p.x - 10 * S, p.y]).stroke({ width: S, color: mine ? 0x4cd964 : 0xff4a3a, alpha: 0.8 });
        // No health bar here: the crew view draws one on the figure itself (in bed, seated or standing). A second one at the
        // sim tile floated over beds, apart from its sleeper, and stayed when the figure did not draw.
        const mark = markId(world, id);
        if (!mark) continue;
        let ids = frames.get(mark);
        if (!ids) frames.set(mark, (ids = host.atlas.ids(`${mark}.`)));
        const st = ids.length ? host.atlas.stat(ids[Math.floor(clock * FPS + id * 0.37) % ids.length] as string) : undefined;
        if (!st) continue; // (its sheet is still loading)
        let s = sprites.get(id);
        if (!s) {
          s = new Sprite();
          icons.addChild(s);
          sprites.set(id, s);
        }
        // Over the drawn figure (it is smoothed and sits in beds and seats; the sim tile is not): the icon's bottom (its anchor) just over a
        // standing head, a little over a lying figure, and above the figure's health and air bars when they show.
        const fig = host.figure(id) ?? { ...p, bars: 0 };
        const head = world.has(id, DownedC) ? 0.55 * Z_PX : MARK_HEAD;
        const bottom = fig.y - Math.max(head, fig.bars > 0 ? fig.bars + 2 * S : 0);
        s.texture = st.tex;
        s.position.set(fig.x - st.ax, bottom - st.ay);
        s.visible = true;
        seen.add(id);
      }
      for (const [id, s] of sprites) {
        if (seen.has(id)) continue;
        s.destroy();
        sprites.delete(id);
      }
    },
    dispose() {
      g.destroy();
      icons.destroy({ children: true });
      sprites.clear();
    },
  };
}
