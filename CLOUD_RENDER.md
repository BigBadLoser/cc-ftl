# Cloud sprite rendering (CPU)

This is the repeatable cloud workflow for **CC-FTL 2x art** on the `art/cloud-render` branch, based on `art/scale-2x`. Works with Ubuntu/Debian virtual machines (including Hetzner's dedicated CPU cloud servers) and with local Linux / WSL. **No cloud vendor account or API key is required by the scripts**. Blender 4.2.9 and the original CPU Cycles settings are retained; the artwork quality and cache hashing do not change.

## Quick start on an existing Debian/Ubuntu server

Local requirements: `ssh`, `rsync`, and a local checkout of this branch. Server requirements: SSH access to a user with `sudo` privileges, adequate disk space (plan for several GB for render cache plus output).

```bash
git switch art/cloud-render
bash tools/cloud-render/remote.sh ubuntu@SERVER_IP launch
bash tools/cloud-render/remote.sh ubuntu@SERVER_IP watch
```

`launch` copies the source, installs system libraries and pinned Blender if necessary, then starts rendering in a detached `tmux` session. Exit the status TUI with `q` without stopping rendering. In the dashboard, percentages for non-crew **special** families (robots, aliens, Sol and damage_sol) are currently job-level only, not individual sprite-frame percentages.

Once the render completes:

```bash
bash tools/cloud-render/remote.sh ubuntu@SERVER_IP status
bash tools/cloud-render/remote.sh ubuntu@SERVER_IP fetch
bash tools/cloud-render/remote.sh ubuntu@SERVER_IP fetch-cache
git status --short
```

Review the images and manifest before committing. Remember that the game renderer and tests on the source branch do not yet understand 2x images (see the 2x rendering handoff document). **Do not merge the art branch into main until the runtime is updated.**

## Resume or rerun

The server stores checkpoints in `.cache/cloud-render/state.json`, per-job logs in `.cache/cloud-render/logs/`, content-keyed crew frame cache in `.cache/sprites/crew/`, and generated sprites in `public/assets/`. Re-running `launch` after the `tmux` session has finished resumes on the **same server**, skipping successfully completed family and crew clip jobs with the same source/scale signature. An interrupted job reruns; the crew cache saves the finished frames. If the source changes, job checkpoints are invalidated automatically (crew frame hashes still determine reusable entries).

Useful remote actions:

| Command (append to `bash tools/cloud-render/remote.sh ubuntu@SERVER_IP`) | Effect |
|---|---|
| `launch` | Sync, bootstrap, start detached job (refuses duplicate live sessions) |
| `deploy` | Sync source only, preserve caches and sprites |
| `bootstrap` | Install requirements + verify Blender |
| `watch` | Live terminal dashboard via SSH |
| `status` | Snapshot of workers and completion |
| `logs` | Tail orchestrator log |
| `stop` | Ask the render session to stop |
| `fetch` | Download `public/assets` |
| `fetch-cache` | Download crew frame cache for reuse later |
| `seed-cache` | Upload existing crew frame cache to server |

For a new server, `seed-cache` before `launch` to avoid rendering previously cached crew frames. Because family sprites do **not** have a per-job render cache, already completed family renders can only be resumed if the original server and its checkpoint/output directories still exist. Do not delete that VM until you have downloaded and verified the artifacts.

By default `launch` renders **all 32 non-crew families**, then packs all crew clips. The non-crew family writes are sequential to prevent concurrent manifest corruption. Each crew clip is assigned dynamically to the next available worker. Workers use the `--cache-only` option so they don't waste time packing disposable sheets.

## CPU allocation

The command automatically queries available CPU affinity, allocates one Blender process to the family queue and the remainder to crew clips, and divides the available render threads among those processes. On an 8-vCPU VM the default is **4 processes × 2 threads**. On a 16-vCPU VM the default is **6 processes × 2 threads**. This avoids the oversubscription of five Blender processes each using all available cores. (The operating system can still schedule Python setup/postprocessing on the same CPUs.)

Advanced manual control on the server:

```bash
python3 tools/cloud_render.py run --workers 4 --threads 2 --scale 2
python3 tools/cloud_render.py run --only crew
python3 tools/cloud_render.py run --only families
python3 tools/cloud_render.py run --fresh  # redo all jobs, reuse valid crew cache
python3 tools/cloud_render.py status --watch
```

Workers and thread limits must fit the available CPU affinity. Set `BLENDER_BIN` if Blender is installed elsewhere; otherwise use `BLENDER_HOME` (default `$HOME/tools`). The runner sets `ART_SCALE` and `SOL_THREADS` for its subprocesses. `SOL_DIR` is located in the cloud checkpoint directory for resumable Sol rendering. The supervisor is pure Python 3 standard library (it doesn't require `npm ci`).

## Safety and limitations

- `launch` uses `rsync --delete` for **source files only**. It excludes `.cache/` and `public/assets/` so previous output isn't erased. Keep source changes on your branch rather than editing server copies.
- It does not create/delete or bill cloud servers. Provision the VM using your provider; **destroy it manually after fetching outputs** to stop billing. A cloud farm like Fox Renderfarm uses a different frame submission workflow and is not directly compatible with this script-driven scene generator.
- Resume checkpoints represent successful **jobs**, not individual non-crew sprite renders. A partially complete family reruns from the beginning. Crew frames resume individually using their content hashes.
- Source changes invalidate completed-job checkpoints. If you manually delete cached files but keep `state.json`, run `--fresh` to force rechecking crew cache and rerendering missing family jobs.
- Source tree upload excludes `.git`, `node_modules`, `dist` and `.cache`. It includes art source files and assets required by Blender scripts.
- The console dashboard reports job-level progress and does not promise a deterministic overall ETA. For detailed failures read `.cache/cloud-render/logs/<job>.log`.
