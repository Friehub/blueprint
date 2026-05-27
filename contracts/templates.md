# Module: templates

**Version:** 0.1.0
**Part:** II -- Communication

## Purpose

Defines the interface for managing and rendering dynamic content templates. A template is a named, versioned document with variable placeholders that is rendered against a data context to produce a final output string or document. Templates serve emails, SMS messages, push notification bodies, PDF documents, webhook payloads, and any other content that is structurally stable but contextually variable. This module owns the template definition, versioning, and rendering. It does not own the delivery -- rendered output is returned to the caller for dispatch via `emails`, `sms`, `notifications`, or `pdf`.

---

## State Machine

```
DRAFT → PUBLISHED → DEPRECATED → ARCHIVED
DRAFT → ARCHIVED
PUBLISHED → DRAFT   (create a new draft version; prior version remains PUBLISHED until replaced)
```

Transitions:
- `DRAFT → PUBLISHED`: `publishTemplate` called; becomes the active version for this template name
- `PUBLISHED → DEPRECATED`: a newer version is published, replacing the current one
- `DEPRECATED | PUBLISHED → ARCHIVED`: `archiveTemplate` called; template is no longer renderable

---

## Functions

### `createTemplate(input: CreateTemplateInput) → Template`
Creates a new template or a new draft version of an existing template name. Each creation produces a versioned record.

### `getTemplate(templateId: TemplateId) → Template`
Returns a specific versioned template by ID.

### `getActiveTemplate(name: string, locale?: string) → Template`
Returns the currently published (active) version of a template by name and optional locale. Used by renderers to resolve the correct version.

### `listTemplates(input: ListTemplatesInput) → PaginatedList<Template>`
Lists templates, optionally filtered by name, status, output type, or locale.

### `listVersions(name: string) → Template[]`
Returns all versions of a template ordered by version descending.

### `publishTemplate(templateId: TemplateId) → Template`
Promotes a `DRAFT` template to `PUBLISHED`. The previously published version (if any) transitions to `DEPRECATED`.

### `deprecateTemplate(templateId: TemplateId) → Template`
Manually marks a published template as deprecated without publishing a replacement.

### `archiveTemplate(templateId: TemplateId) → void`
Soft-deletes a template version. Archived templates are not returned by `getActiveTemplate`.

### `renderTemplate(input: RenderTemplateInput) → RenderedOutput`
Renders a named template against a data context, returning the final output. If `templateId` is specified, that exact version is rendered; otherwise the active version for the name and locale is used.

### `validateTemplate(input: ValidateTemplateInput) → ValidationResult`
Validates the template syntax and renders it against a sample context, returning any parse errors or missing variable warnings without persisting anything.

### `previewTemplate(input: RenderTemplateInput) → RenderedOutput`
Equivalent to `renderTemplate` but explicitly marked as a preview call; the render is not counted in usage metrics.

---

## Types

```typescript
type TemplateId = string;

type TemplateStatus = "DRAFT" | "PUBLISHED" | "DEPRECATED" | "ARCHIVED";

type TemplateOutputType =
  | "EMAIL_HTML"
  | "EMAIL_TEXT"
  | "SMS"
  | "PUSH_NOTIFICATION"
  | "PDF"
  | "WEBHOOK_PAYLOAD"
  | "MARKDOWN"
  | "PLAIN_TEXT";

type TemplateEngine = "HANDLEBARS" | "LIQUID" | "JINJA2" | "MUSTACHE";

type TemplateVariable = {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description?: string;
  defaultValue?: unknown;
};

type CreateTemplateInput = {
  name: string;                    // Stable identifier across versions (e.g. "invoice_email")
  locale: string;                  // BCP 47 locale code (e.g. "en-US", "fr-FR")
  outputType: TemplateOutputType;
  engine: TemplateEngine;
  subject?: string;                // For EMAIL_HTML and EMAIL_TEXT types
  body: string;                    // Raw template source with variable placeholders
  variables: TemplateVariable[];
  description?: string;
  tags?: string[];
};

type Template = {
  templateId: TemplateId;
  name: string;
  locale: string;
  version: number;
  outputType: TemplateOutputType;
  engine: TemplateEngine;
  subject?: string;
  body: string;
  variables: TemplateVariable[];
  description?: string;
  tags?: string[];
  status: TemplateStatus;
  createdBy: UserId;
  createdAt: Timestamp;
  publishedAt?: Timestamp;
};

type RenderTemplateInput = {
  name?: string;                   // Name + locale for active version lookup
  locale?: string;
  templateId?: TemplateId;         // Direct version reference; takes precedence over name
  context: Record<string, unknown>; // Variable values for rendering
};

type RenderedOutput = {
  templateId: TemplateId;
  templateName: string;
  version: number;
  outputType: TemplateOutputType;
  subject?: string;                // Rendered subject line (for email types)
  body: string;                    // Rendered output
  renderedAt: Timestamp;
};

type ValidateTemplateInput = {
  engine: TemplateEngine;
  body: string;
  subject?: string;
  variables: TemplateVariable[];
  sampleContext: Record<string, unknown>;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];              // e.g. unused variables, missing optional values
  renderedPreview?: RenderedOutput;
};

type ListTemplatesInput = {
  name?: string;
  status?: TemplateStatus;
  outputType?: TemplateOutputType;
  locale?: string;
  tags?: string[];
  pagination: PaginationInput;
};
```

---

## Invariants

1. Template names are unique within a `(name, locale)` pair. Two templates may share a name if their locales differ.
2. Only one version of a `(name, locale)` pair may be in `PUBLISHED` state at any time; publishing a new version atomically deprecates the previous one.
3. `renderTemplate` against an `ARCHIVED` or `DEPRECATED` template must return `TEMPLATE_NOT_RENDERABLE`.
4. All required variables declared in `variables` must be present in the render `context`; missing required variables return `MISSING_TEMPLATE_VARIABLE` rather than rendering an empty string.
5. Template body length must not exceed a configurable maximum (default 500KB); oversized templates return `TEMPLATE_TOO_LARGE`.
6. `version` is auto-incremented per `(name, locale)` pair; it is not caller-supplied.
7. The `ENGINE` used to render must match the `engine` field on the template; this module does not transcode between template engines.

---

## Events Emitted

- `template.created`
- `template.published` -- includes `version`, `deprecatedVersionId` if one was replaced
- `template.deprecated`
- `template.archived`
- `template.rendered` -- includes `templateId`, `version`, `outputType` (not the rendered content)

---

## System-Level Integrations

- **Idempotency:** `renderTemplate` is stateless; identical inputs always produce identical outputs for a given template version.
- **Consistency:** Template versions are immutable after publication; the body of a published template may never be mutated. Changes always create a new version.
- **Observability:** `template.rendered` events must be emitted for every render (not preview), enabling usage tracking and version adoption metrics.
- **Caching:** Active template resolution (`getActiveTemplate`) may be cached for up to 60 seconds; publishing a new version must broadcast a cache invalidation.
- **Dependencies:** `emails` (rendered EMAIL_HTML/TEXT dispatch), `sms` (rendered SMS dispatch), `notifications` (rendered push body), `pdf` (rendered PDF source), `localization` (locale fallback resolution), `storage` (large template body storage if over threshold).
- **Errors:** `TEMPLATE_NOT_FOUND`, `TEMPLATE_NOT_RENDERABLE`, `TEMPLATE_NOT_DRAFT`, `MISSING_TEMPLATE_VARIABLE`, `TEMPLATE_PARSE_ERROR`, `TEMPLATE_TOO_LARGE`, `LOCALE_NOT_SUPPORTED`.
- **Providers (adapter examples):** Handlebars.js, Liquid (Shopify), Jinja2 (Python), Mustache, MJML (email-specific HTML rendering).
