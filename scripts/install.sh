#!/usr/bin/env bash
# Blueprint CLI installer
# Usage: curl -fsSL https://blueprint.friehub.cloud/install.sh | bash
set -euo pipefail

VERSION="${1:-latest}"
INSTALL_DIR="${BLUEPRINT_HOME:-$HOME/.blueprint}"

echo "=== Blueprint CLI Installer ==="
echo ""

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

BINARY="blueprint-${OS}-${ARCH}"
if [ "$OS" = "win" ]; then
  BINARY="blueprint-win-x64.exe"
fi

echo "  Platform: ${OS}-${ARCH}"

# Prefer npm if Node.js is available
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 18 ]; then
    echo ""
    echo "  Node.js $(node -v) detected — installing via npm..."
    echo ""
    npm install -g "@friehub/blueprint@$VERSION" 2>&1
    echo ""
    echo "  Done! Run 'blueprint --help' to get started."
    exit 0
  fi
fi

# Try downloading pre-built binary from GitHub
DOWNLOAD_URL="https://github.com/Friehub/blueprint/releases/latest/download/$BINARY"
INSTALL_DIR="${BLUEPRINT_HOME:-$HOME/.blueprint}"

echo ""
echo "  Downloading ${BINARY} from GitHub Releases..."
mkdir -p "$INSTALL_DIR"
if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_DIR/blueprint" && chmod +x "$INSTALL_DIR/blueprint"
elif command -v wget &>/dev/null; then
  wget -q "$DOWNLOAD_URL" -O "$INSTALL_DIR/blueprint" && chmod +x "$INSTALL_DIR/blueprint"
else
  echo "  ERROR: Neither curl nor wget found. Install curl and try again."
  exit 1
fi

echo ""
echo "  Installed to $INSTALL_DIR/blueprint"
echo "  Add to PATH: export PATH=\"\$PATH:$INSTALL_DIR\""
echo "  Run: blueprint --help"
echo ""
