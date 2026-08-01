#!/usr/bin/env bash
# Runs ON the ontology VM (installed by deploy/setup-autodeploy.sh, fired by a
# systemd timer). Polls GitHub main; when the SHA moves, pulls, rebuilds the
# app, and syncs app/dist/ into /srv/site — Caddy picks the new files up at once.
#
# The repo is PRIVATE: access is via a read-only GitHub deploy key registered
# for this VM's ~/.ssh/id_ed25519 (added with `gh repo deploy-key add`).
# Overlap-safe without a lockfile: the systemd timer re-arms only after the
# previous oneshot run finishes (OnUnitInactiveSec).
set -euo pipefail

REPO_URL="git@github.com:orbitalfoundation/ontology.git"
BRANCH="main"
BASE="/srv/autodeploy"
REPO="$BASE/repo"
STATE="$BASE/deployed-sha"
DEST="/srv/site"

export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new"

remote_sha="$(git ls-remote "$REPO_URL" "refs/heads/$BRANCH" | cut -f1)"
[ -n "$remote_sha" ] || { echo "could not read $BRANCH from $REPO_URL"; exit 1; }
deployed="$(cat "$STATE" 2>/dev/null || echo none)"
[ "$remote_sha" = "$deployed" ] && exit 0   # nothing new — the common case

echo "› main moved: $deployed -> $remote_sha"

if [ ! -d "$REPO/.git" ]; then
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$REPO"
fi
git -C "$REPO" fetch --depth 1 origin "$BRANCH"
git -C "$REPO" reset --hard FETCH_HEAD
git -C "$REPO" clean -fd   # drop stray files but keep ignored (node_modules/, dist/)

cd "$REPO/app"
echo "› npm ci (app)"
npm ci --no-audit --no-fund
echo "› build"
npm run build
echo "› sync -> $DEST"
rsync -a --delete dist/ "$DEST"/


# Keep the Caddy config current too; reload gracefully when it actually changed.
if [ -f "$REPO/deploy/Caddyfile" ] && ! cmp -s "$REPO/deploy/Caddyfile" /srv/Caddyfile 2>/dev/null; then
  cp "$REPO/deploy/Caddyfile" /srv/Caddyfile
  docker exec ontology caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null \
    || docker restart ontology >/dev/null
  echo "› Caddyfile changed — reloaded Caddy"
fi

echo "$remote_sha" > "$STATE"
echo "✓ deployed $remote_sha"
