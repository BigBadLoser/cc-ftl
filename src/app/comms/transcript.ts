import type { CommsLine } from '../../ui/comms/types';

/**
 * The adapter from story text to a transcript: the text is cut on its quotes. What is outside the quotes is narration; each quoted run is a line
 * said by `speaker` (who may flicker to `speakerAlt`). `{caller}` in the text is replaced by `caller`. Text with no quotes is one narration line.
 */
export function transcriptOf(text: string, speaker: { name: string; alt?: string }, caller?: string): CommsLine[] {
  const t = caller === undefined ? text : text.replaceAll('{caller}', caller);
  const out: CommsLine[] = [];
  const re = /"([^"]*)"/g;
  let at = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const before = t.slice(at, m.index).trim();
    if (before) out.push({ kind: 'narration', text: before });
    out.push({ kind: 'speech', text: (m[1] ?? '').trim(), speaker: speaker.name, ...(speaker.alt ? { speakerAlt: speaker.alt } : {}) });
    at = m.index + m[0].length;
  }
  const rest = t.slice(at).trim();
  if (rest) out.push({ kind: 'narration', text: rest });
  return out;
}
