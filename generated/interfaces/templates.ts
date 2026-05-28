// templates.ts
// Auto-generated from contracts/templates.md
// Do not edit manually

export type TemplateId = string;

export type TemplateStatus = "DRAFT" | "PUBLISHED" | "DEPRECATED" | "ARCHIVED";

export type TemplateEngine = "HANDLEBARS" | "LIQUID" | "JINJA2" | "MUSTACHE";

export type TemplateVariable = {
name: string;
type: "string" | "number" | "boolean" | "object" | "array";
required: boolean;
description?: string;
defaultValue?: unknown;
};

export type CreateTemplateInput = {
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

export type Template = {
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

export type RenderTemplateInput = {
name?: string;                   // Name + locale for active version lookup
locale?: string;
templateId?: TemplateId;         // Direct version reference; takes precedence over name
context: Record<string, unknown>; // Variable values for rendering
};

export type RenderedOutput = {
templateId: TemplateId;
templateName: string;
version: number;
outputType: TemplateOutputType;
subject?: string;                // Rendered subject line (for email types)
body: string;                    // Rendered output
renderedAt: Timestamp;
};

export type ValidateTemplateInput = {
engine: TemplateEngine;
body: string;
subject?: string;
variables: TemplateVariable[];
sampleContext: Record<string, unknown>;
};

export type ValidationResult = {
valid: boolean;
errors: string[];
warnings: string[];              // e.g. unused variables, missing optional values
renderedPreview?: RenderedOutput;
};

export type ListTemplatesInput = {
name?: string;
status?: TemplateStatus;
outputType?: TemplateOutputType;
locale?: string;
tags?: string[];
pagination: PaginationInput;
};

export interface TemplatesContract {
  createTemplate(input: CreateTemplateInput): Promise<Template>;
  getTemplate(templateId: TemplateId): Promise<Template>;
  getActiveTemplate(name: string, locale?: string): Promise<Template>;
  listTemplates(input: ListTemplatesInput): Promise<PaginatedList<Template>>;
  listVersions(name: string): Promise<Template[]>;
  publishTemplate(templateId: TemplateId): Promise<Template>;
  deprecateTemplate(templateId: TemplateId): Promise<Template>;
  archiveTemplate(templateId: TemplateId): Promise<void>;
  renderTemplate(input: RenderTemplateInput): Promise<RenderedOutput>;
  validateTemplate(input: ValidateTemplateInput): Promise<ValidationResult>;
  previewTemplate(input: RenderTemplateInput): Promise<RenderedOutput>;
}
