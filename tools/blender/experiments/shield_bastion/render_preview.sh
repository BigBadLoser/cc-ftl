#!/usr/bin/env bash
set -euo pipefail
shield_blender="${BLENDER:-blender}"
shield_out="${1:-artifacts/shield-bastion/preview-fresh}"
shield_script="tools/blender/experiments/shield_bastion/render.py"
if [ -e "$shield_out" ]; then
  echo "Output exists: $shield_out. Choose a fresh directory." >&2
  exit 1
fi
for shield_part in modules roof-large-a roof-large-b roof-small-a roof-small-b context; do
  "$shield_blender" -b -t 6 --factory-startup --python-exit-code 1 --python "$shield_script" -- --out "$shield_out" --part "$shield_part"
done
for shield_size in large small; do
  "$shield_blender" -b -t 6 --factory-startup --python-exit-code 1 --python "$shield_script" -- --out "$shield_out" --part beauty --size "$shield_size" --save-blend
done
"${PYTHON:-python3}" tools/blender/experiments/shield_bastion/present.py "$shield_out"
