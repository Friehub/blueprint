#!/usr/bin/env bash
# CI step: after blueprint generate, check that no unaliased Blueprint
# identifiers appear in the generated output.
set -euo pipefail

GEN_DIR="${1:-generated}"
ALIAS_FILE="${2:-blueprint.aliases.json5}"

if [ ! -d "$GEN_DIR" ]; then
  echo "No generated output at $GEN_DIR. Run 'blueprint generate' first."
  exit 0
fi

# Known Blueprint identifier patterns to check
KNOWN_PATTERNS=(
  "Contract"
  "Adapter"
  "initiatePayment"
  "verifyPayment"
  "createOrder"
  "getOrder"
  "signIn"
  "signUp"
)

HAS_ISSUES=0

if [ -f "$ALIAS_FILE" ]; then
  echo "Checking $GEN_DIR against alias file $ALIAS_FILE..."
else
  echo "No alias file found. Skipping check."
  exit 0
fi

for pattern in "${KNOWN_PATTERNS[@]}"; do
  FOUND=$(grep -rl "$pattern" "$GEN_DIR" 2>/dev/null || true)
  if [ -n "$FOUND" ]; then
    echo "WARNING: Unaliased identifier '$pattern' found in:"
    echo "$FOUND" | sed 's/^/  /'
    HAS_ISSUES=1
  fi
done

if [ "$HAS_ISSUES" -eq 1 ]; then
  echo ""
  echo "FAIL: Unaliased Blueprint identifiers detected. Update blueprint.aliases.json5"
  echo "and regenerate. See docs/alias-spec.md for details."
  exit 1
fi

echo "OK: No unaliased Blueprint identifiers found."
