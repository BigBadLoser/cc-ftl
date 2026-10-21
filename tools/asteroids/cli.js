#!/usr/bin/env node
/**
 * Asteroid contact sheets (sibling of tools/shipgen):
 *   node tools/asteroids/cli.js <big|field|all> [--from 1] [--count 12] [--scale 4] [--coverage open|mixed|dense] [--out dir]
 * Writes <out>/<kind>.png and .txt (one summary line per seed) and prints the paths.
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
const scale = Number(opt('scale', 4));
const coverage = opt('coverage');
const out = resolve(opt('out', 'tools/asteroids/out'));

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
  const lib = await server.ssrLoadModule('/tools/asteroids/sheet.ts');
  mkdirSync(out, { recursive: true });
  for (const kind of which === 'all' ? ['big', 'field'] : [which]) {
    const name = kind === 'big' && coverage ? `big-${coverage}` : kind;
    const sheet = lib.asteroidSheet(kind, from, count, scale, 2400, coverage);
    const base = join(out, name);
    writeFileSync(`${base}.png`, png(sheet.raster.width, sheet.raster.height, sheet.raster.data));
    writeFileSync(`${base}.txt`, sheet.text);
    console.log(`${base}.png`);
    process.stdout.write(sheet.text);
  }
} finally {
  await server.close();
}
