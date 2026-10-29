#!/usr/bin/env bash
# Run as the deployment user, not with sudo. Only apt/directory creation use sudo.
set -Eeuo pipefail
umask 027
SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ROOT=${1:-/var/vocespace}
[[ $ROOT = /* && $ROOT != / ]] || { echo 'Use an absolute deployment directory.' >&2; exit 1; }
[[ $EUID != 0 ]] || { echo 'Run as the deployment user; the script invokes sudo where needed.' >&2; exit 1; }
[[ $(uname -s) = Linux && -f /etc/os-release ]] || { echo 'Ubuntu is required.' >&2; exit 1; }
. /etc/os-release
[[ $ID = ubuntu ]] || { echo 'Ubuntu is required.' >&2; exit 1; }
sudo apt-get update
sudo apt-get install -y ca-certificates curl xz-utils git rsync build-essential python3 redis-tools util-linux
if [[ ! -e $ROOT ]]; then
  sudo install -d -m 750 -o "$(id -un)" -g "$(id -gn)" "$ROOT"
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
