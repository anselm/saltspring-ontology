#!/usr/bin/env bash
# Build the app and push it to the exe.dev VM. Manual override — normally the
# on-VM autodeploy (push to GitHub main) does this for you.
# Usage: deploy/deploy.sh [vm-name]         (default: ontology)
set -euo pipefail

VM="${1:-${VM:-ontology}}"
HOST="$VM.exe.xyz"
DEST="exedev@$HOST"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3"

echo "› building app/dist/"
( cd "$ROOT/app" && npm run build )

echo "› syncing app/dist/ → $HOST:/srv/site"
rsync -avh --delete -e "$SSH" "$ROOT/app/dist/" "$DEST:/srv/site/"

echo "✓ deployed → https://$HOST"
