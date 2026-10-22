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
bash tools/cloud-render/remote.sh ubuntu@SERVER_IP verify
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
| `verify` | Confirm every job finished and every manifest sprite file exists |\n| `fetch` | Download sprites and verify every SHA256 checksum against the server |\n| `archive` | Package verified sprites as a server-side tarball for SFTP |
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

## Verified downloads and temporary servers

After rendering completes, the remote command `verify` requires all 32 non-crew families, all crew clips and final crew packing to finish successfully. It also checks that all manifest-referenced sprite sheets exist and the tile dimensions match ART_SCALE=2.

```bash
bash tools/cloud-render/remote.sh root@SERVER_IP verify
bash tools/cloud-render/remote.sh root@SERVER_IP fetch
bash tools/cloud-render/remote.sh root@SERVER_IP fetch-cache
```

The `fetch` command generates a SHA256 inventory on Vultr, downloads `public/assets` with resumable rsync and checks every image and manifest against that inventory. It returns an error on corruption or incomplete output. Do **not** destroy the server before it prints `Verified download complete` and you have inspected your local output.

### Phone / SFTP download

For temporary access from a phone, run this in your server SSH terminal:

```bash
cd ~/cc-ftl-cloud
python3 tools/cloud-render/verify_assets.py --require-complete --write .cache/cloud-render/assets.sha256
tar -czf .cache/cloud-render/assets.tar.gz -C public assets
ls -lh .cache/cloud-render/assets.tar.gz
```

Alternatively, from a local checkout run `bash tools/cloud-render/remote.sh root@SERVER_IP archive`. This creates `~/cc-ftl-cloud/.cache/cloud-render/assets.tar.gz` for download with an SFTP client. Also download `assets.sha256` if you want to verify extracted images later. **Creating the archive on the server is not a backup**; download it and check the extracted contents before deleting the Vultr instance. The archive excludes the reusable crew render cache.

### Deployment safety

`deploy` and `launch` preserve remote `.cache` and `public/assets`, do not delete unknown remote source files, and refuse to overwrite source while the named render tmux session is present. Source changes still invalidate checkpoints, so deploy changes while idle; transfer the current cache before replacing a disposable instance.

## Deploy entirely from a phone (GitHub Actions + Vultr API)

The `.github/workflows/vultr-render-launch.yml` workflow provisions a fresh Vultr Ubuntu 24.04 VM and deploys the renderer over SSH with no existing instance or computer required. It takes the Vultr plan ID and region as inputs. It does **not** automatically delete the instance or back up the render results.

**One-time setup:**

1. Enable the Vultr API in your Vultr account, create a token, and confirm its allowed IPs permit GitHub-hosted Actions runners. Broad API access is sensitive; remove it after use.
2. Add an SSH public key to Vultr and copy its Vultr SSH key ID. Keep the matching private key.
3. In GitHub repository Settings → Secrets and variables → Actions, add three repository secrets:
   - `VULTR_API_KEY`: Vultr API token.
   - `VULTR_SSH_KEY_ID`: ID of the registered Vultr public SSH key.
   - `CLOUD_RENDER_SSH_PRIVATE_KEY`: corresponding private SSH key (multiline).
4. GitHub requires a manually triggered workflow to exist on the repository's **default branch**. Only the launch workflow YAML needs to be copied/cherry-picked to the default branch (it explicitly checks out `art/cloud-render`). Keep the actual rendering code on the art branch. Do not merge the entire art branch into the default branch just to activate the workflow.
5. From GitHub Mobile or mobile Safari: repository → Actions → Launch Vultr Render → Run workflow. Enter your available Vultr plan ID and region (default `ewr`).

The workflow refuses to create a second instance with the same label, provisions Ubuntu 24.04, waits for SSH, syncs source from `art/cloud-render`, bootstraps Blender, and starts the renderer in tmux. GitHub's workflow summary gives you the created instance ID/IP. The instance can still be running and accruing charges **even if the workflow fails**—check Vultr and delete failed instances manually.

**Finish:** Once complete, use the documented verified `fetch` from a computer, or `archive` and SFTP from your phone. Download and verify everything before deleting the VM in Vultr.

The workflow expects the default root SSH user of a standard Vultr Ubuntu image and Ubuntu 24.04 OS ID `2284`. If these values differ on your Vultr account, adjust the YAML. The specific plan ID must be copied from Vultr's available plans; the workflow does not assume a plan exists in every region.
