# Module Contract: `cli_framework`

**Version:** 0.2.0

---

### `cli_framework`
Command-line interface framework with command registration, argument parsing, help generation, and config file loading.

**Functions**
```
registerCommand(name, handler, config) → Command
listCommands() → Command[]
runCommand(argv) → ExecResult
getHelp(command_name?) → HelpText
loadConfigFile(path) → ConfigData
parseArguments(argv, schema) → ParsedArgs
completeCommand(input) → Completion[]
```

**Types**
```
Command { id, name, description, arguments: ArgDef[], options: OptionDef[], subcommands?, handler_ref }
ArgDef { name, type, description, required, default?, positional: bool }
OptionDef { name, shorthand, type: string|number|boolean|array, description, required?, default? }
ExecResult { command, exit_code, stdout, stderr, duration_ms }
HelpText { header, usage, commands, options, examples }
ConfigData { source, values, warnings }
ParsedArgs { command, positional: Record<string, any>, options: Record<string, any>, unknown: string[] }
Completion { word, description, type: command|option|value }
```

**Invariants**
- `runCommand` must never throw -- all errors must be captured as non-zero exit codes in `ExecResult`
- `getHelp` without a command name must list all top-level commands; with a command name it must show detailed usage for that command
- `parseArguments` with unknown flags must collect them in the `unknown` array rather than erroring immediately

**Providers:** commander, yargs, cobra, click, clap, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Command registration is per-process; config file loading is stateless

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for command execution.
* **Details:** Output is written to stdout/stderr; duplicate execution is caller-controlled.

### Worker Scaling
* **Policy:** CLI is single-process; no scaling required.

### Multi-Region Behavior
* **Mode:** CLI runs locally; region-specific commands must accept a `--region` flag.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
registerCommand:
    command_already_exists:    A command with that name is already registered | use a different name or override
    invalid_handler:           Handler is not a valid function | verify handler signature

  runCommand:
    command_not_found:         No command registered for the given argv | show help with available commands
    argument_validation_error: Required argument missing or invalid type | show usage for the command
    execution_error:           Handler threw an error | capture in ExecResult.stderr with exit_code > 0

  loadConfigFile:
    file_not_found:            Config file path does not exist | use default config
    parse_error:               Config file could not be parsed | verify file format
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerCommand   → cli.command.registered      { command_name, argument_count }
  runCommand        → cli.command.executed        { command_name, exit_code, duration_ms }
                  OR cli.command.failed           { command_name, error_code }
```

### Temporal Constraints
```
Command execution timeout:
    default:        5 minutes
    on_expiry:      terminate handler; return exit_code 124

  Config file cache TTL:
    default:        60 seconds
    on_expiry:      reload config file on next access
```

### Observability
* **Tracing Spans:** Every command execution creates a span. Span names follow the pattern `cli_framework.<command>`.
* **Telemetry Metrics:**
```
blueprint_cli_framework_commands_registered_total  { name }
  blueprint_cli_framework_commands_executed_total   { command, exit_code }
  blueprint_cli_framework_command_duration_ms        histogram { command }
  blueprint_cli_framework_config_loads_total         { result }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none)
* **Recommends:** config, telemetry
