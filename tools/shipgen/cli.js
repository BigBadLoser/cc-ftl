#!/usr/bin/env node
/**
 * Ship layout contact sheets without Blender or sprite art.
 *   node tools/shipgen/cli.js <faction|all> [--from 1] [--count 12] [--depth 0] [--out dir] [--scale 10] [--views detail|silhouette|assembly|structure|all]
 *   node tools/shipgen/cli.js station.<kind>|station.all [--size outpost|station|hub|outpost,hub|all] [--layout stationWheel]: station sheets.
 *   --ruin 0.2,0.5,0.9 [--cause combat|decay|both]: derelict ruin sheets instead (tools/shipgen/ruinView.ts).
 * Writes <out>/<faction>-d<depth>.png and .txt (validation summary + ASCII dump per seed) and prints the summary.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const from = Number(opt('from', 1));
const count = Number(opt('count', 12));
const depth = Number(opt('depth', 0));
const scale = Number(opt('scale', 10));
const out = resolve(opt('out', 'tools/shipgen/out'));
const views = opt('views', 'detail') === 'all' ? ['detail', 'silhouette', 'assembly', 'structure'] : opt('views', 'detail').split(',');

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const lib = await server.ssrLoadModule('/tools/shipgen/draw.ts');
  mkdirSync(out, { recursive: true });
  // Stations: `station.<kind>` (or `station.all`) with --size outpost|station|hub, a comma list, or all.
  const size = opt('size');
  const layout = opt('layout');
  const stationSpec = (id) => `${size && size !== 'all' && !id.includes(':') ? `${id}:${size}` : id}${layout ? `@${layout}` : ''}`;
  const factions = which === 'all' ? lib.factionIds()
    : which === 'station.all' ? lib.stationIds().map(stationSpec)
    : which.startsWith('station.') ? [stationSpec(which)]
    : [which.startsWith('faction.') ? which : `faction.${which}`];
  if (opt('ruin')) {
    const rv = await server.ssrLoadModule('/tools/shipgen/ruinView.ts');
    const levels = opt('ruin').split(',').map(Number);
    const causes = opt('cause', 'both') === 'both' ? ['combat', 'decay'] : [opt('cause')];
    for (const f of factions) for (const cause of causes) {
      const base = join(out, `${f.replace('faction.', '').replace(':', '-')}-ruin-${cause}`);
      const sheet = rv.ruinSheet(f, from, count, depth, scale, cause, levels);
      writeFileSync(`${base}.png`, png(sheet.raster.width, sheet.raster.height, sheet.raster.data));
      writeFileSync(`${base}.txt`, sheet.text);
      console.log(`${base}.png`);
    }
    process.exitCode = 0;
  } else
  for (const f of factions) {
    const base = join(out, f.startsWith('station.') ? f.replace(':', '-').replace(/,/g, '+').replace('@', '-') : `${f.replace('faction.', '').replace(':', '-')}-d${depth}`);
    let text = '';
    for (const view of views) {
      const sheet = lib.contactSheet(f, from, count, depth, scale, 2600, view);
      const file = view === 'detail' ? `${base}.png` : `${base}-${view}.png`;
      writeFileSync(file, png(sheet.raster.width, sheet.raster.height, sheet.raster.data));
      console.log(file);
      text = sheet.text;
    }
    writeFileSync(`${base}.txt`, text);
    for (const line of text.split('\n')) if (line.startsWith('seed ')) console.log(`  ${line}`);
  }
} finally {
  await server.close();
}
