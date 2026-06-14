// data_import.ts
// Auto-generated from contracts/data_import.md
// Do not edit manually

export type ImportJobId = string;

export type ImportRowErrorId = string;

export type ImportFormat = "CSV" | "TSV" | "XLSX" | "JSON" | "NDJSON";

export type ColumnMapping = {
sourceColumn: string;            // Column header in the uploaded file
targetField: string;             // Field name in the target domain schema
required: boolean;
transform?: string;              // Named transform to apply (e.g. "trim", "lowercase", "parse_date")
};

export type ImportSchemaDefinition = {
targetModule: string;            // e.g. "users", "catalog", "crm_leads"
targetOperation: string;         // e.g. "createUser", "upsertProduct", "createLead"
columns: ColumnMapping[];
maxErrorRate: number;            // 0.0 – 1.0; fraction of rows allowed to have errors before INVALID
onDuplicate: "SKIP" | "UPDATE" | "ERROR";
};

export type ImportJob = {
importId: ImportJobId;
targetModule: string;
targetOperation: string;
format: ImportFormat;
status: ImportStatus;
uploadUrl?: string;              // Presigned URL; only present in UPLOADING state
fileName?: string;
fileSizeBytes?: number;
totalRows?: number;
parsedRows?: number;
validRows?: number;
errorRows?: number;
committedRows?: number;
failedRows?: number;
uploadedAt?: Timestamp;
parsingStartedAt?: Timestamp;
validationStartedAt?: Timestamp;
commitStartedAt?: Timestamp;
completedAt?: Timestamp;
errorReportUrl?: string;
requestedBy: UserId;
createdAt: Timestamp;
};

export type ImportRowError = {
errorId: ImportRowErrorId;
importId: ImportJobId;
rowIndex: number;
phase: "PARSING" | "VALIDATION" | "COMMIT";
field?: string;
errorCode: string;
errorMessage: string;
rawValue?: string;
};

export type CreateImportInput = {
targetModule: string;
targetOperation: string;
format: ImportFormat;
schema: ImportSchemaDefinition;
fileName: string;
fileSizeBytes: number;
requestedBy: UserId;
};

export type ListImportsInput = {
targetModule?: string;
status?: ImportStatus;
requestedBy?: UserId;
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: PaginationInput;
};

export type GetImportErrorsInput = {
importId: ImportJobId;
phase?: "PARSING" | "VALIDATION" | "COMMIT";
pagination: PaginationInput;
};

export interface DataImportContract {
  createImport(input: CreateImportInput): Promise<ImportJob>;
  confirmUpload(importId: ImportJobId): Promise<ImportJob>;
  getImport(importId: ImportJobId): Promise<ImportJob>;
  listImports(input: ListImportsInput): Promise<PaginatedList<ImportJob>>;
  getImportErrors(input: GetImportErrorsInput): Promise<PaginatedList<ImportRowError>>;
  commitImport(importId: ImportJobId): Promise<ImportJob>;
  abortImport(importId: ImportJobId): Promise<void>;
  downloadErrorReport(importId: ImportJobId): Promise<SignedUrl>;
  retryFailedRows(importId: ImportJobId): Promise<ImportJob>;
}
