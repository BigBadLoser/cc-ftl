/** A step's text split into plain runs and `[key]` badges: "Press [Q] to arm" → text, key Q, text. */
export type TextRun = { key: boolean; text: string };

export function keyText(s: string): TextRun[] {
  const out: TextRun[] = [];
  const re = /\[([^\]]+)\]/g;
  let at = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > at) out.push({ key: false, text: s.slice(at, m.index) });
    out.push({ key: true, text: m[1]! });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ key: false, text: s.slice(at) });
  return out;
}
