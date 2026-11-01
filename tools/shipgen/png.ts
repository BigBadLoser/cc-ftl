/** Plain PNG encode/decode for the bench tools (8-bit RGBA, all five scanline filters on decode). Dev tool only. */
import { deflateSync, inflateSync } from 'node:zlib';

export interface Image { width: number; height: number; data: Uint8Array }

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export function encodePng(img: Image): Buffer {
  const { width, height, data } = img;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const chunk = (type: string, d: Buffer): Buffer => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(type), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function decodePng(file: Buffer): Image {
  let pos = 8;
  let width = 0, height = 0;
  const idat: Buffer[] = [];
  while (pos < file.length) {
    const len = file.readUInt32BE(pos);
    const type = file.toString('latin1', pos + 4, pos + 8);
    const body = file.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error('png: only 8-bit RGBA, non-interlaced');
    } else if (type === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)] as number;
    for (let i = 0; i < stride; i++) {
      const v = raw[y * (stride + 1) + 1 + i] as number;
      const a = i >= 4 ? (out[y * stride + i - 4] as number) : 0;
      const b = y > 0 ? (out[(y - 1) * stride + i] as number) : 0;
      const c = i >= 4 && y > 0 ? (out[(y - 1) * stride + i - 4] as number) : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * stride + i] = (v + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth)) & 255;
    }
  }
  return { width, height, data: out };
}
