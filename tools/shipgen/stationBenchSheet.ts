/** Station bench sheets: a contact sheet of the first seeds of a layout, and two sheets composed side by side. */
import { Raster, contactSheet } from './draw';
import { decodePng, encodePng } from './png';
import { specOf, type BenchOpts } from './stationBench';

const SCALE = 10;
const SHEET_SEEDS = 8;

/** PNG of the first 8 seeds of one layout, drawn by draw.ts's station sheet at a fixed scale. */
export function layoutSheet(o: BenchOpts, layout: string): Buffer {
  const s = contactSheet(specOf(o.station, o.size, layout), o.from, Math.min(SHEET_SEEDS, o.count), 0, SCALE, 1800, 'detail');
  return encodePng({ width: s.raster.width, height: s.raster.height, data: new Uint8Array(s.raster.data.buffer) });
}

/** Two sheet PNGs side by side under column headers (default "before" / "after"). */
export function pairSheets(a: Buffer, b: Buffer, titles: [string, string] = ['before', 'after']): Buffer {
  const [ia, ib] = [decodePng(a), decodePng(b)];
  const head = 26, gap = 12;
  const r = new Raster(ia.width + ib.width + gap, Math.max(ia.height, ib.height) + head);
  const blit = (img: ReturnType<typeof decodePng>, ox: number): void => {
    for (let y = 0; y < img.height; y++) r.data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), ((y + head) * r.width + ox) * 4);
  };
  blit(ia, 0); blit(ib, ia.width + gap);
  r.text(titles[0], 8, 6, [255, 220, 120], 3);
  r.text(titles[1], ia.width + gap + 8, 6, [120, 220, 255], 3);
  r.rect(ia.width, head, gap, r.height - head, [90, 90, 100]);
  return encodePng({ width: r.width, height: r.height, data: new Uint8Array(r.data.buffer) });
}
