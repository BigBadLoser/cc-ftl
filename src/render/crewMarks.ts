/*
 * PLACEHOLDER ART. Drawn-in-code crew status marks so a fight can be read before real icons exist: a red cross on the
 * downed, a white flag on those who surrendered, and a red (hostile) or green (yours)
 * foot diamond. Replace with sprite icons later; delete this file then.
 */
import { shipIdAtTile } from './regionRules';
import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CrewC, DeadC, DownedC, PositionC } from '../sim/crew/components';
import { InteractionC, type Interaction } from '../sim/crew/interactionTypes';
import { AllegianceC, SurrenderedC } from '../sim/fight/components';
import type { Ship } from '../sim/combat/components';
import { Z_PX } from './heights';
import { ART_SCALE as S, iso } from './iso';

export interface CrewMarksHost {
  ship(shipId: number): Ship | undefined;
  /** False where the crew view hides crew (on the interior of a roofed region, or a region not drawn). */
  visible(shipId: number, x: number, y: number): boolean;
}

export interface CrewMarks {
  update(): void;
  dispose(): void;
}


/**
 * PLACEHOLDER ART for the overhead social cues, in code until the one sprite pass (with the break status symbols): a chat is a speech
 * bubble (three dots when it goes well, a squiggle when it does not), a shouting match a red burst with a bar and a dot.
 */
function bubble(g: Graphics, x: number, y: number, talk: Interaction): void {
  if (talk.icon === 'shout') {
    const pts: number[] = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r = (k % 2 ? 6 : 11) * S;
      pts.push(x + Math.cos(a) * r, y - 8 * S + Math.sin(a) * r);
    }
    g.poly(pts).fill(0xff4a3a).stroke({ width: S, color: 0x4a0f0a });
    g.rect(x - S, y - 13 * S, 2 * S, 6 * S).fill(0xffffff);
    g.rect(x - S, y - 5 * S, 2 * S, 2 * S).fill(0xffffff);
    return;
  }
  g.roundRect(x - 10 * S, y - 18 * S, 20 * S, 13 * S, 3 * S).fill(0xf4f7fb).stroke({ width: S, color: 0x151c28 });
  g.poly([x - 3 * S, y - 5 * S, x + 2 * S, y - 5 * S, x - 4 * S, y]).fill(0xf4f7fb);
  const ink = talk.icon === 'chatBad' ? 0xc0392b : 0x2b3a55;
  if (talk.icon === 'chatBad') {
    g.poly([x - 6 * S, y - 10 * S, x - 3 * S, y - 14 * S, x, y - 10 * S, x + 3 * S, y - 14 * S, x + 6 * S, y - 10 * S]).stroke({ width: 1.5 * S, color: ink });
  } else {
    for (const dx of [-5, 0, 5]) g.circle(x + dx * S, y - 11.5 * S, 1.4 * S).fill(ink);
  }
}

export function createCrewMarks(world: World, parent: Container, host: CrewMarksHost): CrewMarks {
  const g = new Graphics();
  parent.addChild(g);
  return {
    update() {
      g.clear();
      for (const id of world.query(CrewC, PositionC)) {
        const pos = world.get(id, PositionC);
        const ship = pos && host.ship(shipIdAtTile(world, pos.x, pos.y));
        if (!pos || !ship || !host.visible(shipIdAtTile(world, pos.x, pos.y), pos.x, pos.y) || world.has(id, DeadC)) continue;
        const gx = pos.x + (pos.toX - pos.x) * pos.progress;
        const gy = pos.y + (pos.toY - pos.y) * pos.progress;
        const p = iso(gx, gy); // sector tiles
        const mine = world.get(id, AllegianceC)?.faction === 'player';
        const downed = world.has(id, DownedC);
        const flag = world.has(id, SurrenderedC);
        const foot = mine ? 0x4cd964 : 0xff4a3a;
        g.poly([p.x, p.y - 5 * S, p.x + 10 * S, p.y, p.x, p.y + 5 * S, p.x - 10 * S, p.y]).stroke({ width: S, color: foot, alpha: 0.8 });
        const top = p.y - (downed ? 0.55 : 1.7) * Z_PX;
        // No health bar here: the crew view draws one on the figure itself (in bed, seated or standing). A second one at the
        // sim tile floated over beds, apart from its sleeper, and stayed when the figure did not draw.
        if (downed) {
          g.rect(p.x - 2 * S, top - 8 * S, 4 * S, 12 * S).fill(0xff3b30);
          g.rect(p.x - 6 * S, top - 4 * S, 12 * S, 4 * S).fill(0xff3b30);
        } else if (flag) {
          g.rect(p.x, top - 14 * S, 1.5 * S, 16 * S).fill(0xdfe6f0);
          g.poly([p.x + 1.5 * S, top - 14 * S, p.x + 11 * S, top - 10 * S, p.x + 1.5 * S, top - 6 * S]).fill(0xffffff).stroke({ width: S, color: 0x151c28 });
        } else {
          const talk = world.get(id, InteractionC);
          if (talk) bubble(g, p.x, top - 8 * S, talk);
        }
      }
    },
    dispose() {
      g.destroy();
    },
  };
}
