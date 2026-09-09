#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DEPLOY_PATH:-}" ]]; then
  echo "DEPLOY_PATH is required."
  exit 1
fi

if [[ -z "${RELEASE_NAME:-}" ]]; then
  echo "RELEASE_NAME is required."
  exit 1
fi

if [[ -z "${RELEASE_ARCHIVE:-}" ]]; then
  echo "RELEASE_ARCHIVE is required."
  exit 1
fi

KEEP_RELEASES="${KEEP_RELEASES:-5}"
RELEASES_DIR="$DEPLOY_PATH/releases"
CURRENT_LINK="$DEPLOY_PATH/current"
SHARED_DIR="$DEPLOY_PATH/shared"
TARGET_RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
# 云机(106.14.175.93)运行的是自编译 nginx;发行版 nginx 在该机为死配置
NGINX_BIN="${NGINX_BIN:-/usr/local/nginx/sbin/nginx}"

echo "Deploy path: $DEPLOY_PATH"
echo "Release name: $RELEASE_NAME"

mkdir -p "$RELEASES_DIR" "$SHARED_DIR"
mkdir -p "$TARGET_RELEASE_DIR"

if [[ ! -f "$RELEASE_ARCHIVE" ]]; then
  echo "Release archive not found: $RELEASE_ARCHIVE"
  exit 1
fi

tar -xzf "$RELEASE_ARCHIVE" -C "$TARGET_RELEASE_DIR"
rm -f "$RELEASE_ARCHIVE"

if [[ ! -f "$TARGET_RELEASE_DIR/index.html" ]]; then
  echo "Health check failed: index.html not found in release."
  rm -rf "$TARGET_RELEASE_DIR"
  exit 1
fi

if ! sudo "$NGINX_BIN" -t; then
  echo "Nginx config test failed. Keep current release unchanged."
  rm -rf "$TARGET_RELEASE_DIR"
  exit 1
fi

ln -sfn "$TARGET_RELEASE_DIR" "$CURRENT_LINK"
sudo "$NGINX_BIN" -s reload

echo "Pruning old releases, keep: $KEEP_RELEASES"
mapfile -t RELEASE_CANDIDATES < <(ls -1dt "$RELEASES_DIR"/* 2>/dev/null || true)
if (( ${#RELEASE_CANDIDATES[@]} > KEEP_RELEASES )); then
  for old_release in "${RELEASE_CANDIDATES[@]:KEEP_RELEASES}"; do
    rm -rf "$old_release"
  done
fi

echo "Deploy done."
