#!/usr/bin/env bash
# Keep setup and deployment under the same user, including root.
set -Eeuo pipefail
umask 027
SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ROOT=${1:-/var/vocespace}
[[ $ROOT = /* && $ROOT != / ]] || { echo 'Use an absolute deployment directory.' >&2; exit 1; }
[[ $(uname -s) = Linux && -f /etc/os-release ]] || { echo 'Ubuntu is required.' >&2; exit 1; }
. /etc/os-release
[[ $ID = ubuntu ]] || { echo 'Ubuntu is required.' >&2; exit 1; }
if [[ $EUID != 0 ]] && ! command -v sudo >/dev/null; then
  echo 'Install sudo or run setup as root.' >&2
  exit 1
fi
as_root() {
  if [[ $EUID == 0 ]]; then "$@"; else sudo "$@"; fi
}
APT_SOURCES=${VOCESPACE_APT_SOURCES:-}
if [[ -n $APT_SOURCES ]]; then
  [[ $APT_SOURCES = /* && -f $APT_SOURCES && -r $APT_SOURCES && -s $APT_SOURCES ]] || {
    echo 'VOCESPACE_APT_SOURCES must be an absolute, readable, nonempty .list or .sources file.' >&2
    exit 1
  }
  case $APT_SOURCES in *.list|*.sources) ;; *) echo 'APT sources must end in .list or .sources.' >&2; exit 1 ;; esac
fi
apt_run() {
  if [[ -n $APT_SOURCES ]]; then
    # Limit this invocation only; retain other repositories' configuration and cached lists.
    as_root apt-get -o "Dir::Etc::sourcelist=$APT_SOURCES" -o 'Dir::Etc::sourceparts=-' \
      -o 'APT::Get::List-Cleanup=false' "$@"
  else
    as_root apt-get "$@"
  fi
}
if ! apt_run update; then
  echo 'APT update failed; setup stopped before installing dependencies.' >&2
  echo 'To use only an existing Ubuntu source file for this run, set VOCESPACE_APT_SOURCES to its absolute path and retry. System source files are not modified.' >&2
  exit 1
fi
apt_run install -y ca-certificates curl xz-utils git rsync build-essential python3 redis-tools util-linux
if [[ ! -e $ROOT ]]; then
  as_root install -d -m 750 -o "$(id -un)" -g "$(id -gn)" "$ROOT"
fi
[[ -w $ROOT ]] || { echo "Deployment user must own/write $ROOT" >&2; exit 1; }
mkdir -p "$ROOT/tools"
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
VERSION=$(tr -d '\r\n' < "$SOURCE/.nvmrc")
[[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
case $(uname -m) in x86_64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; *) echo 'Only x64/arm64 supported.' >&2; exit 1 ;; esac
NAME="node-v$VERSION-linux-$ARCH"
if [[ ! -d $ROOT/tools/$NAME ]]; then
  TMP=$(mktemp -d "$ROOT/tools/.download.XXXXXX")
  trap 'rm -rf -- "$TMP"' EXIT
  curl --fail --show-error --location --retry 3 "https://nodejs.org/dist/v$VERSION/$NAME.tar.xz" -o "$TMP/$NAME.tar.xz"
  curl --fail --show-error --location --retry 3 "https://nodejs.org/dist/v$VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  (cd "$TMP"; awk -v name="$NAME.tar.xz" '$2 == name {print}' SHASUMS256.txt > checksum; test -s checksum; sha256sum -c checksum)
  tar -xJf "$TMP/$NAME.tar.xz" -C "$TMP"
  mv "$TMP/$NAME" "$ROOT/tools/$NAME"
fi
export PATH="$ROOT/tools/$NAME/bin:$PATH"
PNPM=$(node -p "require(process.argv[1]).packageManager.split('@')[1]" "$SOURCE/package.json")
npm install --global --prefix "$ROOT/tools/$NAME" "pnpm@$PNPM"
# Preserve the existing PM2 executable/daemon when available.
if ! command -v pm2 >/dev/null; then npm install --global --prefix "$ROOT/tools/$NAME" pm2@6; fi
printf 'export PATH=%q:"$PATH"\n' "$ROOT/tools/$NAME/bin" > "$ROOT/tools/env.sh"
echo "Ready. Run: source '$ROOT/tools/env.sh'"
echo 'Redis server, LiveKit, Caddy and existing PM2 processes were not changed.'
