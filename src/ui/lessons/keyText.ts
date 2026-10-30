/** A line of lesson text split into runs: plain text, `[key]` badges and `**strong**` words ("Press [Q] to **arm**"). */
export type TextRun = { kind: 'text' | 'key' | 'strong'; text: string };

export function keyText(s: string): TextRun[] {
  const out: TextRun[] = [];
  const re = /\[([^\]]+)\]|\*\*([^*]+)\*\*/g;
  let at = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > at) out.push({ kind: 'text', text: s.slice(at, m.index) });
    out.push(m[1] !== undefined ? { kind: 'key', text: m[1] } : { kind: 'strong', text: m[2]! });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ kind: 'text', text: s.slice(at) });
  return out;
}
