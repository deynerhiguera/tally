#!/usr/bin/env bash
# Builds Tally.app and installs it into /Applications, replacing any previous version.
# Your data lives in ~/Library/Application Support/Tally and is never touched by this script.
# Usage: npm run install:mac
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="Tally"
BUILT_APP="release/mac-arm64/${APP_NAME}.app"
TARGET="/Applications/${APP_NAME}.app"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "This script installs the Apple Silicon (arm64) build and only runs on an arm64 Mac." >&2
  exit 1
fi

echo "› Building ${APP_NAME}.app"
npm run package:mac

echo "› Ad-hoc signing"
codesign --force --deep --sign - "$BUILT_APP"

if pgrep -xq "$APP_NAME"; then
  echo "› Quitting the running ${APP_NAME}"
  osascript -e "tell application \"${APP_NAME}\" to quit" || true
  for _ in {1..20}; do pgrep -xq "$APP_NAME" || break; sleep 0.25; done
fi

echo "› Installing to ${TARGET}"
rm -rf "$TARGET"
ditto "$BUILT_APP" "$TARGET"

echo "› Removing quarantine attribute"
xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null || true

# Refresh Launch Services so Spotlight and Launchpad pick up the new version right away.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$TARGET" >/dev/null 2>&1 || true

echo "✓ ${APP_NAME} installed. Open it with Cmd + Space → \"${APP_NAME}\"."
