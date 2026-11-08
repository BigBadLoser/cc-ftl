"""Research bench look studies (family `research`, preview only): every design's bench `.on` and `.holo` layer, r0.
The kit is research_kit.py; the designs are research_r2.py (d, e, f), research_r4.py (g, h, i;
round 3 in research_r3.py, whose helpers round 4 reuses) and research_r5.py (j, k, l)."""
from .research_kit import BUILD, FP, holo_job


def jobs():
    out = []
    for v, (bench, _) in BUILD().items():
        out.append((f"module.research.{v}.on", FP, "prop", lambda b=bench: b("on")))
        out.append(holo_job(f"module.research.{v}.holo", v))
    return out
