// Same math as diffuseStep (Jacobi) and mixPairs (phased in place), on a W x H grid. kind: 0 wall, 1 floor, 2 space (fixed 0).
function build(W, H, kind) {
  const links = [];
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i - x) / W;
    const add = (j, ph) => { const a = kind[i], b = kind[j]; if (!a || !b || (a === 2 && b === 2)) return; links.push({ i, j, air: (a === 2 ? 1 : 0) | (b === 2 ? 2 : 0), ph }); };
    if (x < W - 1) add(i + 1, x & 1);
    if (y < H - 1) add(i + W, 2 + (y & 1));
  }
  const phased = [0, 1, 2, 3].map((p) => links.filter((l) => l.ph === p));
  return { links, phased };
}
const K = 0.2, KV = 0.25;
function jacobi(L, v) { const d = new Float64Array(v.length); for (const { i, j, air } of L.links) { const k = air ? KV : K; const q = k * (v[i] - v[j]); if (!(air & 1)) d[i] -= q; if (!(air & 2)) d[j] += q; } for (let i = 0; i < v.length; i++) v[i] = Math.max(0, v[i] + d[i]); }
function pairs(L, v, rev, k = K, kv = KV) { for (let q = 0; q < 4; q++) for (const { i, j, air } of L.phased[rev ? 3 - q : q]) { const kk = air ? kv : k; const d = kk * (v[i] - v[j]); if (!(air & 1)) v[i] -= d; if (!(air & 2)) v[j] += d; } }
const ROT = [[0,1,2,3],[3,2,1,0],[2,3,0,1],[1,0,3,2]];
const ROT2 = [[0,1,2,3],[1,0,3,2],[2,3,0,1],[3,2,1,0],[3,2,1,0],[2,3,0,1],[1,0,3,2],[0,1,2,3]];
const ord = (L, v, o, k, kv) => { for (const p of o) for (const { i, j, air } of L.phased[p]) { const kk = air ? kv : k; const d = kk * (v[i] - v[j]); if (!(air & 1)) v[i] -= d; if (!(air & 2)) v[j] += d; } };
const solvers = {
  'jacobi x2 (now)': (L, v, t) => { jacobi(L, v); jacobi(L, v); },
  'x2 s.88 fwd/rev': (L, v, t) => { ord(L, v, [0,1,2,3], .176, .22); ord(L, v, [3,2,1,0], .176, .22); },
  'x2 s.88 rot4': (L, v, t) => { ord(L, v, ROT[(2*t)%4], .176, .22); ord(L, v, ROT[(2*t+1)%4], .176, .22); },
  'x2 s.88 rot8': (L, v, t) => { ord(L, v, ROT2[(2*t)%8], .176, .22); ord(L, v, ROT2[(2*t+1)%8], .176, .22); },
};
function room(W, H) { const kind = new Uint8Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) kind[y * W + x] = 1; return kind; }
const mean = (v, kind) => { let s = 0, n = 0; for (let i = 0; i < v.length; i++) if (kind[i] === 1) { s += v[i]; n++; } return s / n; };
for (const [name, step] of Object.entries(solvers)) {
  // A: 10x10 room, one hull tile opened to space
  const W = 12, H = 12; let kind = room(W, H); kind[6 * W + 0] = 2; kind[6 * W + 1 - 1] = 2;
  let L = build(W, H, kind); let v = new Float64Array(W * H).map((_, i) => (kind[i] === 1 ? 21 : 0));
  let t50 = 0, t10 = 0; for (let t = 1; t < 20000 && !t10; t++) { step(L, v, t); const m = mean(v, kind); if (!t50 && m < 10.5) t50 = t; if (m < 2.1) t10 = t; }
  // B: two 8x8 rooms, one door tile between, left full, right empty
  const W2 = 19, H2 = 10; const k2 = new Uint8Array(W2 * H2); for (let y = 1; y < 9; y++) for (let x = 1; x < 18; x++) if (x !== 9) k2[y * W2 + x] = 1; k2[5 * W2 + 9] = 1;
  const L2 = build(W2, H2, k2); const v2 = new Float64Array(W2 * H2).map((_, i) => (k2[i] === 1 && i % W2 < 9 ? 21 : 0));
  let teq = 0; for (let t = 1; t < 20000 && !teq; t++) { step(L2, v2, t); let l = 0, r = 0; for (let y = 1; y < 9; y++) { l += v2[y * W2 + 4]; r += v2[y * W2 + 14]; } if (Math.abs(l - r) / (l + r) < 0.05) teq = t; }
  // C: bias — point source in 21x21, after 20 ticks compare mass right vs left, down vs up; and total mass drift
  const W3 = 23; const k3 = room(W3, W3); const L3 = build(W3, W3, k3); const v3 = new Float64Array(W3 * W3); v3[11 * W3 + 11] = 1000;
  for (let t = 1; t <= 20; t++) step(L3, v3, t);
  let lft = 0, rgt = 0, up = 0, dn = 0, tot = 0; for (let i = 0; i < v3.length; i++) { const x = i % W3, y = (i - x) / W3; tot += v3[i]; if (x < 11) lft += v3[i]; if (x > 11) rgt += v3[i]; if (y < 11) up += v3[i]; if (y > 11) dn += v3[i]; }
  console.log(`${name.padEnd(16)} breach 50%: ${String(t50).padStart(5)} ticks, 90%: ${String(t10).padStart(5)} | rooms equal: ${String(teq).padStart(5)} | bias R/L ${(rgt / lft).toFixed(4)} D/U ${(dn / up).toFixed(4)} | mass err ${(tot - 1000).toExponential(1)}`);
}
