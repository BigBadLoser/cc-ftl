#!/usr/bin/env bash
# Install a pinned headless Blender for the asset pipeline (idempotent).
# Usage: tools/blender/setup.sh   -> prints the blender binary path.
set -euo pipefail
VERSION=4.2.9
DIR="${BLENDER_HOME:-/opt/tools}/blender-${VERSION}-linux-x64"
if [ ! -x "$DIR/blender" ]; then
  mkdir -p "$(dirname "$DIR")"
  curl -sSL "https://download.blender.org/release/Blender4.2/blender-${VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C "$(dirname "$DIR")"
fi
echo "$DIR/blender"
