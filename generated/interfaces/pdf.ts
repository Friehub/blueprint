// pdf.ts
// Auto-generated from contracts/pdf.md
// Do not edit manually

export type PdfJobId = string;

export type PdfJobStatus = "QUEUED" | "RENDERING" | "COMPLETED" | "FAILED" | "EXPIRED";

export type PdfSourceType = "HTML_STRING" | "URL" | "TEMPLATE";

export type PageSize = "A4" | "A3" | "LETTER" | "LEGAL" | "TABLOID";

export type PageOrientation = "PORTRAIT" | "LANDSCAPE";

export type PdfMargins = {
top: string;                     // CSS-compatible value, e.g. "20mm", "1in"
right: string;
bottom: string;
left: string;
};

export type PdfOptions = {
pageSize: PageSize;
orientation: PageOrientation;
margins?: PdfMargins;
printBackground: boolean;        // Whether to render CSS background colors and images
scale?: number;                  // 0.1–2.0; defaults to 1.0
headerTemplate?: string;         // HTML for the page header; printed on each page
footerTemplate?: string;         // HTML for the page footer; printed on each page
pageRanges?: string;             // e.g. "1-5, 8, 11-13"
};

export type GeneratePdfInput = {
sourceType: PdfSourceType;
htmlContent?: string;            // Required for HTML_STRING
url?: string;                    // Required for URL; must be reachable by the render worker
templateRef?: {                  // Required for TEMPLATE
templateId: string;
context: Record<string, unknown>;
};
fileName: string;                // Desired filename for the output artifact
options: PdfOptions;
ttlSeconds?: number;             // Artifact retention duration; defaults to 86400 (24h)
requestedBy: UserId;
metadata?: Record<string, unknown>;
};

export type PdfJob = {
jobId: PdfJobId;
sourceType: PdfSourceType;
fileName: string;
options: PdfOptions;
status: PdfJobStatus;
storageRef?: string;             // Reference to the artifact in `storage`
downloadUrl?: string;            // Signed URL; only populated when COMPLETED
downloadUrlExpiresAt?: Timestamp;
fileSizeBytes?: number;
pageCount?: number;
errorMessage?: string;
requestedBy: UserId;
metadata?: Record<string, unknown>;
queuedAt: Timestamp;
renderStartedAt?: Timestamp;
completedAt?: Timestamp;
expiresAt?: Timestamp;
};

export type SignedUrl = {
url: string;
expiresAt: Timestamp;
};

export type ListPdfJobsInput = {
status?: PdfJobStatus;
sourceType?: PdfSourceType;
requestedBy?: UserId;
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: PaginationInput;
};

export interface PdfContract {
  generatePdf(input: GeneratePdfInput): Promise<PdfJob>;
  getJob(jobId: PdfJobId): Promise<PdfJob>;
  downloadPdf(jobId: PdfJobId): Promise<SignedUrl>;
  listJobs(input: ListPdfJobsInput): Promise<PaginatedList<PdfJob>>;
  retryJob(jobId: PdfJobId): Promise<PdfJob>;
  deleteJob(jobId: PdfJobId): Promise<void>;
}
