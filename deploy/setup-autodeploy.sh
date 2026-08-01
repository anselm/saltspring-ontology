#!/usr/bin/env bash
# One-time installer for on-VM continuous deployment. Run from the repo root:
#   deploy/setup-autodeploy.sh [vm-name]      (default: ontology)
#
# After this, the VM polls GitHub main every ~2 minutes and, when the SHA moves,
# pulls + rebuilds + syncs into /srv/site. Pushing to main IS the deploy;
# deploy/deploy.sh remains a manual override.
#
# Because the repo is private, this script also ensures the VM has an SSH
# keypair and registers its public key as a READ-ONLY deploy key on the GitHub
# repo (requires `gh` auth on the machine running this script).
set -euo pipefail

VM="${1:-${VM:-ontology}}"
HOST="$VM.exe.xyz"
DEST="exedev@$HOST"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GHREPO="orbitalfoundation/saltspring-ontology"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3)
SSH() { ssh "${SSH_OPTS[@]}" "$DEST" "$@"; }

echo "› installing Node 22 + git + rsync on $HOST"
SSH 'node -e "process.exit(+process.versions.node.split(\".\")[0] >= 20 ? 0 : 1)" 2>/dev/null || {
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - &&
  sudo apt-get install -y nodejs; }'
SSH 'sudo apt-get install -y -q git rsync'

echo "› ensuring VM deploy key + registering with GitHub"
SSH 'test -f ~/.ssh/id_ed25519 || ssh-keygen -t ed25519 -N "" -C "'"$VM"'-autodeploy" -f ~/.ssh/id_ed25519'
PUBKEY="$(SSH 'cat ~/.ssh/id_ed25519.pub')"
if ! gh repo deploy-key list -R "$GHREPO" | grep -qF "$(echo "$PUBKEY" | awk '{print $2}')"; then
  echo "$PUBKEY" | gh repo deploy-key add - -R "$GHREPO" --title "$VM-autodeploy (read-only)"
fi

echo "› creating /srv/autodeploy and uploading the deployer"
SSH 'sudo mkdir -p /srv/autodeploy && sudo chown exedev:exedev /srv/autodeploy'
rsync -e "ssh ${SSH_OPTS[*]}" -avh "$ROOT/deploy/autodeploy.sh" "$DEST:/srv/autodeploy/autodeploy.sh"
SSH 'chmod +x /srv/autodeploy/autodeploy.sh'

echo "› installing systemd service + timer"
SSH 'sudo tee /etc/systemd/system/ontology-autodeploy.service >/dev/null' <<'UNIT'
[Unit]
Description=Ontology — rebuild + redeploy when GitHub main changes
After=network-online.target

[Service]
Type=oneshot
User=exedev
ExecStart=/srv/autodeploy/autodeploy.sh
UNIT

# OnUnitInactiveSec re-arms only after the previous run finishes, so a slow
# build can never overlap the next poll.
SSH 'sudo tee /etc/systemd/system/ontology-autodeploy.timer >/dev/null' <<'UNIT'
[Unit]
Description=Poll GitHub main for Ontology deploys

[Timer]
OnBootSec=1min
OnUnitInactiveSec=2min

[Install]
WantedBy=timers.target
UNIT

SSH 'sudo systemctl daemon-reload && sudo systemctl enable --now ontology-autodeploy.timer'

echo "› first run (deploys current main now)"
SSH 'sudo systemctl start ontology-autodeploy.service'
SSH 'systemctl status ontology-autodeploy.timer --no-pager -l | head -6'

echo "✓ auto-deploy installed. Watch it with:"
echo "    ssh $DEST journalctl -u ontology-autodeploy -f"
