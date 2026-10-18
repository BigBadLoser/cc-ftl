/*
 * PLACEHOLDER ART. Drawn-in-code crew status marks so a fight can be read before real icons exist: a health bar over
 * hurt crew, a red cross on the downed, a white flag on those who surrendered, and a red (hostile) or green (yours)
 * foot diamond. Replace with sprite icons later; delete this file then.
 */
import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CrewC, DeadC, DownedC, HealthC, PositionC } from '../sim/crew/components';
import { AllegianceC, SurrenderedC } from '../sim/fight/components';
import type { Ship } from '../sim/combat/components';
import { Z_PX } from './heights';
import { iso } from './iso';

export interface CrewMarksHost {
  ref(): { x: number; y: number } | null;
  ship(gridId: number): Ship | undefined;
  /** False for roofed ships (their interior is hidden). */
  visible(gridId: number): boolean;
}

export interface CrewMarks {
  update(): void;
  dispose(): void;
}

const BAR_W = 20;

export function createCrewMarks(world: World, parent: Container, host: CrewMarksHost): CrewMarks {
  const g = new Graphics();
  parent.addChild(g);
  return {
    update() {
      g.clear();
      const r = host.ref();
      if (!r) return;
      for (const id of world.query(CrewC, PositionC)) {
        const pos = world.get(id, PositionC);
        const ship = pos && host.ship(pos.gridId);
        if (!pos || !ship || !host.visible(pos.gridId) || world.has(id, DeadC)) continue;
        const gx = pos.x + (pos.toX - pos.x) * pos.progress;
        const gy = pos.y + (pos.toY - pos.y) * pos.progress;
        const p = iso(ship.x - r.x + gx, ship.y - r.y + gy);
        const mine = world.get(id, AllegianceC)?.faction === 'player';
        const hp = world.get(id, HealthC);
        const downed = world.has(id, DownedC);
        const flag = world.has(id, SurrenderedC);
        const foot = mine ? 0x4cd964 : 0xff4a3a;
        g.poly([p.x, p.y - 5, p.x + 10, p.y, p.x, p.y + 5, p.x - 10, p.y]).stroke({ width: 1, color: foot, alpha: 0.8 });
        const top = p.y - (downed ? 0.55 : 1.7) * Z_PX;
        if (hp && hp.hp < hp.max && !downed) {
          g.rect(p.x - BAR_W / 2 - 1, top - 1, BAR_W + 2, 5).fill({ color: 0x05080d, alpha: 0.85 });
          g.rect(p.x - BAR_W / 2, top, (BAR_W * Math.max(0, hp.hp)) / hp.max, 3).fill(mine ? 0x4cd964 : 0xff5a4a);
        }
        if (downed) {
          g.rect(p.x - 2, top - 8, 4, 12).fill(0xff3b30);
          g.rect(p.x - 6, top - 4, 12, 4).fill(0xff3b30);
        } else if (flag) {
          g.rect(p.x, top - 14, 1.5, 16).fill(0xdfe6f0);
          g.poly([p.x + 1.5, top - 14, p.x + 11, top - 10, p.x + 1.5, top - 6]).fill(0xffffff).stroke({ width: 1, color: 0x151c28 });
        }
      }
    },
    dispose() {
      g.destroy();
    },
  };
}
