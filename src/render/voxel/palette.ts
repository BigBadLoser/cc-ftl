export interface PaletteEntry {
  /** sRGB hex. */
  color: number;
  /** Rendered unlit and picked up by bloom. */
  emissive?: boolean;
}

/** Named palette. Index 0 is reserved for "empty". */
const ENTRIES = {
  empty: { color: 0x000000 },
  steel: { color: 0x3b434e },
  steelD: { color: 0x252b34 },
  steelL: { color: 0x59646f },
  blueGrey: { color: 0x3a4757 },
  dark: { color: 0x12161b },
  rust: { color: 0x6e4129 },
  rustD: { color: 0x45291b },
  grime: { color: 0x23282e },
  hazY: { color: 0xc9a227 },
  hazK: { color: 0x14161a },
  plateA: { color: 0x2b3138 },
  plateB: { color: 0x2f353c },
  plateC: { color: 0x282d34 },
  seam: { color: 0x1f242a },
  bolt: { color: 0x3a4149 },
  cyan: { color: 0x19e6ff, emissive: true },
  magenta: { color: 0xff2fb4, emissive: true },
  orange: { color: 0xff7a1a, emissive: true },
  red: { color: 0xff1e2a, emissive: true },
} as const satisfies Record<string, PaletteEntry>;

export type PaletteName = keyof typeof ENTRIES;

const names = Object.keys(ENTRIES) as PaletteName[];

/** Palette name -> index, for use in voxel models. */
export const P = Object.fromEntries(names.map((n, i) => [n, i])) as { readonly [K in PaletteName]: number };

/** Entries by index. */
export const PALETTE: readonly PaletteEntry[] = names.map((n) => ENTRIES[n]);
