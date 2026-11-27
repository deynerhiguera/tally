#!/usr/bin/env bash
# Renders the icons with macOS QuickLook:
# - build/icon.svg → build/icon.png (1024×1024, app icon; electron-builder turns it into icon.icns)
# - build/tray.svg → resources/trayTemplate.png (18×18) and trayTemplate@2x.png (36×36, menu bar)
# Usage: npm run icon
set -euo pipefail
cd "$(dirname "$0")/.."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

qlmanage -t -s 1024 -o "$tmp" build/icon.svg >/dev/null
mv "$tmp/icon.svg.png" build/icon.png
echo "Wrote build/icon.png"

mkdir -p resources
# QuickLook thumbnails are blurry at tiny sizes: render large, then downscale.
qlmanage -t -s 512 -o "$tmp" build/tray.svg >/dev/null
sips -z 36 36 "$tmp/tray.svg.png" --out resources/trayTemplate@2x.png >/dev/null
sips -z 18 18 "$tmp/tray.svg.png" --out resources/trayTemplate.png >/dev/null
echo "Wrote resources/trayTemplate.png and trayTemplate@2x.png"
