export function printHelp(command?: string) {
  if (command === "resolve") {
    console.log(`
Usage: blueprinter resolve [options]

Options:
  --modules <list>   Comma-separated module names to resolve
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the resolved set to this file instead of stdout
  --compact          Output compact JSON (no indentation)
  --quiet            Suppress warnings

Reads module names from stdin if --modules is not provided.
Examples:
  blueprinter resolve --modules billing,payments,users
  echo billing,payments | blueprinter resolve
  cat modules.txt | blueprinter resolve --output resolved.json
`);
    return;
  }

  if (command === "inspect") {
    console.log(`
Usage: blueprinter inspect <module> [options]

Options:
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the contract to this file instead of stdout
  --compact          Output compact JSON (no indentation)

Shows the full contract for a single module.
`);
    return;
  }

  if (command === "graph") {
    console.log(`
Usage: blueprinter graph <module> [options]

Options:
  --format <fmt>     Output format: ascii (default) or mermaid
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the graph to this file instead of stdout

Shows the dependency graph for a module.
`);
    return;
  }

  if (command === "search") {
    console.log(`
Usage: blueprinter search <query> [options]

Options:
  --root <path>      Project root directory (default: current directory)
  --output <file>    Write the resolved set to this file instead of stdout
  --compact          Output compact JSON (no indentation)

Searches for modules matching the query and interactively picks which to resolve.
In non-interactive mode (piped input), outputs matching module names as JSON.
Examples:
  blueprinter search billing
  blueprinter search "user management"
  echo "payment" | blueprinter search
`);
    return;
  }

  if (command === "adapters") {
    console.log(`
Usage: blueprinter adapters <subcommand> [options]

Subcommands:
  list [module]         List available adapters
  add <provider> <module>  Select an adapter for a module
  remove <module>       Remove adapter selection
  show                  Show current adapter selections
  verify [module]       Verify adapters against contracts
  search <query>        Search for adapters

Options:
  --root <path>         Project root directory (default: current directory)
  --compact             Output compact JSON (no indentation)
  --quiet               Suppress warnings

Examples:
  blueprinter adapters list
  blueprinter adapters list payments
  blueprinter adapters add stripe payments
  blueprinter adapters remove payments
  blueprinter adapters show
  blueprinter adapters verify
  blueprinter adapters search stripe
`);
    return;
  }

  if (command === "generate") {
    console.log(`
Usage: blueprinter generate [subcommand] [options]

Subcommands:
  interfaces            Generate language interfaces from contracts
  adapters              Generate adapter skeletons
  tests                 Generate conformance tests
  all                   Generate all (default)

Options:
  --lang <language>     Target language: typescript (default), rust, python, go
  --module <module>     Generate for specific module only
  --output <dir>        Output directory (default: ./generated)
  --root <path>         Project root directory (default: current directory)

Examples:
  blueprinter generate
  blueprinter generate --lang typescript
  blueprinter generate interfaces --lang typescript
  blueprinter generate adapter stripe payments --lang typescript
  blueprinter generate tests --lang typescript
  blueprinter generate --module billing --lang typescript
`);
    return;
  }

  if (command === "schema") {
    console.log(`
Usage: blueprinter schema [options]

Options:
  --output <file>    Write schema to file instead of stdout
  --compact          Output compact JSON (no indentation)
  --root <path>      Project root directory (default: current directory)

Exports the catalog as a JSON Schema for programmatic validation.

Examples:
  blueprinter schema
  blueprinter schema --output catalog.schema.json
  blueprinter schema --compact
`);
    return;
  }

  if (command === "prototype") {
    console.log(`
Usage: blueprinter prototype [options]

Options:
  --name <name>         Project name (default: my-project)
  --output <dir>        Output directory (default: ./<name>)
  --root <path>         Project root directory (default: current directory)

Generates a project scaffold based on selected adapters.
Requires adapters to be selected first with 'blueprinter adapters add'.

Examples:
  blueprinter prototype
  blueprinter prototype --name my-saas
  blueprinter prototype --output ./my-project
`);
    return;
  }

  console.log(`
Usage: blueprinter [command] [options]

Commands:
  build (default)    Load all contracts and output catalog.json
  list               List all modules with dependencies
  search <query>     Search for modules and interactively pick to resolve
  inspect <module>   Show full contract for a module
  graph <module>     Show dependency graph for a module
  resolve            Resolve specific modules with dependencies
  adapters           Manage adapter selections
  generate           Generate code from contracts
  prototype          Generate project scaffold
  schema             Export catalog as JSON Schema

Options:
  --root <path>      Project root directory (default: current directory)
  --strict           Exit with code 1 if there are any errors (warnings do not affect exit code)
  --output <file>    Write output to this file instead of stdout
  --modules <list>   Comma-separated module names (resolve command only)
  --format <fmt>     Output format for graph: ascii (default) or mermaid
  --compact          Output compact JSON (no indentation)
  --quiet            Suppress warnings
  --minimal          Output minimal JSON without raw sections
  --help, -h         Show this help message
  --version, -v      Show version number

Examples:
  blueprinter list
  blueprinter inspect billing
  blueprinter graph billing
  blueprinter graph billing --format mermaid
  blueprinter resolve --modules billing,payments,users
  blueprinter resolve --modules billing,payments,users --output resolved.json
  echo billing,payments | blueprinter resolve --compact
  blueprinter schema --output catalog.schema.json
`);
}
