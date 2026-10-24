#!/usr/bin/env python3
"""Read-only terminal dashboard for the five parallel 2x sprite jobs.

Launch workers with: 2>&1 | tee /tmp/crew1.log (through crew4.log),
and 2>&1 | tee /tmp/families.log for the non-crew job.
Run: python3 tools/blender/sprites/progress.py
"""
import re
import time
import io
import curses
import subprocess
from contextlib import redirect_stdout
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
FAMILY_START = re.compile(r"^FAMILY_START (\\S+)$")
FAMILY_JOBS = re.compile(r"^FAMILY_JOBS (\\S+) (\\d+)$")
FAMILY_PROGRESS = re.compile(r"^FAMILY_PROGRESS (\\S+) (\\d+) (\\d+)$")
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


def active_renders():
    try:
        output = subprocess.check_output(
            ["ps", "-eo", "pid=,etime=,%cpu=,%mem=,args="],
            text=True, stderr=subprocess.DEVNULL, timeout=2)
    except (OSError, subprocess.SubprocessError):
        return []
    result = []
    for line in output.splitlines():
        fields = line.strip().split(None, 4)
        if len(fields) == 5 and "blender" in fields[4].lower() and "build_sprites.py" in fields[4]:
            result.append(fields)
    return result


def cache_count():
    cache = Path(__file__).resolve().parents[3] / ".cache/sprites/crew"
    return sum(1 for _ in cache.rglob("*.npz")) if cache.exists() else 0


def log_status(name):
    path = LOG_ROOT / name
    if not path.exists():
        return f"{name}: MISSING (needs /tmp/{name})"
    return f"{name}: {path.stat().st_size // 1024} KiB | last update {duration(time.time() - path.stat().st_mtime)} ago"


def family_progress():
    data = read_log(LOG_ROOT / "families.log")
    # Only the last run matters; tee usually truncates, but support appended logs.
    batch = data.rfind("FAMILY_BATCH ")
    if batch >= 0:
        data = data[batch:]
    completed = [m.group(1) for m in MANIFEST.finditer(data)]
    active = list(FAMILY_START.finditer(data))
    if not active:
        return completed, None, None
    name = active[-1].group(1)
    section = data[active[-1].end():]
    total_match = next((m for m in FAMILY_JOBS.finditer(section) if m.group(1) == name), None)
    if not total_match:
        return completed, name, None
    total = int(total_match.group(2))
    updates = [m for m in FAMILY_PROGRESS.finditer(section) if m.group(1) == name]
    done = int(updates[-1].group(2)) if updates else 0
    return completed, name, (done, total)


def dashboard():
    print("CC-FTL 2x sprite rendering  |  " + time.strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 78)
    processes = active_renders()
    print(f"ACTIVE RENDERS: {len(processes)} | Cached crew frames: {cache_count():,}")
    for pid, elapsed, cpu, mem, cmd in processes[:8]:
        job = "crew" if " crew " in cmd else "families"
        print(f"  PID {pid} | elapsed {elapsed} | CPU {cpu}% | RAM {mem}% | {job}")
    if not processes:
        print("  No active Blender sprite processes detected")
    print()
    print("CREW WORKERS")
    print("-" * 78)
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
              f"{w['done']:>6}/{w['total']:<6} {state} ETA {duration(estimated)}")
    if aggregate_total:
        fraction = aggregate_done / aggregate_total
        print(f"CREW  : {progress_bar(fraction)} {fraction:6.1%} "
              f"{aggregate_done:>6}/{aggregate_total:<6} (includes cache hits)")
    if crew_etas:
        print(f"Crew remaining (slowest worker): ~{duration(max(crew_etas))}")
    print()
    print("NON-CREW FAMILIES")
    print("-" * 78)
    finished, active, current = family_progress()
    n = len(set(finished).intersection(FAMILIES))
    print(f"Family batches: {progress_bar(n / len(FAMILIES))} "
          f"{n}/{len(FAMILIES)} complete (not weighted by render time)")
    if active:
        if current:
            done, total = current
            fraction = done / total if total else 1
            estimated = eta("family:" + active, done, total)
            print(f"Current: {active}  {progress_bar(fraction)} {fraction:6.1%} "
                  f"{done}/{total} jobs  ETA {duration(estimated)}")
            print("  Job progress counts completed build jobs; packing is separate.")
        else:
            print(f"Current: {active} | special renderer (no per-job counters available)")
    elif not finished:
        print("Waiting for family renderer progress logs.")
    if finished:
        print("Last completed: " + ", ".join(finished[-5:]))
    remaining = [f for f in FAMILIES if f not in set(finished)]
    if remaining:
        print("Upcoming: " + ", ".join(remaining[:5]))
    print()
    print("LOG HEALTH")
    print("-" * 78)
    for name in ["crew1.log", "crew2.log", "crew3.log", "crew4.log", "families.log"]:
        print("  " + log_status(name))
    print("Missing logs mean progress cannot be inferred from previous terminal output.")
    print()
    print("Crew: cached + rendered frames. Families: jobs within instrumented families;")
    print("special families (robots, aliens, sol, damage_sol) need separate counters.")
    print("Press q or Ctrl+C to exit; renders continue independently.")


def tui(stdscr):
    """Draw in-place in the alternate terminal screen without scrolling."""
    curses.curs_set(0)
    stdscr.nodelay(True)
    while True:
        capture = io.StringIO()
        with redirect_stdout(capture):
            dashboard()
        height, width = stdscr.getmaxyx()
        stdscr.erase()
        for y, line in enumerate(capture.getvalue().splitlines()[:height]):
            if width > 1:
                try:
                    stdscr.addnstr(y, 0, line, width - 1)
                except curses.error:
                    pass
        stdscr.refresh()
        for _ in range(50):
            key = stdscr.getch()
            if key in (ord("q"), ord("Q"), 3):
                return
            time.sleep(0.1)


if __name__ == "__main__":
    try:
        curses.wrapper(tui)
    except KeyboardInterrupt:
        pass
