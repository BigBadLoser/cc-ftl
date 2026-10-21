#!/usr/bin/env bash
# Run from a local checkout with SSH and rsync installed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 USER@SERVER launch|deploy|bootstrap|status|watch|logs|fetch|fetch-cache|seed-cache|stop" >&2
  exit 2
fi
HOST="$1"
ACTION="$2"
DIR="cc-ftl-cloud"
SESSION="ccftl-render"
case "$ACTION" in
  deploy|launch)
    if ssh "$HOST" "tmux has-session -t $SESSION 2>/dev/null"; then
      echo "Refusing to replace source while $SESSION is rendering. Stop it first." >&2
      exit 1
    fi
    ssh "$HOST" "mkdir -p $DIR"
    rsync -az --delete \
      --exclude='/.git/' --exclude='/node_modules/' --exclude='/dist/' \
      --exclude='/.cache/' --exclude='/public/assets/' \
      "$ROOT/" "$HOST:$DIR/"
    if [[ "$ACTION" == "deploy" ]]; then
      echo 'Source synced; .cache and public/assets preserved on server.'
      exit 0
    fi
    ;;
  bootstrap)
    ssh "$HOST" "cd $DIR && bash tools/cloud-render/bootstrap.sh"
    ;;
  status)
    ssh "$HOST" "cd $DIR && python3 tools/cloud_render.py status"
    ;;
  watch)
    ssh -t "$HOST" "cd $DIR && python3 tools/cloud_render.py status --watch"
    ;;
  logs)
    ssh -t "$HOST" "cd $DIR && tail -f .cache/cloud-render/supervisor.log"
    ;;
  fetch-cache)
    mkdir -p "$ROOT/.cache/sprites/crew"
    rsync -az --info=progress2 "$HOST:$DIR/.cache/sprites/crew/" "$ROOT/.cache/sprites/crew/"
    echo 'Downloaded crew render cache for future servers.'
    ;;
  seed-cache)
    if [[ ! -d "$ROOT/.cache/sprites/crew" ]]; then
      echo 'No local crew cache; nothing to upload.' >&2
      exit 1
    fi
    ssh "$HOST" "mkdir -p $DIR/.cache/sprites/crew"
    rsync -az --info=progress2 "$ROOT/.cache/sprites/crew/" "$HOST:$DIR/.cache/sprites/crew/"
    ;;
  fetch)
    mkdir -p "$ROOT/public/assets"
    rsync -az --info=progress2 "$HOST:$DIR/public/assets/" "$ROOT/public/assets/"
    echo 'Downloaded public/assets; inspect output and git status before committing.'
    ;;
  stop)
    ssh "$HOST" "tmux send-keys -t $SESSION C-c"
    ;;
  *) echo "Unknown action: $ACTION" >&2; exit 2 ;;
esac
if [[ "$ACTION" == "launch" ]]; then
  ssh "$HOST" "cd $DIR && bash tools/cloud-render/bootstrap.sh && mkdir -p .cache/cloud-render && if tmux has-session -t $SESSION 2>/dev/null; then echo 'Render session already running' >&2; exit 1; fi && tmux new-session -d -s $SESSION 'python3 tools/cloud_render.py run > .cache/cloud-render/supervisor.log 2>&1'"
  echo "Started detached render on $HOST. Monitor: $0 $HOST watch"
fi
