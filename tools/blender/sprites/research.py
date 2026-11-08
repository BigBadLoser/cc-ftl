"""Research bench look studies (family `research`, preview only): every design's bench `.on` and `.holo` layer, r0.
The kit is research_kit.py; the designs are research_r2.py (d, e, f) and research_r3.py (g, h, i)."""
from .research_kit import BUILD, FP, holo_job


def jobs():
    out = []
    for v, (bench, _) in BUILD().items():
        out.append((f"module.research.{v}.on", FP, "prop", lambda b=bench: b("on")))
        out.append(holo_job(f"module.research.{v}.holo", v))
    return out
