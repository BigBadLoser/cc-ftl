/** Greedy label placement for the starmap's outer levels: each label takes its first candidate box that is clear. */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LabelItem {
  key: string;
  /** Candidate boxes (map units), best first. */
  cands: Box[];
  /** Placed on its first candidate even when nothing is clear (your sector, the picked one). */
  must?: boolean;
}

const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Place `items` in order around fixed `obstacles`; returns the chosen box per placed key (others are dropped). */
export function placeLabels(items: LabelItem[], obstacles: Box[]): Map<string, Box> {
  const taken = [...obstacles];
  const out = new Map<string, Box>();
  for (const it of items) {
    const box = it.cands.find((c) => !taken.some((t) => hit(c, t))) ?? (it.must ? it.cands[0] : undefined);
    if (!box) continue;
    taken.push(box);
    out.set(it.key, box);
  }
  return out;
}

/** A box `w` x `h` centred on x, with its top at y. */
export const boxAt = (x: number, y: number, w: number, h: number): Box => ({ x0: x - w / 2, y0: y, x1: x + w / 2, y1: y + h });
