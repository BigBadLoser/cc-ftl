#!/usr/bin/env bash
# Future full render of approved stage 7. Does not install production assets.
set -euo pipefail

if [[ $# -ne 1 || "$1" == "--help" ]]; then
  echo 'Usage: BLENDER_BIN=/path/to/blender PYTHON_BIN=python3 bash render_all.sh NEW_OUTPUT_DIRECTORY'
  echo 'Set KESTREL_BEAUTY=1 to also render all eight Blender views and save scenes.'
  exit 0
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/../../../.." && pwd)"
cd "$REPO_DIR"
BLENDER_BIN="${BLENDER_BIN:-blender}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
THREADS="${KESTREL_THREADS:-6}"
OUT="$1"

command -v "$BLENDER_BIN" >/dev/null
command -v "$PYTHON_BIN" >/dev/null
"$PYTHON_BIN" -c 'import numpy; import PIL'
if [[ -e "$OUT" || -L "$OUT" ]]; then
  echo "Output already exists; choose a fresh directory: $OUT" >&2
  exit 1
fi
mkdir -p -- "$OUT"

# Separate sequential Blender jobs keep memory use and job durations bounded.
for rot in 0 1 2 3; do
  "$BLENDER_BIN" -b -t "$THREADS" --factory-startup --python-exit-code 1 \
    --python "$SCRIPT_DIR/render.py" -- \
    --out "$OUT" --stage 7 --rot "$rot" --no-beauty
done
"$BLENDER_BIN" -b -t "$THREADS" --factory-startup --python-exit-code 1 \
  --python "$SCRIPT_DIR/validate.py" -- "$OUT" --require-complete
"$PYTHON_BIN" "$SCRIPT_DIR/present.py" "$OUT"

if [[ "${KESTREL_BEAUTY:-0}" == "1" ]]; then
  for rot in 0 1 2 3; do
    for state in idle active; do
      "$BLENDER_BIN" -b -t "$THREADS" --factory-startup --python-exit-code 1 \
        --python "$SCRIPT_DIR/render.py" -- \
        --out "$OUT" --stage 7 --rot "$rot" --no-sprites \
        --beauty-state "$state" --save-blend
    done
  done
fi

echo "Approved Kestrel renders written to $OUT; production assets were not installed."
