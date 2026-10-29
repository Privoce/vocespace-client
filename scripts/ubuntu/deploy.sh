#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SOURCE=$(cd "$HERE/../.." && pwd)
usage() {
  cat <<'HELP'
Usage: bash scripts/ubuntu/deploy.sh COMMAND [ROOT] [RELEASE]
  init      Create directories and API environment template (never overwrite).
  build     Copy this source tree to a NEW release, install and build.
  activate  Stop managed services, back up files/Redis, start RELEASE.
  rollback  Activate the previous release, retaining current business data.
  status    Show managed process status and local health checks.
ROOT defaults to /var/vocespace; RELEASE is required for activate.
Build options: WEB_PORT=3030 API_PORT=3031 NEXT_PUBLIC_BASE_PATH=
Activation: REDIS_BACKUP_HOOK=/absolute/executable (optional provider backup).
Never changes Caddy, LiveKit, Redis configuration, or unrelated PM2 apps.
HELP
}
COMMAND=${1:-help}
if [[ $COMMAND = help || $COMMAND = --help || $COMMAND = -h ]]; then usage; exit 0; fi
case $COMMAND in init|build|activate|rollback|status) ;; *) usage >&2; exit 1 ;; esac
ROOT=${2:-/var/vocespace}
[[ $(uname -s) = Linux && -f /etc/os-release ]] || { echo 'Run on Ubuntu.' >&2; exit 1; }
. /etc/os-release
[[ $ID = ubuntu ]] || { echo 'Run on Ubuntu.' >&2; exit 1; }
[[ $ROOT = /* && $ROOT != / && -d $ROOT && -w $ROOT ]] || { echo 'Run setup.sh first with an absolute writable ROOT.' >&2; exit 1; }
ROOT=$(cd "$ROOT" && pwd -P)
[[ $ROOT != "$SOURCE/"* ]] || { echo "Deployment ROOT must not be inside the source tree." >&2; exit 1; }
if [[ -f $ROOT/tools/env.sh ]]; then . "$ROOT/tools/env.sh"; fi
for tool in node pnpm pm2 rsync flock curl tar; do command -v "$tool" >/dev/null || { echo "Missing: $tool; run setup.sh" >&2; exit 1; }; done
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
HELPER="$HERE/deploy-tools.mjs"
DATA="$ROOT/api-data"
node "$HELPER" versions "$SOURCE"
mkdir -p "$ROOT/releases" "$ROOT/backups" "$DATA"
case $COMMAND in
  init)
    if [[ ! -e $DATA/vocespace.conf.json ]]; then
      cp "$SOURCE/vocespace.conf.example.json" "$DATA/vocespace.conf.json"
      chmod 600 "$DATA/vocespace.conf.json"
    fi
    echo "Edit $DATA/vocespace.conf.json. For migration, preserve the existing JSON/data and merge legacy env once with scripts/config.mjs."
    exit 0 ;;
  status)
    pm2 describe vocespace-api || true
    pm2 describe vocespace-web || true
    if [[ -L $ROOT/current ]]; then node "$HELPER" health "$(readlink -f "$ROOT/current")"; fi
    exit 0 ;;
  build)
    RELEASE=${3:-$(date -u +%Y%m%dT%H%M%SZ)}
    [[ $RELEASE =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || { echo 'Invalid release name.' >&2; exit 1; }
    DEST="$ROOT/releases/$RELEASE"
    [[ ! -e $DEST ]] || { echo 'Release exists; choose a new name. Never rebuild a running release.' >&2; exit 1; }
    # Explicit build inputs; do not copy root config, uploads, env, or deployment secrets.
    mkdir "$DEST"
    for input in apps packages services scripts patches package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .nvmrc .eslintrc.json .prettierrc .prettierignore LICENSE vocespace.conf.example.json; do
      rsync -a --safe-links --exclude-from="$HERE/source.exclude" "$SOURCE/$input" "$DEST/"
    done
    node "$HELPER" configure "$DEST" "$ROOT"
    (
      cd "$DEST"
      unset NODE_ENV
      pnpm install --frozen-lockfile
      pnpm check:boundaries
      pnpm build
      pnpm check:deployment
    )
    node "$HELPER" artifacts "$DEST"
    touch "$DEST/.deploy-ready"
    echo "Built $RELEASE. Activate: bash scripts/ubuntu/deploy.sh activate '$ROOT' '$RELEASE'"
    exit 0 ;;
esac
OLD=''
for pointer in current previous; do
  [[ ! -e $ROOT/$pointer || -L $ROOT/$pointer ]] || { echo "$ROOT/$pointer must be a release symlink." >&2; exit 1; }
done
if [[ -L $ROOT/current ]]; then
  OLD=$(readlink -f "$ROOT/current")
  [[ $OLD = "$ROOT/releases/"* && -f $OLD/.deploy-ready ]] || { echo 'Current release is missing or outside ROOT/releases.' >&2; exit 1; }
  node "$HELPER" artifacts "$OLD"
fi
if [[ $COMMAND = rollback ]]; then
  [[ -L $ROOT/previous ]] || { echo 'No previous release.' >&2; exit 1; }
  TARGET=$(readlink -f "$ROOT/previous")
else
  RELEASE=${3:?Release name required}
  [[ $RELEASE =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || { echo 'Invalid release name.' >&2; exit 1; }
  TARGET="$ROOT/releases/$RELEASE"
fi
[[ $TARGET = "$ROOT/releases/"* && -d $TARGET && ! -L $TARGET && -f $TARGET/.deploy-ready ]] || { echo 'Target must be a completed release in ROOT/releases.' >&2; exit 1; }
[[ $TARGET != "$OLD" ]] || { echo 'This release is already current.' >&2; exit 1; }
node "$HELPER" artifacts "$TARGET"
node "$HELPER" preflight "$TARGET" "$ROOT"
node "$HELPER" managed "$OLD"
if [[ -n ${REDIS_BACKUP_HOOK:-} ]]; then
  [[ $REDIS_BACKUP_HOOK = /* && -x $REDIS_BACKUP_HOOK ]] || { echo 'Backup hook must be an absolute executable.' >&2; exit 1; }
fi
if [[ -z $OLD ]]; then node "$HELPER" ports "$TARGET"; fi
BACKUP=$(mktemp -d "$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")
# On any failure after stopping, restore the old process registration, never data.
restore_on_failure() {
  code=$?
  trap - EXIT INT TERM
  if [[ $code -ne 0 ]]; then
    echo "Activation failed. Backup: $BACKUP. Restoring previous processes; data is not rolled back." >&2
    pm2 delete vocespace-web >/dev/null 2>&1 || true
    pm2 delete vocespace-api >/dev/null 2>&1 || true
    if [[ -n $OLD ]]; then
      if pm2 start "$OLD/ecosystem.config.cjs" --only vocespace-api &&
         pm2 start "$OLD/ecosystem.config.cjs" --only vocespace-web &&
         node "$HELPER" health "$OLD"; then
        pm2 save
      else
        echo "Automatic recovery failed. Check PM2 logs and $OLD/ecosystem.config.cjs." >&2
      fi
    else
      pm2 save --force || true
    fi
  fi
  exit "$code"
}
trap restore_on_failure EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ -n $OLD ]]; then
  # managed verified these names belong to OLD; no wildcard stop or cluster reload.
  pm2 stop vocespace-web
  pm2 stop vocespace-api
fi
node "$HELPER" ports "$TARGET"
tar -czf "$BACKUP/api-data.tar.gz" -C "$DATA" .
if [[ -n ${REDIS_BACKUP_HOOK:-} ]]; then
  "$REDIS_BACKUP_HOOK" "$BACKUP" "$DATA"
else
  node "$HELPER" backup-redis "$TARGET" "$ROOT" "$BACKUP"
fi
if [[ -n $OLD ]]; then
  pm2 delete vocespace-web
  pm2 delete vocespace-api
fi
pm2 start "$TARGET/ecosystem.config.cjs" --only vocespace-api
node "$HELPER" health "$TARGET" api
pm2 start "$TARGET/ecosystem.config.cjs" --only vocespace-web
node "$HELPER" health "$TARGET"
pm2 save
# Update links only after both services pass; keep releases and backups for manual retention.
if [[ -n $OLD ]]; then ln -sfn "$OLD" "$ROOT/.previous.new"; mv -Tf "$ROOT/.previous.new" "$ROOT/previous"; fi
ln -sfn "$TARGET" "$ROOT/.current.new"
mv -Tf "$ROOT/.current.new" "$ROOT/current"
trap - EXIT INT TERM
echo "Active: $TARGET"
echo "Backup: $BACKUP (API files + Redis when configured). Caddy was not modified."
