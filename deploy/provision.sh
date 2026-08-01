#!/usr/bin/env bash
# One-time provisioning for the Ontology VM on exe.dev. Idempotent — safe to
# re-run; it just (re)starts Caddy. Creating the VM and making it public are
# separate steps (see devlog/20260727-staging.md).
# Usage: deploy/provision.sh [vm-name]      (default: ontology)
set -euo pipefail

VM="${1:-${VM:-ontology}}"
HOST="$VM.exe.xyz"
DEST="exedev@$HOST"                 # login user on exe.dev VMs is always 'exedev'
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8000}"                # VMs default to proxy_port 8000

SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3"

echo "› ensuring /srv on $HOST"
$SSH "$DEST" 'sudo mkdir -p /srv/site && sudo chown -R "$(id -un)":"$(id -gn)" /srv'

echo "› uploading Caddyfile"
rsync -e "$SSH" "$HERE/Caddyfile" "$DEST:/srv/Caddyfile"

echo "› enabling docker at boot + (re)starting Caddy on :$PORT"
$SSH "$DEST" "sudo systemctl enable --now docker >/dev/null 2>&1; \
  docker rm -f ontology 2>/dev/null || true; \
  docker run -d --name ontology --restart unless-stopped \
    -p $PORT:80 \
    -v /srv/site:/srv/site:ro \
    -v /srv/Caddyfile:/etc/caddy/Caddyfile:ro \
    caddy:2"

cat <<EOF
✓ provisioned ($HOST). The VM is PRIVATE until you make it public:
    ssh -o ServerAliveInterval=5 exe.dev share port $VM $PORT
    ssh -o ServerAliveInterval=5 exe.dev share set-public $VM
Then run deploy/deploy.sh $VM.
EOF
