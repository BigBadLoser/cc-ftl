/** The compare view's drawing: the diff as marks over the grid (green added, red removed outlines, yellow changed and moved) and a line for each moved module. */
import { scaleOf, type Box, type View } from './camera';
import { centre, tilesFrom, tilesTo, type Diff } from './diff';
import { tilesOf, type Design } from './design';
import type { Mark } from './gridDraw';

export const GREEN = 'rgba(90,255,120,1)', RED = 'rgba(255,70,70,1)', YELLOW = 'rgba(255,205,60,1)';

/** The marks for a diff over the edited design `d`. */
export function diffMarks(d: Design, diff: Diff): Mark[] {
  const by = (kind: string): [number, number][] => diff.tiles.filter((t) => t.kind === kind).map((t): [number, number] => [t.x, t.y]);
  const out: Mark[] = [
    { tiles: by('added'), color: GREEN },
    { tiles: by('changed'), color: YELLOW },
    { tiles: by('removed'), color: RED, fill: false },
  ];
  for (const m of diff.modules) {
    if (m.kind === 'added') out.push({ tiles: tilesTo(m), color: GREEN });
    else if (m.kind === 'removed') out.push({ tiles: tilesFrom(m), color: RED, fill: false });
    else { out.push({ tiles: tilesTo(m), color: YELLOW }); out.push({ tiles: tilesFrom(m), color: YELLOW, fill: false }); }
  }
  for (const r of diff.rooms) if (r.kind === 'retyped') out.push({ tiles: tilesOf(d, { kind: 'room', id: r.id }), color: YELLOW, fill: false });
  return out.filter((m) => m.tiles.length);
}

/** A thin line from each moved module's old spot to its new one. */
export function drawMoves(ctx: CanvasRenderingContext2D, diff: Diff, v: View, dpr: number, box: Box): void {
  const s = scaleOf(v.zoom, dpr);
  const ox = box.w / 2 - (v.cx + 0.5) * s, oy = box.h / 2 - (v.cy + 0.5) * s;
  ctx.strokeStyle = YELLOW;
  ctx.fillStyle = YELLOW;
  ctx.lineWidth = 1.5;
  for (const m of diff.modules) {
    if (m.kind !== 'moved' || !m.from || !m.to) continue;
    const a = centre(m.from), b = centre(m.to);
    ctx.beginPath();
    ctx.moveTo(ox + (a[0] + 0.5) * s, oy + (a[1] + 0.5) * s);
    ctx.lineTo(ox + (b[0] + 0.5) * s, oy + (b[1] + 0.5) * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox + (b[0] + 0.5) * s, oy + (b[1] + 0.5) * s, Math.max(2, s * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
}
