// forms.ts
// Auto-generated from contracts/forms.md
// Do not edit manually

export type FormId = string;

export type SubmissionId = string;

export type FieldId = string;

export type FormStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";

export type SubmissionStatus = "DRAFT" | "SUBMITTED" | "PROCESSING" | "ACCEPTED" | "REJECTED";

export type ValidationRule = {
type: "required" | "min" | "max" | "minLength" | "maxLength" | "pattern" | "email" | "url";
value?: unknown;
message?: string;
};

export type ConditionalRule = {
showIf: {
fieldId: FieldId;
operator: "eq" | "neq" | "contains" | "notEmpty";
value?: unknown;
};
};

export type FormField = {
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

export type FormStep = {
stepId: string;
title: string;
description?: string;
fields: FormField[];
};

export type FormSettings = {
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

export type CreateFormInput = {
title: string;
description?: string;
steps: FormStep[];               // Single-step forms have exactly one step
settings: FormSettings;
ownerId: UserId;
};

export type UpdateFormInput = Partial<Omit<CreateFormInput, "ownerId">>;

export type Form = {
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

export type FieldValue = {
fieldId: FieldId;
value: unknown;
};

export type SubmitFormInput = {
formId: FormId;
values: FieldValue[];
submittedBy?: UserId;
idempotencyKey?: string;
metadata?: Record<string, unknown>;
};

export type Submission = {
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

export type UpdateSubmissionStatusInput = {
submissionId: SubmissionId;
status: "ACCEPTED" | "REJECTED";
rejectionReason?: string;
};

export type ListFormsInput = {
status?: FormStatus;
ownerId?: UserId;
pagination: PaginationInput;
};

export type ListSubmissionsInput = {
formId: FormId;
status?: SubmissionStatus;
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: PaginationInput;
};

export interface FormsContract {
  createForm(input: CreateFormInput): Promise<Form>;
  updateForm(formId: FormId, input: UpdateFormInput): Promise<Form>;
  publishForm(formId: FormId): Promise<Form>;
  closeForm(formId: FormId): Promise<Form>;
  archiveForm(formId: FormId): Promise<void>;
  getForm(formId: FormId): Promise<Form>;
  getFormBySlug(slug: string): Promise<Form>;
  listForms(input: ListFormsInput): Promise<PaginatedList<Form>>;
  submitForm(input: SubmitFormInput): Promise<Submission>;
  getSubmission(submissionId: SubmissionId): Promise<Submission>;
  listSubmissions(input: ListSubmissionsInput): Promise<PaginatedList<Submission>>;
  updateSubmissionStatus(input: UpdateSubmissionStatusInput): Promise<Submission>;
  deleteSubmission(submissionId: SubmissionId): Promise<void>;
}
