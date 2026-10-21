#!/usr/bin/env python3
"""Read-only terminal dashboard for the five parallel ART_SCALE=2 sprite jobs.

Launch workers with: 2>&1 | tee /tmp/crew1.log (through crew4.log),
and 2>&1 | tee /tmp/families.log for the non-crew job.
Run: python3 tools/blender/sprites/progress.py
"""
import re
import time
from datetime import timedelta
from pathlib import Path

LOG_ROOT = Path("/tmp")
FAMILIES = ("robots,aliens,env,walls,consoles,weapons,roof,robot_bay,vehicle_bay,"
            "shuttle,airlock,struct,fx,galley,derelict,eggsac,storage_set,medbay,"
            "battery,hydroponics,workbench,ops_consoles,cryo,wallprops,hazards,"
            "clutter,decay,corpse,damage,containers,sol,damage_sol").split(",")
SCENE = re.compile(r"CREW scene ([\d.]+)s; (\d+) entries, (\d+) cache hits, (\d+) misses")
RENDER = re.compile(r"(?:^|\s)rendered (\d+)/(\d+)")
PACK = re.compile(r"CREW pack .* hits (\d+) misses (\d+)")
MANIFEST = re.compile(r"^MANIFEST (\S+)")
BAR_WIDTH = 24
OBSERVED = {}


def read_log(path):
    try:
        return path.read_text(errors="replace")
    except FileNotFoundError:
        return ""


def duration(seconds):
    if seconds is None:
        return "—"
    return str(timedelta(seconds=max(0, int(seconds))))


def progress_bar(fraction):
    filled = round(max(0, min(1, fraction)) * BAR_WIDTH)
    return "[" + "#" * filled + "-" * (BAR_WIDTH - filled) + "]"


def crew_worker(number):
    path = LOG_ROOT / f"crew{number}.log"
    data = read_log(path)
    scenes = list(SCENE.finditer(data))
    if not scenes:
        return None
    # Use the latest run if logs were appended rather than overwritten.
    scene = scenes[-1]
    section = data[scene.end():]
    total, hits, misses = map(int, scene.group(2, 3, 4))
    renders = list(RENDER.finditer(section))
    rendered = int(renders[-1].group(1)) if renders else 0
    complete = bool(PACK.search(section))
    if complete:
        rendered = misses
    done = min(total, hits + rendered)
    # Render rates use render time since the scene planning message.
    # Scene setup is excluded from the estimate, and packing is not included.
    age = max(0, time.time() - path.stat().st_mtime)
    return dict(total=total, done=done, misses=misses, rendered=rendered,
                complete=complete, age=age)


def eta(key, done, total):
    now = time.monotonic()
    old = OBSERVED.get(key)
    if old is None or done < old[1]:
        OBSERVED[key] = (now, done)
        return None
    elapsed, advance = now - old[0], done - old[1]
    if advance <= 0 or elapsed < 2:
        return None
    return (total - done) * elapsed / advance


def dashboard():
    print("CC-FTL 2x sprite rendering  |  " + time.strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 78)
    aggregate_done = aggregate_total = 0
    crew_etas = []
    for n in range(1, 5):
        w = crew_worker(n)
        if w is None:
            print(f"Crew {n}: waiting for /tmp/crew{n}.log (or scene initialization)")
            continue
        aggregate_done += w["done"]
        aggregate_total += w["total"]
        fraction = w["done"] / w["total"] if w["total"] else 1
        state = "COMPLETE" if w["complete"] else ("packing" if w["done"] == w["total"] else "rendering")
        estimated = 0 if w["complete"] else eta(f"crew{n}", w["done"], w["total"])
        if estimated is not None:
            crew_etas.append(estimated)
        print(f"Crew {n}: {progress_bar(fraction)} {fraction:6.1%} "
              f"{w['done']:>6}/{w['total']:<6} {state}")
    if aggregate_total:
        fraction = aggregate_done / aggregate_total
        print(f"CREW  : {progress_bar(fraction)} {fraction:6.1%} "
              f"{aggregate_done:>6}/{aggregate_total:<6} (includes cache hits)")
    print()
    family_log = read_log(LOG_ROOT / "families.log")
    finished = [m.group(1) for m in MANIFEST.finditer(family_log)]
    family_set = set(finished)
    n = len(family_set.intersection(FAMILIES))
    print(f"Families: {progress_bar(n / len(FAMILIES))} "
          f"{n}/{len(FAMILIES)} complete (family count, not render-time weighted)")
    if finished:
        print("Last completed: " + ", ".join(finished[-5:]))
    remaining = [f for f in FAMILIES if f not in family_set]
    if remaining:
        print("Next/uncompleted: " + ", ".join(remaining[:5]))
    print()
    print("Crew percentage is exact for the logged work plan; families are counted by")
    print("completed batches. ETA is not shown: family sizes vary, and crew logs provide")
    print("not duration. ETA needs observed progress and is approximate.")
    print("Press Ctrl+C to exit dashboard; renders continue independently.")


if __name__ == "__main__":
    try:
        while True:
            print("\033[2J\033[H", end="")
            dashboard()
            time.sleep(5)
    except KeyboardInterrupt:
        print()
