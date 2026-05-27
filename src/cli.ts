#!/usr/bin/env node

import { loadCatalogFromRoot } from './core/load-catalog.js';
import { parseArguments } from './utils/args.js';
import { writeFile } from 'node:fs/promises';

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.version) {
    printVersion();
    return;
  }

  const root = args.root ?? process.cwd();
  const strict = args.strict ?? false;
  const output = args.output;

  const result = await loadCatalogFromRoot(root, strict ? 'strict' : 'loose');

  if (result.issues.length > 0) {
    const errors = result.issues.filter(issue => issue.severity === 'error');
    const warnings = result.issues.filter(issue => issue.severity === 'warning');
    if (errors.length > 0) {
      console.error('Errors encountered while loading the catalog:');
      for (const error of errors) {
        console.error(`  - ${error.message}`);
      }
      if (strict) {
        process.exit(1);
      }
    }
    if (warnings.length > 0) {
      console.warn('Warnings encountered while loading the catalog:');
      for (const warning of warnings) {
        console.warn(`  - ${warning.message}`);
      }
    }
  }

  const json = JSON.stringify(result.value, null, 2);
  if (output) {
    await writeFile(output, json, 'utf8');
  } else {
    console.log(json);
  }
}

function printHelp() {
  console.log(`
Usage: blueprinter [options]

Options:
  --root <path>      Root directory to load contracts from (default: current directory)
  --strict           Exit with code 1 if there are any errors (warnings do not affect exit code)
  --output <file>    Write the JSON catalog to this file instead of stdout
  --help, -h         Show this help message
  --version, -v      Show version number
`);
}

function printVersion() {
  // In a real project, we might read this from package.json
  console.log('engineering-blueprinter@0.1.0');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});