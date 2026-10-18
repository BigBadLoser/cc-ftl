#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root. Each renderer imports its isolated variant.
height_blender="${BLENDER:-blender}"
height_python="${PYTHON:-python3}"
height_out="${1:-artifacts/wall-1.85-roof-2.05/rebuild}"
if [ -e "$height_out" ]; then
  echo "Choose a fresh output directory: $height_out already exists." >&2
  exit 1
fi
height_ai="tools/blender/experiments/ai_core_oracle_h185"
height_shields="tools/blender/experiments/shield_bastion_h185_ward_lowbody"
for height_part in beauty module roof-a roof-b context; do
  "$height_blender" -b -t 6 --factory-startup --python-exit-code 1 --python "$height_ai/render.py" -- --out "$height_out/ai-core" --part "$height_part" --save-blend
done
for height_size in large small; do
  "$height_blender" -b -t 6 --factory-startup --python-exit-code 1 --python "$height_shields/render.py" -- --out "$height_out/shields" --part beauty --size "$height_size" --save-blend
done
for height_part in modules roof-large-a roof-large-b roof-small-a roof-small-b context; do
  "$height_blender" -b -t 6 --factory-startup --python-exit-code 1 --python "$height_shields/render.py" -- --out "$height_out/shields" --part "$height_part"
done
"$height_python" "$height_ai/present.py" "$height_out/ai-core"
"$height_python" "$height_shields/present.py" "$height_out/shields"
"$height_python" tools/blender/experiments/height_185/compare.py "$height_out"
