#!/usr/bin/env bash
# Idempotent Ubuntu/Debian bootstrap for pinned CPU Blender.
set -euo pipefail
cd "$(dirname "$0")/../.."
export BLENDER_HOME="${BLENDER_HOME:-$HOME/tools}"
BINARY="$BLENDER_HOME/blender-4.2.9-linux-x64/blender"
if [[ ! -x "$BINARY" ]]; then
  if ! command -v apt-get >/dev/null; then
    echo 'Requires Debian/Ubuntu (apt-get).' >&2
    exit 1
  fi
  if [[ "$(id -u)" -eq 0 ]]; then APT=(apt-get); else APT=(sudo apt-get); fi
  export DEBIAN_FRONTEND=noninteractive
  "${APT[@]}" update
  "${APT[@]}" install -y --no-install-recommends \
    ca-certificates curl xz-utils git rsync tmux python3 \
    libx11-6 libxi6 libxrender1 libxext6 libxfixes3 libxrandr2 \
    libxkbcommon0 libxxf86vm1 libsm6 libgl1 libegl1 libxcb1 libxinerama1
fi
BINARY="$(tools/blender/setup.sh)"
"$BINARY" -b -t 1 --factory-startup --python-expr \
  'import bpy; print("Blender ready:", bpy.app.version_string)'
echo "Cloud render ready at $(pwd)"
