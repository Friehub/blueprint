# Module: forms

**Version:** 0.1.0
**Part:** VI -- Platform Operations

## Purpose

Defines the interface for building, publishing, and collecting submissions from structured data collection forms. A form is a schema-driven interface that accepts typed user input, validates it, and stores the resulting submission as a structured record. Forms may embed conditional logic, serve multiple audiences via access controls, integrate with webhooks for downstream processing, and support multi-step flows. This module does not own the rendering of form UI -- it owns the schema, submission lifecycle, and data contract.

---

## State Machine

### Form State
```
DRAFT → PUBLISHED → CLOSED → ARCHIVED
DRAFT → ARCHIVED
PUBLISHED → DRAFT  (edit requires unpublishing)
CLOSED → PUBLISHED (re-open)
```

### Submission State
```
DRAFT → SUBMITTED → PROCESSING → ACCEPTED
                              → REJECTED
SUBMITTED → ACCEPTED  (if no processing step configured)
```

Transitions:
- `DRAFT → PUBLISHED`: `publishForm` called; form begins accepting submissions
- `PUBLISHED → CLOSED`: `closeForm` called, or `closeAt` timestamp reached
- `CLOSED → ARCHIVED`: `archiveForm` called
- Submission `SUBMITTED → PROCESSING`: a webhook or downstream handler is invoked
- Submission `PROCESSING → ACCEPTED`: handler signals acceptance
- Submission `PROCESSING → REJECTED`: handler signals rejection with a reason

---

## Functions

### `createForm(input: CreateFormInput) → Form`
Defines a new form schema with fields, validation rules, and settings. Created in `DRAFT` state.

### `updateForm(formId: FormId, input: UpdateFormInput) → Form`
Updates a draft form's schema. Not available for published forms.

### `publishForm(formId: FormId) → Form`
Makes the form live and accepting submissions.

### `closeForm(formId: FormId) → Form`
Stops accepting new submissions. Existing submissions are unaffected.

### `archiveForm(formId: FormId) → void`
Soft-deletes the form and all associated submissions.

### `getForm(formId: FormId) → Form`
Returns the form schema and metadata.

### `getFormBySlug(slug: string) → Form`
Returns the currently published form with the given slug.

### `listForms(input: ListFormsInput) → PaginatedList<Form>`
Lists forms filtered by status, owner, or tag.

### `submitForm(input: SubmitFormInput) → Submission`
Creates a submission record after validating input against the form schema. Idempotent on `idempotencyKey`.

### `getSubmission(submissionId: SubmissionId) → Submission`
Returns a specific submission and its field values.

### `listSubmissions(input: ListSubmissionsInput) → PaginatedList<Submission>`
Returns submissions for a form, filtered by status or date range.

### `updateSubmissionStatus(input: UpdateSubmissionStatusInput) → Submission`
Transitions a submission to `ACCEPTED` or `REJECTED`. Called by downstream processors or webhook handlers.

### `deleteSubmission(submissionId: SubmissionId) → void`
Hard-deletes a submission record. Used for GDPR erasure requests.

---

## Types

```typescript
type FormId = string;
type SubmissionId = string;
type FieldId = string;

type FormStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
type SubmissionStatus = "DRAFT" | "SUBMITTED" | "PROCESSING" | "ACCEPTED" | "REJECTED";

type FieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "EMAIL"
  | "PHONE"
  | "NUMBER"
  | "DATE"
  | "DATETIME"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "CHECKBOX"
  | "FILE_UPLOAD"
  | "HIDDEN";

type ValidationRule = {
  type: "required" | "min" | "max" | "minLength" | "maxLength" | "pattern" | "email" | "url";
  value?: unknown;
  message?: string;
};

type ConditionalRule = {
  showIf: {
    fieldId: FieldId;
    operator: "eq" | "neq" | "contains" | "notEmpty";
    value?: unknown;
  };
};

type FormField = {
  fieldId: FieldId;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  order: number;
  options?: string[];              // For SINGLE_SELECT and MULTI_SELECT types
  validations: ValidationRule[];
  conditionalRule?: ConditionalRule;
  defaultValue?: unknown;
};

type FormStep = {
  stepId: string;
  title: string;
  description?: string;
  fields: FormField[];
};

type FormSettings = {
  slug: string;
  isMultiStep: boolean;
  allowDraftSubmissions: boolean;  // Allow partial saves before final submit
  allowMultipleSubmissions: boolean;
  submissionLimitPerUser?: number;
  closeAt?: Timestamp;
  redirectUrl?: string;            // URL to redirect to after successful submission
  successMessage?: string;
  webhookUrl?: string;             // Called on each new submission
  requireAuthentication: boolean;
};

type CreateFormInput = {
  title: string;
  description?: string;
  steps: FormStep[];               // Single-step forms have exactly one step
  settings: FormSettings;
  ownerId: UserId;
};

type UpdateFormInput = Partial<Omit<CreateFormInput, "ownerId">>;

type Form = {
  formId: FormId;
  title: string;
  description?: string;
  steps: FormStep[];
  settings: FormSettings;
  status: FormStatus;
  ownerId: UserId;
  submissionCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
  closedAt?: Timestamp;
};

type FieldValue = {
  fieldId: FieldId;
  value: unknown;
};

type SubmitFormInput = {
  formId: FormId;
  values: FieldValue[];
  submittedBy?: UserId;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

type Submission = {
  submissionId: SubmissionId;
  formId: FormId;
  values: FieldValue[];
  status: SubmissionStatus;
  submittedBy?: UserId;
  submittedAt: Timestamp;
  processedAt?: Timestamp;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
};

type UpdateSubmissionStatusInput = {
  submissionId: SubmissionId;
  status: "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
};

type ListFormsInput = {
  status?: FormStatus;
  ownerId?: UserId;
  pagination: PaginationInput;
};

type ListSubmissionsInput = {
  formId: FormId;
  status?: SubmissionStatus;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: PaginationInput;
};
```

---

## Invariants

1. `submitForm` validates all field values against their `validations` rules before persisting; invalid submissions return `FORM_VALIDATION_FAILED` with field-level errors.
2. `submitForm` on a `CLOSED`, `DRAFT`, or `ARCHIVED` form returns `FORM_NOT_ACCEPTING_SUBMISSIONS`.
3. Forms with `allowMultipleSubmissions = false` reject a second submission from the same authenticated user with `DUPLICATE_SUBMISSION`.
4. `updateForm` is only available when the form is in `DRAFT` state; callers must unpublish first, which transitions the form back to `DRAFT`.
5. `idempotencyKey` on `submitForm` prevents duplicate submissions from retry logic; identical keys within a 24-hour window return the existing submission.
6. `deleteSubmission` is irreversible; implementations must require explicit confirmation at the adapter layer (not at this contract level).
7. A form with `isMultiStep = true` must have at least two `FormStep` entries; single-step forms must have exactly one.
8. `FILE_UPLOAD` field values are stored as references to the `storage` module; this module does not store file bytes directly.

---

## Events Emitted

- `form.created`
- `form.published`
- `form.closed`
- `form.archived`
- `form.submission.received` -- includes `submissionId`, `formId`
- `form.submission.accepted`
- `form.submission.rejected` -- includes `rejectionReason`
- `form.submission.deleted`

---

## System-Level Integrations

- **Idempotency:** `submitForm` is idempotent on `idempotencyKey`; duplicate calls return the existing submission without creating a new record.
- **Consistency:** Submission creation and webhook dispatch must use an outbox pattern; the submission must be persisted before the webhook is triggered.
- **Runtime delivery:** Webhook-triggered downstream processing is `at_least_once`; handlers must tolerate duplicate submission notifications.
- **Worker scaling:** Submission processing and webhook delivery must be independently scalable.
- **Multi-region:** If form processing is active/active, duplicate submission handling must be deduplicated by `idempotencyKey`.
- **Observability:** Each submission is a trace with spans for validation, persistence, and webhook dispatch.
- **Backpressure:** If webhook or downstream processing capacity is saturated, submissions must be queued or rejected predictably rather than being dropped silently.
- **Dead-letter handling:** Failed downstream processing attempts must remain queryable until the review or retry window expires.
- **Storage model:** Form schema and submission records must be durably stored; file attachments remain in `storage`.
- **Dependencies:** `storage` (FILE_UPLOAD field values), `webhooks` (downstream notification on new submission), `notifications` (confirmation messages to submitters), `auth` (authenticated submission identity).
- **Errors:** `FORM_NOT_FOUND`, `FORM_NOT_ACCEPTING_SUBMISSIONS`, `FORM_VALIDATION_FAILED`, `DUPLICATE_SUBMISSION`, `SUBMISSION_NOT_FOUND`, `FORM_NOT_EDITABLE`.
- **Providers (adapter examples):** Custom implementation, Typeform API, Tally, Formspree, Jotform, Airtable Forms.
