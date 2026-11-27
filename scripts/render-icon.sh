#!/usr/bin/env bash
# Renders build/icon.svg to build/icon.png (1024×1024) with macOS QuickLook.
# electron-builder converts the PNG into icon.icns when packaging.
# Usage: npm run icon
set -euo pipefail
cd "$(dirname "$0")/.."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

qlmanage -t -s 1024 -o "$tmp" build/icon.svg >/dev/null
mv "$tmp/icon.svg.png" build/icon.png
echo "Wrote build/icon.png"
