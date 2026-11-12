#!/usr/bin/env node
/**
 * Station flow diagrams (dev tool): the department graphs of docs/STATIONFLOWS.md drawn as SVG, one panel a flow, for
 * review before any geometry. A flow is topology only: departments (what they hold, how they are entered) and typed
 * links. Positions on the page are for reading, not a layout.
 *   node tools/shipgen/flows.js [--out dir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const out = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : 'tools/shipgen/out/flows');
mkdirSync(out, { recursive: true });

const TINT = { harbour: '#508ce1', habitation: '#69b95a', commons: '#e187cd', freight: '#c39650', secure: '#e15546', defence: '#965fb9', space: '#3a3f4b' };
// The trading station program (planStation, seed 1): what each department must hold. Shops are not in the plan today.
const ROOMS = {
  harbour: ['docks x3-5', 'customs post (new)', 'harbour office', 'armoury 9x3'],
  market: ['shops (count to be planned)', 'court / rotunda'],
  freight: ['warehouse 9x7 + 10x7', 'holds x5 (4x3 to 7x5)'],
  habitation: ['cabins x20 (5 blocks)', 'mess 7x5, galley 8x3', 'medbay 9x4'],
  secure: ['guard post (new)', 'reactors x2', 'shields 7x6 x2', 'AI core'],
  defence: ['gun bays x5', '(no hull face needed)'],
};
const node = (id, dept, title, access, x, y, rooms = ROOMS[id] ?? []) => ({ id, dept, title, access, x, y, rooms });
// Link kinds: concourse (public, 3 wide), corridor (public, 2 wide), service (staff, 1 wide), dock, inside (same block).
const FLOWS = [
  {
    name: 'A. Harbour and market', note: 'One harbour. Everything arriving passes customs, then the concourse to a market round the central court.',
    nodes: [
      node('space', 'space', 'ships', '', 450, 40, []), node('harbour', 'harbour', 'Harbour', 'controlled: customs', 450, 150),
      node('market', 'commons', 'Market + court', 'open: storefronts on the court', 450, 330), node('freight', 'freight', 'Freight', 'open: warehouse', 760, 190),
      node('habitation', 'habitation', 'Habitation', 'open: cabins on the ring', 450, 510), node('secure', 'secure', 'Secure core', 'controlled: guard post', 140, 330),
      node('defence', 'defence', 'Defence', 'inside secure', 140, 500),
    ],
    links: [
      ['space', 'harbour', 'dock'], ['harbour', 'market', 'concourse', 'customs'], ['market', 'habitation', 'corridor'], ['market', 'freight', 'corridor'],
      ['harbour', 'freight', 'service', 'cargo route'], ['market', 'secure', 'corridor', 'guard post'], ['secure', 'defence', 'inside'],
    ],
  },
  {
    name: 'B. Market street', note: 'No central court. Shops line both sides of the concourse from the harbour to a small rotunda; small stations.',
    nodes: [
      node('space', 'space', 'ships', '', 450, 40, []), node('harbour', 'harbour', 'Harbour', 'controlled: customs', 450, 150),
      node('market', 'commons', 'Market street', 'open: storefronts on the concourse', 450, 310, ['shops both sides', 'of the concourse']),
      node('rotunda', 'commons', 'Rotunda', 'open', 450, 440, ['small court']), node('freight', 'freight', 'Freight', 'open: warehouse', 760, 190),
      node('habitation', 'habitation', 'Habitation', 'open: cabins on the ring', 700, 500), node('secure', 'secure', 'Secure core', 'controlled: guard post', 190, 500),
      node('defence', 'defence', 'Defence', 'inside secure', 140, 330),
    ],
    links: [
      ['space', 'harbour', 'dock'], ['harbour', 'market', 'concourse', 'customs'], ['market', 'rotunda', 'concourse'], ['rotunda', 'habitation', 'corridor'],
      ['rotunda', 'secure', 'corridor', 'guard post'], ['harbour', 'freight', 'service', 'cargo route'], ['freight', 'habitation', 'corridor'], ['secure', 'defence', 'inside'],
    ],
  },
  {
    name: 'C. Two harbours', note: 'Passengers and freight arrive apart: the warehouse has its own dock and customs, cargo never crosses the market.',
    nodes: [
      node('space', 'space', 'passenger ships', '', 300, 40, []), node('harbour', 'harbour', 'Passenger harbour', 'controlled: customs', 300, 150, ['docks x2-3', 'customs post', 'harbour office']),
      node('space2', 'space', 'freighters', '', 760, 40, []), node('fharbour', 'harbour', 'Freight dock', 'controlled: customs', 760, 150, ['docks x1-2', 'customs post', 'armoury 9x3']),
      node('freight', 'freight', 'Freight', 'open: warehouse', 760, 320), node('market', 'commons', 'Market + court', 'open: storefronts on the court', 300, 330),
      node('habitation', 'habitation', 'Habitation', 'open: cabins on the ring', 300, 510), node('secure', 'secure', 'Secure core', 'controlled: guard post', 560, 500),
      node('defence', 'defence', 'Defence', 'inside secure', 785, 510),
    ],
    links: [
      ['space', 'harbour', 'dock'], ['space2', 'fharbour', 'dock'], ['harbour', 'market', 'concourse', 'customs'], ['fharbour', 'freight', 'concourse', 'customs'],
      ['freight', 'market', 'service', 'shop deliveries'], ['market', 'habitation', 'corridor'], ['habitation', 'secure', 'corridor', 'guard post'], ['secure', 'defence', 'inside'],
      ['freight', 'secure', 'service'],
    ],
  },
];

const W = 900, H = 600, BW = 210;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const boxH = (n) => (n.dept === 'space' ? 30 : 44 + n.rooms.length * 15);
const STYLE = { concourse: ['#f2f2f2', 7, ''], corridor: ['#c9ced8', 3.5, ''], service: ['#c9ced8', 2, '7 6'], dock: ['#8fb4ff', 3, '2 5'], inside: ['#8a8f9c', 2, ''] };

function panel(f) {
  const by = Object.fromEntries(f.nodes.map((n) => [n.id, n]));
  let s = `<rect width="${W}" height="${H}" fill="#10121a"/><text x="24" y="34" fill="#f2f2f2" font-size="20" font-weight="700">${esc(f.name)}</text>`;
  s += `<text x="24" y="${H - 16}" fill="#aab0bd" font-size="13">${esc(f.note)}</text>`;
  const gates = [];
  // Where the segment from a node's centre leaves its box, as a fraction of the way to the other node.
  const exit = (n, o) => {
    const w = (n.dept === 'space' ? 150 : BW) / 2, h = boxH(n) / 2, dx = Math.abs(o.x - n.x), dy = Math.abs(o.y - n.y);
    return Math.min(dx ? w / dx : 1, dy ? h / dy : 1);
  };
  for (const [a, b, kind, gate] of f.links) {
    const A = by[a], B = by[b], [col, w, dash] = STYLE[kind];
    s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    if (gate) gates.push({ A, B, kind, gate });
  }
  for (const n of f.nodes) {
    const h = boxH(n), w = n.dept === 'space' ? 150 : BW, x = n.x - w / 2, y = n.y - h / 2;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#191c26" stroke="${TINT[n.dept]}" stroke-width="${n.dept === 'space' ? 1.5 : 3}"/>`;
    if (n.dept === 'space') { s += `<text x="${n.x}" y="${n.y + 5}" fill="#aab0bd" font-size="13" text-anchor="middle">${esc(n.title)}</text>`; continue; }
    s += `<rect x="${x}" y="${y}" width="${w}" height="22" rx="8" fill="${TINT[n.dept]}"/><text x="${x + 10}" y="${y + 16}" fill="#10121a" font-size="14" font-weight="700">${esc(n.title)}</text>`;
    s += `<text x="${x + 10}" y="${y + 37}" fill="#ffd23c" font-size="11">${esc(n.access)}</text>`;
    n.rooms.forEach((r, i) => { s += `<text x="${x + 10}" y="${y + 53 + i * 15}" fill="#e6e8ee" font-size="12">${esc(r)}</text>`; });
  }
  // Gates and notes go on the visible part of their link, drawn over the boxes' edges: a guard on the controlled side.
  for (const { A, B, gate } of gates) {
    const t0 = exit(A, B), t1 = 1 - exit(B, A), guard = gate === 'customs' || gate === 'guard post';
    const t = !guard ? (t0 + t1) / 2 : B.access.startsWith('controlled') && !A.access.startsWith('controlled') ? t1 - (t1 - t0) * 0.25 : t0 + (t1 - t0) * 0.25;
    const gx = A.x + (B.x - A.x) * t, gy = A.y + (B.y - A.y) * t;
    if (guard) s += `<rect x="${gx - 8}" y="${gy - 8}" width="16" height="16" transform="rotate(45 ${gx} ${gy})" fill="#ffd23c" stroke="#10121a" stroke-width="2"/>`;
    // Beside the diamond on a vertical link, above it on a horizontal one (so the text clears the boxes).
    const flat = Math.abs(B.x - A.x) > Math.abs(B.y - A.y), side = guard && !flat;
    const label = `<text x="${gx + (side ? 16 : 0)}" y="${gy + (side ? 4 : guard ? -15 : -8)}" fill="${guard ? '#ffd23c' : '#aab0bd'}" font-size="12" font-style="${guard ? 'normal' : 'italic'}"${side ? '' : ' text-anchor="middle"'}>${esc(gate)}</text>`;
    s += label;
  }
  return s;
}

const KEY_H = 46;
const key = Object.entries({ 'concourse, public, 3 wide': 'concourse', 'corridor, public, 2 wide': 'corridor', 'service, staff, 1 wide': 'service', dock: 'dock' })
  .map(([label, kind], i) => {
    const [col, w, dash] = STYLE[kind], x = 24 + i * 230;
    return `<line x1="${x}" y1="22" x2="${x + 44}" y2="22" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/><text x="${x + 54}" y="27" fill="#e6e8ee" font-size="13">${label}</text>`;
  }).join('') + `<rect x="${24 + 4 * 230 - 30}" y="14" width="16" height="16" transform="rotate(45 ${24 + 4 * 230 - 22} 22)" fill="#ffd23c"/><text x="${24 + 4 * 230}" y="27" fill="#e6e8ee" font-size="13">guarded entrance (the only way in)</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * FLOWS.length} ${H + KEY_H}" font-family="Verdana, sans-serif">`
  + `<rect width="${W * FLOWS.length}" height="${H + KEY_H}" fill="#10121a"/>`
  + FLOWS.map((f, i) => `<g transform="translate(${i * W} 0)">${panel(f)}</g>`).join('')
  + `<g transform="translate(0 ${H})">${key}</g></svg>`;
writeFileSync(join(out, 'trading-flows.svg'), svg);
console.log(`wrote ${join(out, 'trading-flows.svg')}`);
