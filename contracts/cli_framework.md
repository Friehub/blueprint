# Module Contract: `cli_framework`

**Version:** 0.1.0

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
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every command execution creates a span. Span names follow the pattern `cli_framework.<command>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none)
* **Recommends:** config, telemetry
