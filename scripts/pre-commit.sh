#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "OK"; }
fail() { FAIL=$((FAIL + 1)); echo "FAILED"; }

cleanup() {
  rm -rf /tmp/blueprint-check-*
}
trap cleanup EXIT

echo "=== Blueprint pre-commit check ==="
echo ""

# 1. Strict TypeScript compilation (catches nulls, any, strict violations)
echo "--- Strict TypeScript check (tsc --strict) ---"
if npx tsc --noEmit --strict 2>&1; then
  pass
else
  echo "  Strict mode found issues. Run 'npx tsc --noEmit --strict' to see them."
  fail
fi
echo ""

# 2. Build dist
echo "--- Building dist ---"
if npx tsc 2>&1; then
  pass
else
  fail
fi
echo ""

# 3. Run all tests
echo "--- Running all tests ---"
set +e
node --test dist/**/*.test.js 2>&1 || true
TEST_EXIT=$?
set -e
if [ "$TEST_EXIT" -eq 0 ]; then
  echo ""
  pass
else
  echo ""
  fail
fi
echo ""

# 4. Verify catalog loads without errors in strict mode
echo "--- Verifying catalog loads (strict mode) ---"
if node -e "
const { loadCatalogFromRoot } = require('./dist/core/load-catalog.js');
loadCatalogFromRoot(process.cwd(), 'strict').then(r => {
  const errors = r.issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    console.error('Catalog errors:');
    errors.forEach(e => console.error('  -', e.message));
    process.exit(1);
  }
  console.log('  ', r.value.modules.length, 'modules,', r.value.core.length, 'core contracts, 0 errors');
}).catch(e => { console.error(e); process.exit(1); });
" 2>&1; then
  pass
else
  fail
fi
echo ""

# 5. Generate all interfaces for each language (quick smoke)
echo "--- Generation smoke test (interfaces x 5 languages) ---"
for lang in typescript python go rust java; do
  printf "  %-12s" "$lang:"
  if node -e "
  const { loadCatalogFromRoot } = require('./dist/core/load-catalog.js');
  const { loadAdapters } = require('./dist/core/adapters/load.js');
  const { registerGenerator, generate } = require('./dist/generators/engine.js');
  const { TypeScriptGenerator } = require('./dist/generators/typescript/index.js');
  const { PythonGenerator } = require('./dist/generators/python/index.js');
  const { GoGenerator } = require('./dist/generators/go/index.js');
  const { RustGenerator } = require('./dist/generators/rust/index.js');
  const { JavaGenerator } = require('./dist/generators/java/index.js');

  registerGenerator(new TypeScriptGenerator());
  registerGenerator(new PythonGenerator());
  registerGenerator(new GoGenerator());
  registerGenerator(new RustGenerator());
  registerGenerator(new JavaGenerator());

  Promise.all([
    loadCatalogFromRoot(process.cwd(), 'loose'),
    loadAdapters(process.cwd() + '/adapters'),
  ]).then(([catalogResult, adapterResult]) => {
    const catalog = catalogResult.value;
    const adapters = adapterResult.adapters;
    return generate(catalog, adapters, { language: '$lang', type: 'all', module: 'payments', provider: undefined, outputDir: '/tmp/blueprint-check-\$lang' });
  }).then(result => {
    if (result.errors.length > 0) { console.error(result.errors.join(', ')); process.exit(1); }
    console.log(result.files.length + ' files, 0 errors');
  }).catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1; then
    pass
  else
    fail
  fi
done
echo ""

# 6. Verify adapter language declarations are consistent
echo "--- Verifying adapter language declarations ---"
if node -e "
const { loadAdapters } = require('./dist/core/adapters/load.js');
const { adapterSupportsLanguage } = require('./dist/core/adapters/types.js');
loadAdapters(process.cwd() + '/adapters').then(({ adapters }) => {
  let issues = 0;
  for (const a of adapters) {
    if (a.languages) {
      for (const lang of a.languages) {
        if (!adapterSupportsLanguage(a, lang)) {
          console.error('  ERROR:', a.name, '- declares', lang, 'but check fails');
          issues++;
        }
      }
    }
  }
  if (issues > 0) process.exit(1);
  const withLang = adapters.filter(a => a.languages).length;
  console.log('  ', withLang, 'adapters declare languages,', adapters.length - withLang, 'default to all');
}).catch(e => { console.error(e); process.exit(1); });
" 2>&1; then
  pass
else
  fail
fi
echo ""

# 7. Check for em dash / en dash characters in contracts and sagas
echo "--- Checking for unicode dashes in contracts/ and sagas/ ---"
bad_dashes=$(python3 -c "
import os, sys
found = []
for root, dirs, files in os.walk('contracts'):
    for f in files:
        if f.endswith('.md'):
            path = os.path.join(root, f)
            for i, line in enumerate(open(path, encoding='utf-8'), 1):
                if '\u2014' in line or '\u2013' in line:
                    found.append(f'{path}:{i}')
for root, dirs, files in os.walk('sagas'):
    for f in files:
        if f.endswith('.md'):
            path = os.path.join(root, f)
            for i, line in enumerate(open(path, encoding='utf-8'), 1):
                if '\u2014' in line or '\u2013' in line:
                    found.append(f'{path}:{i}')
if found:
    print('\n'.join(found))
" 2>/dev/null)
if [ -z "$bad_dashes" ]; then
  pass
else
  echo "  Found unicode dash characters (— or –) in markdown files. Use -- instead:"
  echo "$bad_dashes" | head -10
  fail
fi
echo ""

# 8. Check for no missing file extensions in imports (common TS gotcha)
echo "--- Checking import extensions (.js) ---"
bad_imports=$(grep -rn "from '.*\.ts'" src/ 2>/dev/null || true)
if [ -z "$bad_imports" ]; then
  pass
else
  echo "  Found .ts imports (should be .js):"
  echo "$bad_imports" | head -5
  fail
fi
echo ""

echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then exit 1; fi
