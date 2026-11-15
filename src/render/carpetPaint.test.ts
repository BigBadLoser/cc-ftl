import { describe, expect, it } from "vitest";
import { carpetPaintFor, PLAIN_PAINT } from "./hullArt";
import { SCHEMES } from "./roofArt";

const hls = (c: number): [number, number, number] => {
  const [r, g, b] = [16, 8, 0].map((s) => ((c >> s) & 255) / 255) as [number, number, number];
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2, d = hi - lo;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : hi === r ? (((g - b) / d + 6) % 6) * 60 : hi === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, l, s];
};

describe("carpetPaintFor", () => {
  it("keeps the scheme's hue at a fixed lightness, saturation capped", () => {
    for (const name of ["crimson", "tide", "orchid", "verdant", "hornet"]) {
      const [h0, , s0] = hls(SCHEMES[name]!.P);
      const [h, l, s] = hls(carpetPaintFor(name));
      expect(l).toBeCloseTo(0.3, 1);
      expect(s).toBeCloseTo(Math.min(s0, 0.45), 1);
      expect(Math.abs(h - h0)).toBeLessThan(4);
    }
  });

  it("is a plain grey for a near-grey main colour", () => {
    for (const name of ["sovereign", "ember"]) {
      const c = carpetPaintFor(name);
      const [r, g, b] = [16, 8, 0].map((s) => (c >> s) & 255);
      expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThanOrEqual(1);
    }
    expect(carpetPaintFor("sovereign")).toBe(0x4d4d4d);
  });

  it("falls back to the roof plating's blue, muted, with no livery", () => {
    expect(carpetPaintFor("")).toBe(carpetPaintFor("no-such-scheme"));
    const [h, l, s] = hls(carpetPaintFor(""));
    expect(h).toBeGreaterThan(195);
    expect(h).toBeLessThan(225);
    expect(l).toBeCloseTo(0.3, 1);
    expect(s).toBeLessThanOrEqual(0.45);
    expect(PLAIN_PAINT.carpet).toBe(carpetPaintFor(""));
  });
});
