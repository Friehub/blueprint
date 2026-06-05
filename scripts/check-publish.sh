#!/usr/bin/env bash
set -euo pipefail

echo "=== Pre-publish checks ==="

# 1. Essential files
echo "Checking files..."
test -f dist/index.js || { echo "FAIL: dist/index.js missing"; exit 1; }
test -f dist/cli.js || { echo "FAIL: dist/cli.js missing"; exit 1; }
test -f package.json || { echo "FAIL: package.json missing"; exit 1; }
echo "  ✓ Essential files present"

# 2. Package name and version
echo "Checking package metadata..."
NAME=$(node -e "console.log(require('./package.json').name)")
VERSION=$(node -e "console.log(require('./package.json').version)")
echo "  Name: $NAME"
echo "  Ver:  $VERSION"
test "$NAME" != "" || { echo "FAIL: empty name"; exit 1; }
test "$VERSION" != "" || { echo "FAIL: empty version"; exit 1; }
echo "  ✓ Package metadata"

# 3. Library exports
echo "Checking library exports..."
REQUIRED_EXPORTS=(
  "loadCatalogFromRoot"
  "resolveDeps"
  "detectCycles"
  "searchModules"
  "implicitCores"
  "loadAdapters"
  "validateAdapter"
  "verifyImplementation"
  "generateImplementPrompts"
)

for fn in "${REQUIRED_EXPORTS[@]}"; do
  node -e "const m = require('./dist/index.js'); if (typeof m['$fn'] !== 'function') process.exit(1)" || {
    echo "FAIL: $fn not exported from library"
    exit 1
  }
done
echo "  ✓ All ${#REQUIRED_EXPORTS[@]} library exports present"

# 4. CLI binary
echo "Checking CLI..."
node dist/cli.js --version > /dev/null 2>&1 || { echo "FAIL: CLI not working"; exit 1; }
node dist/cli.js --help > /dev/null 2>&1 || { echo "FAIL: CLI help not working"; exit 1; }
echo "  ✓ CLI working"

# 5. Private flag
echo "Checking package is public..."
node -e "const p = require('./package.json'); if (p.private) process.exit(1)" || {
  echo "FAIL: package.json has private:true"
  exit 1
}
echo "  ✓ Package is public"

echo ""
echo "All checks passed. Ready to publish."
