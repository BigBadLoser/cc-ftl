import type { UiFightLine, UiFightReport } from '../api';

export interface LossRow {
  name: string;
  n: number;
  state: 'DESTROYED' | 'DAMAGED' | 'DOWN' | 'DEAD';
  tone: 'bad' | 'warn';
  dot: boolean;
  subject: UiFightLine['subject'];
}

/** Your losses as rows: destroyed, damaged, down, dead. Lines with the same name and state fold into one row ("Light ×2"), whichever event they came from; the first one's subject is the click target. */
export function lossRows(r: Pick<UiFightReport, 'lost' | 'damaged' | 'down' | 'dead'>): LossRow[] {
  const out: LossRow[] = [];
  const add = (lines: UiFightLine[], state: LossRow['state'], tone: LossRow['tone'], dot: boolean) => {
    for (const l of lines) {
      const hit = out.find((o) => o.name === l.name && o.state === state);
      if (hit) hit.n++;
      else out.push({ name: l.name, n: 1, state, tone, dot, subject: l.subject });
    }
  };
  add(r.lost, 'DESTROYED', 'bad', false);
  add(r.damaged, 'DAMAGED', 'warn', false);
  add(r.down, 'DOWN', 'warn', true);
  add(r.dead, 'DEAD', 'bad', true);
  return out;
}
