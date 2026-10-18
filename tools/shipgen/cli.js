#!/usr/bin/env node
/**
 * Ship layout contact sheets without Blender or sprite art.
 *   node tools/shipgen/cli.js <faction|all> [--from 1] [--count 12] [--depth 0] [--out dir] [--scale 10]
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
  const factions = which === 'all' ? lib.factionIds() : [which.startsWith('faction.') ? which : `faction.${which}`];
  for (const f of factions) {
    const { raster, text } = lib.contactSheet(f, from, count, depth, scale);
    const base = join(out, `${f.replace('faction.', '')}-d${depth}`);
    writeFileSync(`${base}.png`, png(raster.width, raster.height, raster.data));
    writeFileSync(`${base}.txt`, text);
    console.log(`${base}.png`);
    for (const line of text.split('\n')) if (line.startsWith('seed ')) console.log(`  ${line}`);
  }
} finally {
  await server.close();
}
