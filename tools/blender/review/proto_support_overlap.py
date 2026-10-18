"""Overlap + floating + footprint check for the support-module prototypes and their roof parts (Blender, no render):
  blender -b --factory-startup --python tools/blender/review/proto_support_overlap.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import cmbkit, core, overlap
from sprites import support_proto as S
from sprites.console_proto import centre

src = Path(__file__).with_name("proto_console_overlap.py").read_text()
ns = {"__name__": "pco", "__file__": __file__}
exec(compile(src.split("def run(")[0], "pco", "exec"), ns)
gap = ns["gap"]
GAP = 0.03
ALLOW = [("screen", "body"), ("screen", "panel"), ("panel", "body"), ("lights", "body"), ("lights", "panel"), ("lights", "core"), ("lights", "tower"),
         ("core", "body"), ("tower", "body"), ("screen", "tower"), ("panel", "tower"), ("rlight", "rdish"), ("rspire", "rdish"), ("rlight", "rspire"),
         ("rtip", "rmast"), ("rpylon", "rlight"), ("rdish", "rbase"), ("rmast", "rbase"), ("rspire", "rbase")]


def floating(parts, z0):
    ok = [p for p in parts if gap(p, p)[1][0][2] <= z0 + 0.02]
    rest = [p for p in parts if p not in ok]
    ch = True
    while ch:
        ch = False
        for p in rest[:]:
            if any(gap(p, q)[0] <= GAP for q in ok):
                ok.append(p)
                rest.remove(p)
                ch = True
    return rest


def run(name, rot, roof):
    nu, nv = S.FOOT[name]
    rec = cmbkit.REC = overlap.Recorder()
    f = cmbkit.Frame(core.Mesh("chk"), rot, centre=centre(rot, nu, nv))
    S.READOUTS.clear()
    (S.ROOF if roof else S.BUILD)[name](f, True)
    cmbkit.REC = None
    for w, h, m, bars in S.READOUTS:
        for x0, x1, t0, t1 in bars:
            if x0 < -w / 2 + m - 1e-6 or x1 > w / 2 - m + 1e-6 or t0 < m - 1e-6 or t1 > h - m + 1e-6 or min(x1 - x0, t1 - t0) < 0.039:
                print("READOUT GLYPH OUT OF BOUNDS", name, x0, x1, t0, t1)
    print(f"== {name} r{rot} {'ROOF' if roof else 'module'}: {len(rec.parts)} parts, readouts {len(S.READOUTS)}")
    overlap.report(rec.parts, ALLOW)
    for p in floating(rec.parts, S.ZR if roof else 0.0):
        print("FLOATING", p["group"], p["src"], gap(p, p)[1])
    a, b = f.pt(-nu / 2, -nv / 2, 0), f.pt(nu / 2, nv / 2, 0)
    lo = [min(a[i], b[i]) - 0.02 for i in range(2)]
    hi = [max(a[i], b[i]) + 0.02 for i in range(2)]
    tallest = 0
    for p in rec.parts:
        l, h = gap(p, p)[1]
        tallest = max(tallest, h[2])
        if any(l[i] < lo[i] - 0.005 or h[i] > hi[i] + 0.005 for i in range(2)):
            print("OUTSIDE FOOTPRINT", p["group"], p["src"], [round(x, 2) for x in l], [round(x, 2) for x in h], lo, hi)
    print("top z", round(tallest, 2))


for n in S.BUILD:
    for r in (0, 1):
        for roof in (False, True):
            run(n, r, roof)
