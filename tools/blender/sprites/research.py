"""Research bench look studies (family `research`, preview only): every design's bench `.on` and `.holo` layer, r0.
The kit is research_kit.py; the designs are research_r2.py (d, e, f), research_r4.py (g, h, i;
round 3 in research_r3.py, whose helpers round 4 reuses) research_r5.py (j, k, l) and
research_r6.py (l1, l2, l3: variants of l), research_r7.py
(l2a, l2b, l2c: variants of l2) and
research_r8.py (r1, r2, r3: l2a with the front-left tile used),
research_r9.py (c1: the combined design),
research_r10.py (x1, y1: the 1x2 companions, a dissection table and a sample analyzer),
research_r11.py (x2-x4, y2-y4: the companions as machines),
research_r12.py (x5-x7, y5-y7: machines shaped by what they do), research_r13.py (x8, y8: empty machines built from blocks),
research_r14.py (x9, y9: a clean outline, the detail on the faces),
research_r15.py (x10, y10: a few shape moves, flush detail everywhere),
research_r16.py (x11-x13: three tables, each its own machine)."""
from .research_kit import BUILD, entry, holo_job


def jobs():
    out = []
    for v in BUILD():
        bench, _, fp = entry(v)
        out.append((f"module.research.{v}.on", fp, "prop", lambda b=bench: b("on")))
        out.append(holo_job(f"module.research.{v}.holo", v))
    return out
