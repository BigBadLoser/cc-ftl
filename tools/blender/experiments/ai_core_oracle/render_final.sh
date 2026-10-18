#!/usr/bin/env bash
# Isolated final pack; refuse to mix an older output with this run.
set -euo pipefail
oracle_blender="${BLENDER:-blender}"
oracle_out="${1:-artifacts/ai-core-oracle/final}"
if [ -e "$oracle_out" ]; then
  echo "Output already exists: $oracle_out; choose a fresh directory." >&2
  exit 1
fi
oracle_script="tools/blender/experiments/ai_core_oracle/render.py"
for oracle_rot in 0 1 2 3; do
  "$oracle_blender" -b -t 6 --factory-startup --python-exit-code 1 --python "$oracle_script" -- --out "$oracle_out" --part module --rot "$oracle_rot" --quality final
done
for oracle_part in roof-a roof-b context beauty; do
  "$oracle_blender" -b -t 6 --factory-startup --python-exit-code 1 --python "$oracle_script" -- --out "$oracle_out" --part "$oracle_part" --quality final --save-blend
done
"${PYTHON:-python3}" tools/blender/experiments/ai_core_oracle/present.py "$oracle_out"
