# Contract Parser Design

## Goal

Build one deterministic parser that can read every contract document in `contracts/*.md` and `contracts/core/*.md`, convert them into a canonical in-memory schema, and report line-level errors when a file drifts from the expected shape.

This is not 111 parsers. It is one parser for one document format.

## Scope

The parser must:

- read module docs and core docs
- extract section content by header
- parse function/type blocks
- collect bullet-list sections
- preserve source locations
- validate required sections
- fail on structural drift in strict mode

The parser must not:

- infer missing structure with AI
- guess at undocumented meaning
- rewrite contract intent
- depend on runtime state or hosted services

## Canonical Output

```ts
type Catalog = {
  modules: ModuleContract[];
  core: CoreContract[];
};

type ModuleContract = {
  name: string;
  title: string;
  summary: string;
  functions: ContractFunction[];
  types: ContractType[];
  invariants: string[];
  providers: string[];
  integrations: string[];
  rawSections: RawSection[];
  profile: "module-v1";
  source: SourceRef;
};

type ContractFunction = {
  signature: string;
  raw: string;
  source: SourceRef;
};

type ContractType = {
  raw: string;
  source: SourceRef;
};

type CoreContract = {
  name: string;
  title: string;
  summary: string;
  sections: Record<string, string[]>;
  rawSections: RawSection[];
  profile: "core-v1";
  source: SourceRef;
};

type RawSection = {
  name: string;
  aliases: string[];
  content: string;
  startLine: number;
  endLine: number;
};

type SourceRef = {
  file: string;
  startLine: number;
  endLine: number;
};
```

## Parser Pipeline

1. Read file contents.
2. Split into lines.
3. Parse the document envelope.
4. Capture raw sections by header.
5. Normalize section aliases.
6. Parse known section bodies.
7. Preserve unknown sections as raw.
8. Run semantic validation.
9. Emit structured output.

## Parser Modes

### Strict Mode

Use strict mode for the canonical catalogue.

Fail when:

- a required section is missing
- a section appears twice
- a function block is malformed
- a module name is missing or inconsistent
- a document contains unsupported structure

### Loose Mode

Use loose mode during migration.

Behavior:

- best-effort parse
- preserve warnings
- keep source spans
- do not silently repair structure

## Validation Rules

Each module doc must contain:

- a module title
- `Functions`
- `Types`
- `Invariants`
- `Providers`
- `System-Level Integrations`

Each core doc may use its own section set, but the parser must still preserve headers and source ranges.

## Legacy Compatibility Rules

The parser must accept the current corpus without rewriting the docs first.

Supported variants:

- repeated `---` separators between sections
- `## System-Level Integrations & Constraints` as an alias for `## System-Level Integrations`
- `**Providers:**` followed by inline text or bullet text
- `Functions` and `Types` sections with fenced blocks or raw declaration text
- nested subheadings inside `System-Level Integrations`
- unknown sections preserved as raw content instead of failing immediately in loose mode

Parsing order:

1. Recognize section boundaries.
2. Capture raw section text.
3. Normalize aliases.
4. Parse structured subsections only when the shape is known.
5. Validate and report what was not normalized.

## Error Model

Parser errors must include:

- file path
- line number range
- section name
- human-readable message
- error code

Example codes:

- `MISSING_SECTION`
- `DUPLICATE_SECTION`
- `MALFORMED_FUNCTION_BLOCK`
- `MALFORMED_TYPE_BLOCK`
- `UNSUPPORTED_SECTION`
- `TITLE_MISMATCH`

## Implementation Order

1. Parse headers and section boundaries.
2. Parse fenced code blocks.
3. Parse bullet lists.
4. Add validation.
5. Add catalog loading across the directory tree.
6. Add tests for a small representative set of modules.
7. Run the parser over all contract files.

## Markdown Grammar

The contract docs must follow this grammar.

### File Structure

```ebnf
document         = module_doc | core_doc ;

module_doc       = title_line, blank_line, separator, blank_line, module_section+ ;
core_doc         = title_line, blank_line, section+ ;

title_line       = h1_title ;
separator        = "---" ;
blank_line       = "" ;
```

### Module Doc Grammar

```ebnf
module_doc       = title_line, separator_block, module_heading,
                   summary_block, section_bundle ;

separator_block  = { separator, blank_line } ;

section_bundle   = functions_section, types_section,
                   invariants_section, providers_section,
                   integrations_section, { extra_section } ;

module_heading   = h3_module_name ;
summary_block    = paragraph ;

functions_section    = section_header, section_body ;
types_section        = section_header, section_body ;
invariants_section   = section_header, section_body ;
providers_section    = section_header, section_body ;
integrations_section = section_header, section_body ;
extra_section        = section_header, section_body ;

section_header      = "**Functions**"
                    | "**Types**"
                    | "**Invariants**"
                    | "**Providers:**"
                    | h2_system_integrations
                    | other_known_header ;

section_body        = fenced_block | bullet_list | paragraph_block | mixed_block ;
```

### Required Headers

```text
# Module Contract: `name`
---
### `name`
**Functions**
**Types**
**Invariants**
**Providers:**
## System-Level Integrations
```

### Functions Block Grammar

Functions are expressed as a fenced code block containing one signature per line. In loose mode, raw text lines are also accepted and normalized.

```ebnf
fenced_block        = "```", signature_line+, "```" ;
signature_line      = function_signature ;
function_signature  = identifier, "(", parameter_list?, ")", " → ", type_name ;
parameter_list      = parameter, { ", ", parameter } ;
parameter           = identifier, ["?"], [":", type_name], [" = ", default_value] ;
type_name           = identifier, { "[", "]" } ;
```

Accepted examples:

```text
createIncident(input) → Incident
resolveIncident(incident_id, resolution, note?) → Incident
```

### Types Block Grammar

Types are expressed as a fenced code block containing one declaration per line. In loose mode, raw declaration text is preserved and parsed best-effort.

```ebnf
type_declaration  = record_decl | alias_decl | union_decl ;

record_decl       = identifier, " { ", field_list, " }" ;
field_list        = field, { ", ", field } ;
field             = identifier, ["?"], [":", type_name] ;

alias_decl        = identifier, " = ", type_expr ;
union_decl        = identifier, " = ", type_expr, { " | ", type_expr } ;
type_expr         = identifier, { "[", "]" } ;
```

Accepted examples:

```text
Incident { id, title, status, created_at }
IncidentStatus = open | resolved | closed
Resolution = fixed | monitoring | duplicate
```

### Bullet List Grammar

```ebnf
bullet_list       = bullet_item, { bullet_item } ;
bullet_item       = "- ", text ;
provider_list     = bullet_item, { ", ", bullet_item } ;

### Robust Parsing Principle

The parser must treat the markdown corpus as a **document registry**, not as a perfect language grammar.

That means:

- capture first, normalize second
- preserve raw content always
- validate hard only after normalization
- version the profile when the structure changes
```

## Notes

- The grammar is intentionally strict.
- The parser should prefer failing loudly over guessing.
- If a doc needs a new shape, the grammar should change first.
