#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC}: $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}: $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Integration Tests ==="
echo ""

# 1. Add adapters
echo "1. Adapter selection"
node dist/cli.js adapters add stripe payments 2>/dev/null
node dist/cli.js adapters add redis caching 2>/dev/null
node dist/cli.js adapters add bullmq queues 2>/dev/null
check "select stripe for payments" 'grep -q stripe blueprinter.json'
check "select redis for caching" 'grep -q redis blueprinter.json'
check "select bullmq for queues" 'grep -q bullmq blueprinter.json'

# 2. Generate code
echo ""
echo "2. Code generation"
rm -rf /tmp/blueprinter-integration 2>/dev/null
node dist/cli.js generate --lang typescript --output /tmp/blueprinter-integration 2>/dev/null
check "generates shared types" 'test -f /tmp/blueprinter-integration/interfaces/shared.ts'
check "generates payments interface" 'test -f /tmp/blueprinter-integration/interfaces/payments.ts'
check "generates stripe adapter" 'test -f /tmp/blueprinter-integration/adapters/payments/stripe.ts'
check "generates stripe test" 'test -f /tmp/blueprinter-integration/__tests__/payments/stripe.test.ts'

# 3. Verify adapters
echo ""
echo "3. Adapter verification"
check "stripe implements all payments functions" 'node dist/cli.js verify /tmp/blueprinter-integration/adapters/payments/stripe.ts --module payments 2>&1 | grep -q "All 10 functions"'
check "redis implements all caching functions" 'node dist/cli.js verify /tmp/blueprinter-integration/adapters/caching/redis.ts --module caching 2>&1 | grep -q "All"'
check "bullmq implements all queues functions" 'node dist/cli.js verify /tmp/blueprinter-integration/adapters/queues/bullmq.ts --module queues 2>&1 | grep -q "All"'

# 4. Generate prototype
echo ""
echo "4. Prototype generation"
rm -rf /tmp/blueprinter-project 2>/dev/null
node dist/cli.js prototype --name test-project --output /tmp/blueprinter-project 2>/dev/null
check "generates package.json" 'test -f /tmp/blueprinter-project/package.json'
check "generates tsconfig.json" 'test -f /tmp/blueprinter-project/tsconfig.json'
check "generates .gitignore" 'test -f /tmp/blueprinter-project/.gitignore'
check "generates .env.example" 'test -f /tmp/blueprinter-project/.env.example'
check "generates config" 'test -f /tmp/blueprinter-project/src/config/adapters.ts'
check "generates entry point" 'test -f /tmp/blueprinter-project/src/index.ts'
check "generates README" 'test -f /tmp/blueprinter-project/README.md'

# 5. Verify package.json
echo ""
echo "5. Package dependencies"
check "has stripe dependency" 'grep -q stripe /tmp/blueprinter-project/package.json'
check "has redis dependency" 'grep -q redis /tmp/blueprinter-project/package.json'
check "has bullmq dependency" 'grep -q bullmq /tmp/blueprinter-project/package.json'
check "has typescript dev dep" 'grep -q typescript /tmp/blueprinter-project/package.json'

# 6. Resolve dependencies
echo ""
echo "6. Dependency resolution"
check "resolves billing deps" 'node dist/cli.js resolve --modules billing 2>&1 | grep -q payments'

# 7. Search
echo ""
echo "7. Search"
check "finds payment modules" 'echo payment | node dist/cli.js search 2>&1 | grep -q payments'

# 8. Graph
echo ""
echo "8. Graph"
check "generates graph for billing" 'node dist/cli.js graph billing 2>&1 | grep -q payments'

# 9. Schema
echo ""
echo "9. Schema export"
check "exports JSON schema" 'node dist/cli.js schema 2>&1 | grep -q "json-schema.org"'

# 10. Clean up
rm -f blueprinter.json
rm -rf /tmp/blueprinter-integration /tmp/blueprinter-project

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
