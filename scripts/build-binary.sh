#!/usr/bin/env bash
# Build standalone CLI binary for the current platform using Node.js SEA.
# Cross-platform: run this on each target OS/arch, or use CI matrix builds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist-cli"
VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}"

echo "=== Building CLI binary v$VERSION ==="

cd "$ROOT"
npm run build --silent 2>/dev/null

mkdir -p "$DIST"

# Write SEA config
cat > /tmp/sea-config.json <<EOF
{
  "main": "dist/cli.js",
  "output": "dist/blueprint.blob",
  "disableExperimentalSEAWarning": true
}
EOF

node --experimental-sea-config /tmp/sea-config.json 2>/dev/null

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

OUT_NAME="blueprint-${OS}-${ARCH}"
OUT_PATH="$DIST/$OUT_NAME"
if [ "$OS" = "win" ]; then
  OUT_PATH="$DIST/$OUT_NAME.exe"
fi

cp "$(command -v node)" "$OUT_PATH"

npx postject "$OUT_PATH" NODE_SEA_BLOB dist/blueprint.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  2>/dev/null

if command -v strip &>/dev/null; then
  strip "$OUT_PATH" 2>/dev/null || true
fi

echo "  Created: $OUT_PATH ($(du -h "$OUT_PATH" | cut -f1))"
echo ""
echo "Usage: ./$OUT_PATH list"
echo "       ./$OUT_PATH inspect payments"
echo "       ./$OUT_PATH mcp"
