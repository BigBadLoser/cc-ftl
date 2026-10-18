#!/usr/bin/env bash
# Isolated low-sample AIRLOCK review. No game atlas or content writes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
OUT="${1:-$ROOT/artifacts/airlock-preview}"
BLENDER_BIN="${BLENDER_BIN:-blender}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
mkdir -p "$OUT"
cd "$ROOT"
"$BLENDER_BIN" -b -t 4 --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/airlock/validate.py -- "$OUT" --geometry
"$BLENDER_BIN" -b -t 4 --factory-startup --python-exit-code 1 \
  --python tools/blender/experiments/airlock/render.py -- \
  --out "$OUT" --rot 0 1 --part all --samples 4
"$PYTHON_BIN" tools/blender/experiments/airlock/present.py "$OUT"
"$PYTHON_BIN" tools/blender/experiments/airlock/validate.py "$OUT"
