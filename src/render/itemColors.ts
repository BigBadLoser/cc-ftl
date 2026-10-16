const KNOWN: Record<string, number> = {
  'item.scrap': 0xa9774f,
  'item.metal': 0xc3ccd6,
  'item.electronics': 0x55e6ff,
  'item.polymer': 0xff9a3c,
  'item.ice': 0xcdeeff,
};

/** Tint for an item id (TODO: per-item sprites). Unknown ids get a stable hue from the id. */
export function itemColor(id: string): number {
  const known = KNOWN[id];
  if (known !== undefined) return known;
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = (h % 360) / 360;
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    return Math.round(255 * (0.65 - 0.3 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}
