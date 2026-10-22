#!/usr/bin/env python3
"""Resumable CPU-budgeted cloud sprite renderer. No third-party Python packages."""
import argparse
import curses
import hashlib
import json
import os
import queue
import re
import importlib
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_EXCEPTION

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / ".cache/cloud-render"
STATE_FILE = STATE_DIR / "state.json"
LOG_DIR = STATE_DIR / "logs"
OUT = ROOT / "public/assets"
FAMILIES = ("robots,aliens,env,walls,consoles,weapons,roof,robot_bay,vehicle_bay,"
            "shuttle,airlock,struct,fx,galley,derelict,eggsac,storage_set,medbay,"
            "battery,hydroponics,workbench,ops_consoles,cryo,wallprops,hazards,"
            "clutter,decay,corpse,damage,containers,sol,damage_sol").split(",")
SCENE = re.compile(r"CREW scene [\d.]+s; (\d+) entries, (\d+) cache hits, (\d+) misses")
RENDERED = re.compile(r"(?:^|\s)rendered (\d+)/(\d+)")
FPROGRESS = re.compile(r"^FAMILY_PROGRESS (\S+) (\d+) (\d+)$", re.M)
LOCK = threading.RLock()
LIVE = set()
STOP = threading.Event()


def cpu_budget():
    return len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else (os.cpu_count() or 2)


def clips():
    # crew_spec imports its siblings relatively (`from .scale import ...`), so load it as part of the `sprites` package.
    sys.path.insert(0, str(ROOT / "tools/blender"))
    try:
        spec = importlib.import_module("sprites.crew_spec")
    finally:
        sys.path.pop(0)
    return [row[0] for row in spec.CLIPS]


def source_key(scale):
    """Conservative source-change invalidation, without depending on git on the VM."""
    digest = hashlib.sha256(f"cloud-v1 scale={scale}\n".encode())
    root = ROOT / "tools/blender"
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in {".py", ".json", ".glb", ".blend", ".obj", ".mtl", ".csv", ".png"}:
            digest.update(str(path.relative_to(ROOT)).encode())
            with path.open("rb") as src:
                for block in iter(lambda: src.read(1024 * 1024), b""):
                    digest.update(block)
    palette = ROOT / "palette.json"
    if palette.exists():
        digest.update(palette.read_bytes())
    return digest.hexdigest()


def safe_name(name):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)


class RenderJobError(RuntimeError):
    pass


def signal_process_group(process, sig=signal.SIGTERM):
    """Blender can spawn nested Sol renders; stop its entire process group."""
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, sig)
    except ProcessLookupError:
        pass


class Runner:
    def __init__(self, args):
        self.args = args
        self.signature = source_key(args.scale)
        try:
            prior = json.loads(STATE_FILE.read_text())
        except (OSError, ValueError):
            prior = {}
        if prior.get("signature") != self.signature or args.fresh:
            if prior:
                print("Source/scale changed or --fresh: invalidating job checkpoints; keeping content-keyed crew cache.", flush=True)
            prior = {}
        self.state = {"signature": self.signature, "scale": args.scale,
                      "jobs": prior.get("jobs", {}), "started": time.time(),
                      "workers": args.workers, "threads": args.threads}
        self.blender = Path(os.environ.get(
            "BLENDER_BIN", str(Path(os.environ.get("BLENDER_HOME", str(Path.home() / "tools")))
                               / "blender-4.2.9-linux-x64/blender")))
        if not self.blender.is_file():
            raise RenderJobError(f"Blender missing: {self.blender}. Run tools/cloud-render/bootstrap.sh first.")
        self.environment = os.environ.copy()
        self.environment.update(ART_SCALE=str(args.scale), SOL_THREADS=str(args.threads),
                                SOL_DIR=str(STATE_DIR / f"sol-cache-{self.signature[:12]}"))
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        OUT.mkdir(parents=True, exist_ok=True)
        self.save()

    def save(self):
        with LOCK:
            tmp = STATE_FILE.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(self.state, indent=2, sort_keys=True))
            os.replace(tmp, STATE_FILE)

    def done(self, key):
        return self.state["jobs"].get(key, {}).get("status") == "done"

    def mark(self, key, status, error=None):
        with LOCK:
            record = self.state["jobs"].setdefault(key, {})
            record.update(status=status, updated=time.time())
            if status == "running":
                record["started"] = time.time()
            if error:
                record["error"] = str(error)
            else:
                record.pop("error", None)
            self.save()

    def run_blender(self, key, family, clip=None, threads=None):
        log = LOG_DIR / f"{safe_name(key)}.log"
        argv = [str(self.blender), "-b", "-t", str(threads or self.args.threads),
                "--factory-startup", "--python-exit-code", "1",
                "--python", "tools/blender/sprites/build_sprites.py", "--"]
        if clip is not None:
            argv += [str(STATE_DIR / "scratch" / safe_name(clip)), "crew", "--clip", clip, "--cache-only"]
        else:
            argv += [str(OUT), family]
        self.mark(key, "running")
        with log.open("w") as stream:
            stream.write("COMMAND " + " ".join(argv) + "\n")
            stream.flush()
            process = subprocess.Popen(argv, cwd=ROOT, env=self.environment,
                                       stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
            with LOCK:
                LIVE.add(process)
            try:
                while process.poll() is None:
                    if STOP.is_set():
                        signal_process_group(process)
                        try:
                            process.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            signal_process_group(process, signal.SIGKILL)
                            process.wait()
                        raise RenderJobError("Stopped")
                    time.sleep(0.5)
                if process.returncode:
                    raise RenderJobError(f"{key} failed (exit {process.returncode}); inspect {log}")
                self.mark(key, "done")
            except BaseException as exc:
                self.mark(key, "failed", exc)
                STOP.set()
                raise
            finally:
                with LOCK:
                    LIVE.discard(process)

    def family_loop(self):
        for family in FAMILIES:
            if STOP.is_set():
                return
            key = f"family:{family}"
            if self.done(key) and (OUT / "manifest.json").exists():
                continue
            self.run_blender(key, family)

    def crew_loop(self, work):
        while not STOP.is_set():
            try:
                clip = work.get_nowait()
            except queue.Empty:
                return
            try:
                key = f"crew:{clip}"
                # Content-addressed cache is authoritative; a completed job has
                # an on-disk checkpoint but missing cache files require --fresh.
                if not self.done(key):
                    self.run_blender(key, "crew", clip=clip)
            finally:
                work.task_done()

    def verify_outputs(self):
        path = OUT / "manifest.json"
        if not path.is_file():
            raise RenderJobError("Missing output manifest.json")
        manifest = json.loads(path.read_text())
        missing = []
        for sheet in manifest.get("sheets", {}).values():
            for prop in ("image", "glow"):
                if prop in sheet and not (OUT / sheet[prop]).is_file():
                    missing.append(sheet[prop])
        if missing:
            raise RenderJobError(f"{len(missing)} missing sprite files, e.g. {missing[:4]}")
        if manifest.get("tile", {}).get("w") != 64 * self.args.scale:
            raise RenderJobError("Manifest tile size does not match ART_SCALE")
        print(f"Verified manifest and {len(manifest.get('sheets', {}))} sprite sheets.", flush=True)

    def run(self):
        tasks = clips()
        want_crew = self.args.only in ("crew", "all")
        want_family = self.args.only in ("families", "all")
        work = queue.Queue()
        if want_crew:
            for clip in tasks:
                work.put(clip)
        crew_workers = self.args.workers - (1 if want_family else 0)
        if want_crew and crew_workers < 1:
            raise RenderJobError("Need at least one crew worker")
        futures = []
        try:
            with ThreadPoolExecutor(max_workers=self.args.workers) as pool:
                if want_family:
                    futures.append(pool.submit(self.family_loop))
                if want_crew:
                    futures.extend(pool.submit(self.crew_loop, work)
                                   for _ in range(min(crew_workers, len(tasks))))
                completed, _ = wait(futures, return_when=FIRST_EXCEPTION)
                for future in completed:
                    future.result()
                for future in futures:
                    future.result()
            if want_crew and not STOP.is_set():
                self.run_blender("pack:crew", "crew", threads=cpu_budget())
            if not STOP.is_set():
                self.verify_outputs()
            print("All selected sprite renders completed successfully.", flush=True)
        finally:
            STOP.set()
            with LOCK:
                for process in list(LIVE):
                    if process.poll() is None:
                        signal_process_group(process)


def job_detail(key):
    path = LOG_DIR / f"{safe_name(key)}.log"
    try:
        data = path.read_text(errors="replace")
    except OSError:
        return ""
    if key.startswith("crew:"):
        scenes = list(SCENE.finditer(data))
        if scenes:
            scene = scenes[-1]
            total, hits, misses = map(int, scene.groups())
            matches = list(RENDERED.finditer(data[scene.end():]))
            done = min(total, hits + (int(matches[-1].group(1)) if matches else 0))
            return f"{done}/{total} frames ({done / total:.0%})" if total else "0 frames"
    elif key.startswith("family:"):
        matches = [m for m in FPROGRESS.finditer(data) if m.group(1) == key[7:]]
        if matches:
            m = matches[-1]
            done, total = int(m.group(2)), int(m.group(3))
            return f"{done}/{total} jobs ({done / total:.0%})" if total else "0 jobs"
    return "initializing / packing"


def active_processes():
    try:
        output = subprocess.check_output(["ps", "-eo", "pid=,etime=,%cpu=,rss=,args="],
                                         text=True, stderr=subprocess.DEVNULL, timeout=3)
    except (OSError, subprocess.SubprocessError):
        return []
    result = []
    for row in output.splitlines():
        parts = row.strip().split(None, 4)
        if len(parts) != 5 or "blender" not in parts[4].lower() or "build_sprites.py" not in parts[4]:
            continue
        try:
            result.append((parts[0], parts[1], float(parts[2]), int(parts[3])))
        except ValueError:
            pass
    return result


def log_age(key):
    try:
        return max(0, int(time.time() - (LOG_DIR / f"{safe_name(key)}.log").stat().st_mtime))
    except OSError:
        return None


def compact_duration(seconds):
    if seconds is None:
        return "unknown"
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m"
    return f"{seconds // 3600}h{seconds % 3600 // 60:02}m"


def status_lines():
    try:
        state = json.loads(STATE_FILE.read_text())
    except (OSError, ValueError):
        return ["No cloud-render state found. Start with 'python3 tools/cloud_render.py run'."]
    jobs = state.get("jobs", {})
    processes = active_processes()
    lines = ["CC-FTL CLOUD RENDER     " + time.strftime("%Y-%m-%d %H:%M:%S"),
             f"Scale {state.get('scale')}x | {state.get('workers')} workers x {state.get('threads')} threads | Source {state.get('signature', '')[:10]}", ""]
    if processes:
        cpu = sum(p[2] for p in processes)
        ram = sum(p[3] for p in processes) / 1048576
        lines.append(f"BLENDER: {len(processes)} processes | CPU {cpu:.0f}% / {cpu_budget() * 100}% | RSS {ram:.2f} GiB")
    else:
        lines.append("BLENDER: no worker processes detected")
    lines.append("")
    for title, prefix, total in (("CREW CLIPS", "crew:", len(clips())),
                                 ("NON-CREW FAMILIES", "family:", len(FAMILIES))):
        subset = [(k, v) for k, v in jobs.items() if k.startswith(prefix)]
        done = sum(v.get("status") == "done" for k, v in subset)
        running = [(k, v) for k, v in subset if v.get("status") == "running"]
        failed = [(k, v) for k, v in subset if v.get("status") == "failed"]
        width = 28
        filled = round(width * done / total)
        lines.append(f"{title:20} [{'#' * filled}{'-' * (width - filled)}] {done}/{total}")
        for k, v in running:
            lines.append(f"  RUNNING {k[len(prefix):]:20} {job_detail(k)} | last log {compact_duration(log_age(k))} ago")
        for k, v in failed:
            lines.append(f"  FAILED  {k[len(prefix):]:20} {v.get('error', '')}")
        lines.append("")
    lines.append(f"CREW PACKING: {jobs.get('pack:crew', {}).get('status', 'pending')}")
    lines.append("Read individual logs under .cache/cloud-render/logs/")
    lines.append("Press q or Ctrl+C to leave dashboard (renders keep running).")
    return lines


def status_tui(scr):
    curses.curs_set(0)
    scr.nodelay(True)
    while True:
        scr.erase()
        h, w = scr.getmaxyx()
        for y, line in enumerate(status_lines()[:h]):
            if w > 1:
                try:
                    scr.addnstr(y, 0, line, w - 1)
                except curses.error:
                    pass
        scr.refresh()
        for _ in range(25):
            key = scr.getch()
            if key in (ord("q"), ord("Q"), 3):
                return
            time.sleep(0.2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="Render/resume all 2x sprites including crew")
    run.add_argument("--scale", type=int, choices=(1, 2), default=2)
    run.add_argument("--only", choices=("all", "crew", "families"), default="all")
    run.add_argument("--workers", type=int, default=None, help="Concurrent Blender processes")
    run.add_argument("--threads", type=int, default=None, help="Blender render threads per process")
    run.add_argument("--fresh", action="store_true", help="Redo jobs; valid crew cache reused")
    stat = sub.add_parser("status", help="Show progress")
    stat.add_argument("--watch", action="store_true", help="In-place TUI")
    args = parser.parse_args()
    if args.command == "status":
        if args.watch:
            curses.wrapper(status_tui)
        else:
            print("\n".join(status_lines()))
        return
    budget = cpu_budget()
    if args.workers is None:
        args.workers = 1 if args.only == "families" else (
            max(2, min(6, budget // 2)) if args.only == "all" else max(1, min(6, budget // 2)))
    if args.workers < (2 if args.only == "all" else 1):
        parser.error("--workers must be >=2 for all, or >=1 for crew/families")
    if args.threads is None:
        args.threads = max(1, budget // args.workers)
    if args.workers * args.threads > budget:
        parser.error(f"Requested {args.workers} x {args.threads} threads > {budget} CPUs")
    print(f"Cloud-render CPU budget: {budget}; Blender: {args.workers} processes x {args.threads} threads", flush=True)
    def interrupt(_signum, _frame):
        STOP.set()
        with LOCK:
            for process in list(LIVE):
                if process.poll() is None:
                    signal_process_group(process)
    signal.signal(signal.SIGINT, interrupt)
    signal.signal(signal.SIGTERM, interrupt)
    try:
        Runner(args).run()
    except (KeyboardInterrupt, RenderJobError) as exc:
        print(f"Render interrupted/failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
