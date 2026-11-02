#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SOURCE=$(cd "$HERE/../.." && pwd)
usage() {
  cat <<'HELP'
Usage: bash scripts/ubuntu/deploy.sh COMMAND [ROOT] [RELEASE] [-p web|api|all]
  init      Create directories and JSON configuration template (never overwrite).
  build     Copy this source tree to a NEW release, install and build.
  activate  Stop managed services, back up local files, start RELEASE.
  rollback  Activate the previous release, retaining current business data.
  status    Show managed process status and local health checks.
ROOT defaults to /var/vocespace; RELEASE is required for activate.
-p / --project selects build, activation, rollback or status (default: all).
Accepts web, api, @vocespace/web, @vocespace/api, or all.
Example: build /var/vocespace/main web-002 -p web
Use the same -p selection when activating a partial release.
Build settings: ROOT/api-data/vocespace.conf.json (deployment section).
Never changes Caddy, LiveKit, Redis configuration, or unrelated PM2 apps.
HELP
}
COMMAND=${1:-help}
if [[ $COMMAND = help || $COMMAND = --help || $COMMAND = -h ]]; then usage; exit 0; fi
case $COMMAND in init|build|activate|rollback|status) ;; *) usage >&2; exit 1 ;; esac
shift
POSITIONAL=()
PROJECT=all
PROJECT_SET=false
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--project)
      [[ $# -ge 2 && $PROJECT_SET = false ]] || { echo 'Specify -p once with a project name.' >&2; exit 1; }
      PROJECT=$2; PROJECT_SET=true; shift 2 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
case $PROJECT in
  all) PROJECTS=(api web) ;;
  api|@vocespace/api) PROJECTS=(api); PROJECT=api ;;
  web|@vocespace/web) PROJECTS=(web); PROJECT=web ;;
  *) echo "Unknown deployable project: $PROJECT (use web, api or all)." >&2; exit 1 ;;
esac
[[ ${#POSITIONAL[@]} -le 2 ]] || { usage >&2; exit 1; }
ROOT=${POSITIONAL[0]:-/var/vocespace}
RELEASE=${POSITIONAL[1]:-}
[[ $COMMAND = build || $COMMAND = activate || -z $RELEASE ]] || { echo 'This command does not take a release name.' >&2; exit 1; }
[[ $COMMAND != init || $PROJECT_SET = false ]] || { echo 'init does not take -p.' >&2; exit 1; }
if [[ $COMMAND = activate && -z $RELEASE ]]; then echo 'Release name required.' >&2; exit 1; fi
if [[ -n $RELEASE && ! $RELEASE =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then echo 'Invalid release name.' >&2; exit 1; fi
[[ $(uname -s) = Linux && -f /etc/os-release ]] || { echo 'Run on Ubuntu.' >&2; exit 1; }
. /etc/os-release
[[ $ID = ubuntu ]] || { echo 'Run on Ubuntu.' >&2; exit 1; }
[[ $ROOT = /* && $ROOT != / && -d $ROOT && -w $ROOT ]] || { echo 'Run setup.sh first with an absolute writable ROOT.' >&2; exit 1; }
ROOT=$(cd "$ROOT" && pwd -P)
[[ $ROOT != "$SOURCE" && $ROOT != "$SOURCE/"* ]] || { echo "Deployment ROOT must not be inside the source tree." >&2; exit 1; }
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
    ROWS=$(node "$HELPER" status "$ROOT" "$PROJECT")
    while IFS=$'\t' read -r project current previous; do
      echo "$project: current=$current previous=$previous"
      pm2 describe "vocespace-$project" || true
      if [[ $current != - ]]; then node "$HELPER" health "$current" "$project"; fi
    done <<< "$ROWS"
    exit 0 ;;
  build)
    RELEASE=${RELEASE:-$(date -u +%Y%m%dT%H%M%SZ)}
    [[ $RELEASE =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || { echo 'Invalid release name.' >&2; exit 1; }
    DEST="$ROOT/releases/$RELEASE"
    [[ ! -e $DEST ]] || { echo 'Release exists; choose a new name. Never rebuild a running release.' >&2; exit 1; }
    # Explicit build inputs; do not copy root config, uploads, env, or deployment secrets.
    mkdir "$DEST"
    for input in packages scripts patches package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .nvmrc .eslintrc.json .prettierrc .prettierignore LICENSE vocespace.conf.example.json; do
      rsync -a --safe-links --exclude-from="$HERE/source.exclude" "$SOURCE/$input" "$DEST/"
    done
    # Keep workspace manifests for the frozen lockfile/boundary checks, but do not
    # copy unrelated application sources or assets (including Mobile).
    node "$HELPER" manifests "$SOURCE" "$DEST"
    for project in "${PROJECTS[@]}"; do
      case $project in api) directory=services/api ;; web) directory=apps/web ;; esac
      rsync -a --safe-links --exclude-from="$HERE/source.exclude" --exclude=/public/license/ "$SOURCE/$directory/" "$DEST/$directory/"
    done
    node "$HELPER" configure "$DEST" "$ROOT" "$PROJECT"
    (
      cd "$DEST"
      unset NODE_ENV
      FILTERS=(--filter vocespace)
      for project in "${PROJECTS[@]}"; do FILTERS+=(--filter "@vocespace/$project..."); done
      # pnpm peer deduplication can otherwise expand a filtered workspace install.
      pnpm "${FILTERS[@]}" install --frozen-lockfile --config.dedupe-peer-dependents=false
      pnpm check:boundaries
      for project in "${PROJECTS[@]}"; do pnpm "build:$project"; done
      pnpm check:deployment
    )
    node "$HELPER" artifacts "$DEST" "$PROJECT"
    touch "$DEST/.deploy-ready"
    echo "Built $RELEASE. Activate: bash scripts/ubuntu/deploy.sh activate '$ROOT' '$RELEASE' -p '$PROJECT'"
    exit 0 ;;
esac
# Plan and validate everything before touching any process. State is committed
# atomically only after all selected services pass their health checks.
PLAN=$(mktemp "$ROOT/.deploy-plan.XXXXXX")
trap 'rm -f "$PLAN"' EXIT
node "$HELPER" plan "$ROOT" "$COMMAND" "$RELEASE" "$PROJECT" > "$PLAN"
ROWS=$(node "$HELPER" rows "$PLAN")
NAMES=(); OLDS=(); TARGETS=(); CHANGED=()
while IFS=$'\t' read -r project old target; do
  NAMES+=("$project"); OLDS+=("$old"); TARGETS+=("$target"); CHANGED+=(false)
done <<< "$ROWS"
for ((i=0; i<${#NAMES[@]}; i++)); do
  if [[ ${OLDS[i]} = - ]]; then node "$HELPER" ports "${TARGETS[i]}" "${NAMES[i]}"; fi
done
HAS_API=false
for project in "${NAMES[@]}"; do if [[ $project = api ]]; then HAS_API=true; fi; done
BACKUP='none (Web-only update)'
if [[ $HAS_API = true ]]; then BACKUP=$(mktemp -d "$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ).XXXXXX"); fi
restore_on_failure() {
  code=$?
  trap - EXIT INT TERM
  rm -f "$PLAN"
  if [[ $code -ne 0 ]]; then
    changed=false
    for value in "${CHANGED[@]}"; do if [[ $value = true ]]; then changed=true; fi; done
    if [[ $changed = false ]]; then
      echo "Activation failed before changing managed processes. Backup: $BACKUP. A manually stopped legacy service must be restarted manually." >&2
      exit "$code"
    fi
    echo "Activation failed. Backup: $BACKUP. Restoring affected processes; data is not rolled back." >&2
    # Delete all affected new registrations before restoring the API and then Web.
    recovery=true
    for ((i=${#NAMES[@]}-1; i>=0; i--)); do
      if [[ ${CHANGED[i]} = true ]]; then pm2 delete "vocespace-${NAMES[i]}" >/dev/null 2>&1 || true; fi
    done
    for ((i=0; i<${#NAMES[@]}; i++)); do
      if [[ ${CHANGED[i]} = true && ${OLDS[i]} != - ]]; then
        if ! pm2 start "${OLDS[i]}/ecosystem.config.cjs" --only "vocespace-${NAMES[i]}" ||
           ! node "$HELPER" health "${OLDS[i]}" "${NAMES[i]}"; then recovery=false; fi
      fi
    done
    if [[ $recovery = true ]]; then pm2 save --force || true
    else echo 'Automatic recovery failed. Inspect PM2 and the recorded release paths before retrying.' >&2; fi
  fi
  exit "$code"
}
trap restore_on_failure EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Stop Web before API only when both are selected. Never interrupt the peer of
# a single-project update, and never back up API files while its writer is live.
for ((i=${#NAMES[@]}-1; i>=0; i--)); do
  if [[ ${OLDS[i]} != - ]]; then
    CHANGED[i]=true
    pm2 stop "vocespace-${NAMES[i]}"
  fi
done
for ((i=0; i<${#NAMES[@]}; i++)); do node "$HELPER" ports "${TARGETS[i]}" "${NAMES[i]}"; done
if [[ $HAS_API = true ]]; then tar -czf "$BACKUP/api-data.tar.gz" -C "$DATA" .; fi
for ((i=0; i<${#NAMES[@]}; i++)); do
  if [[ ${OLDS[i]} != - ]]; then pm2 delete "vocespace-${NAMES[i]}"; fi
  CHANGED[i]=true
  pm2 start "${TARGETS[i]}/ecosystem.config.cjs" --only "vocespace-${NAMES[i]}"
  node "$HELPER" health "${TARGETS[i]}" "${NAMES[i]}"
done
pm2 save
node "$HELPER" commit "$PLAN"
trap - EXIT INT TERM
rm -f "$PLAN"
echo "Active projects: $PROJECT. Run status to see each release."
echo "Backup: $BACKUP (Redis is not backed up or cleared). Caddy was not modified."
