# Module: pdf

**Version:** 0.1.0
**Part:** VI -- Platform Operations

## Purpose

Defines the interface for generating PDF documents from structured sources. A PDF job accepts a source -- an HTML string, a URL, or a rendered template output -- and produces a binary PDF artifact stored in the `storage` module, accessible via a signed URL. This module owns the rendering job lifecycle and output delivery. It does not own the source content (that belongs to `templates`, `reporting`, or the calling domain) or the storage of the resulting file (that belongs to `storage`).

---

## State Machine

```
QUEUED → RENDERING → COMPLETED
                   → FAILED
COMPLETED → EXPIRED     (artifact TTL elapsed)
```

Transitions:
- `QUEUED`: job accepted and dispatched to render worker
- `QUEUED → RENDERING`: worker picks up the job
- `RENDERING → COMPLETED`: PDF rendered and stored; signed URL available
- `RENDERING → FAILED`: render error (malformed HTML, timeout, resource error)
- `COMPLETED → EXPIRED`: artifact TTL elapsed; signed URL no longer valid

---

## Functions

### `generatePdf(input: GeneratePdfInput) → PdfJob`
Creates and queues a PDF render job. Returns immediately with a job record in `QUEUED` state.

### `getJob(jobId: PdfJobId) → PdfJob`
Returns the current state of a PDF render job. When `COMPLETED`, includes a signed download URL.

### `downloadPdf(jobId: PdfJobId) → SignedUrl`
Returns a time-limited signed URL to the rendered PDF artifact. Only valid when job status is `COMPLETED`.

### `listJobs(input: ListPdfJobsInput) → PaginatedList<PdfJob>`
Returns PDF jobs filtered by status, source type, or date range.

### `retryJob(jobId: PdfJobId) → PdfJob`
Re-queues a `FAILED` job with the original input parameters. Returns a new job record.

### `deleteJob(jobId: PdfJobId) → void`
Soft-deletes the job record and removes the artifact from `storage` if still present.

---

## Types

```typescript
type PdfJobId = string;

type PdfJobStatus = "QUEUED" | "RENDERING" | "COMPLETED" | "FAILED" | "EXPIRED";

type PdfSourceType = "HTML_STRING" | "URL" | "TEMPLATE";

type PageSize = "A4" | "A3" | "LETTER" | "LEGAL" | "TABLOID";
type PageOrientation = "PORTRAIT" | "LANDSCAPE";

type PdfMargins = {
  top: string;                     // CSS-compatible value, e.g. "20mm", "1in"
  right: string;
  bottom: string;
  left: string;
};

type PdfOptions = {
  pageSize: PageSize;
  orientation: PageOrientation;
  margins?: PdfMargins;
  printBackground: boolean;        // Whether to render CSS background colors and images
  scale?: number;                  // 0.1--2.0; defaults to 1.0
  headerTemplate?: string;         // HTML for the page header; printed on each page
  footerTemplate?: string;         // HTML for the page footer; printed on each page
  pageRanges?: string;             // e.g. "1-5, 8, 11-13"
};

type GeneratePdfInput = {
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

type PdfJob = {
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

type SignedUrl = {
  url: string;
  expiresAt: Timestamp;
};

type ListPdfJobsInput = {
  status?: PdfJobStatus;
  sourceType?: PdfSourceType;
  requestedBy?: UserId;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: PaginationInput;
};
```

---

## Invariants

1. `downloadPdf` returns `JOB_NOT_COMPLETE` if the job is not in `COMPLETED` state.
2. `downloadPdf` returns `JOB_EXPIRED` if the artifact TTL has elapsed; the signed URL is no longer valid.
3. Signed URLs must be time-limited; the expiry must not exceed `min(ttlSeconds, 3600)` seconds from the time of the `downloadPdf` call.
4. `retryJob` is only valid for `FAILED` jobs; calling it on `COMPLETED` or `QUEUED` jobs returns `JOB_NOT_RETRYABLE`.
5. HTML source content must be sanitised to prevent SSRF attacks; the render worker must operate in a network-isolated sandbox with no access to internal services when rendering `URL` or `HTML_STRING` sources.
6. `htmlContent` must not exceed 10MB; `URL` sources must respond within a configurable timeout (default 30 seconds) or the job transitions to `FAILED`.
7. Artifacts are stored in `storage` under a namespaced path; the calling module does not control the storage path -- the PDF module manages it internally.
8. `pageCount` and `fileSizeBytes` are populated only after successful rendering; they are null for non-`COMPLETED` jobs.

---

## Events Emitted

- `pdf.job.queued`
- `pdf.job.rendering_started`
- `pdf.job.completed` -- includes `fileSizeBytes`, `pageCount`
- `pdf.job.failed` -- includes `errorMessage`
- `pdf.job.expired`

---

## System-Level Integrations

- **Idempotency:** PDF generation is not idempotent by default; each call to `generatePdf` creates a new job. Callers requiring idempotency must track job IDs themselves.
- **Consistency:** Render jobs are dispatched via `queues`; the job record must be durable before dispatch to prevent lost jobs on process restart.
- **Runtime delivery:** Render jobs are delivered `at_least_once`; the render worker must tolerate duplicate dispatches.
- **Worker scaling:** Render concurrency must be configurable per source type or render pool.
- **Multi-region:** The deployment must declare whether rendering is single-region or active/passive; duplicate job pickup across regions must be deduplicated.
- **Observability:** Each job is a trace root; spans cover queue wait, render duration, and storage upload. `pageCount` and `fileSizeBytes` are span attributes.
  - **Telemetry Metrics:**
  ```
  blueprint_pdf_jobs_total               { source_type, status }
  blueprint_pdf_job_duration_ms          histogram { source_type }
  blueprint_pdf_render_duration_ms       histogram { source_type }
  blueprint_pdf_queue_wait_ms            histogram
  blueprint_pdf_artifact_size_bytes      histogram
  blueprint_pdf_queue_depth              gauge { status }
  blueprint_pdf_errors_total             { code }
  ```
- **Security:** URL and HTML sources must never be rendered in a context with access to internal network addresses (localhost, RFC 1918 ranges); the render sandbox must enforce network egress restrictions.
- **Backpressure:** If the render queue is saturated, `generatePdf` must fail predictably or defer work rather than creating unbounded backlog.
- **Dead-letter handling:** Jobs that exhaust retry policy or fail deterministically must be retained in an operator-queryable failed state until the retention window expires.
- **Storage model:** Render artifacts live in object storage; job state and failure history must remain queryable in durable storage until expiry.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE pdf_job_status AS ENUM ('QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE pdf_source_type AS ENUM ('HTML_STRING', 'URL', 'TEMPLATE');

CREATE TABLE pdf_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type       pdf_source_type NOT NULL,
  file_name         TEXT NOT NULL,
  options           JSONB NOT NULL,
  status            pdf_job_status NOT NULL DEFAULT 'QUEUED',
  storage_ref       TEXT,
  download_url      TEXT,
  download_url_expires_at TIMESTAMPTZ,
  file_size_bytes   BIGINT,
  page_count        INT,
  error_message     TEXT,
  requested_by      UUID NOT NULL,
  metadata          JSONB,
  queued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  render_started_at TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdf_jobs_status ON pdf_jobs(status) WHERE status IN ('QUEUED', 'RENDERING', 'FAILED');
CREATE INDEX idx_pdf_jobs_requested ON pdf_jobs(requested_by, created_at DESC);
CREATE INDEX idx_pdf_jobs_expiry ON pdf_jobs(expires_at) WHERE status = 'COMPLETED';
```
- **Dependencies:** `queues` (async dispatch), `storage` (artifact persistence), `templates` (TEMPLATE source rendering), `jobs` (TTL expiry enforcement).
- **Errors:** `JOB_NOT_FOUND`, `JOB_NOT_COMPLETE`, `JOB_EXPIRED`, `JOB_NOT_RETRYABLE`, `RENDER_TIMEOUT`, `CONTENT_TOO_LARGE`, `INVALID_URL`, `STORAGE_UNAVAILABLE`.
- **Providers (adapter examples):** Puppeteer (Chromium headless), Playwright, wkhtmltopdf, WeasyPrint, PDFKit (Node.js), DocRaptor, Gotenberg.

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Render timeout exceeded | Transition job to FAILED with RENDER_TIMEOUT error |
| Storage unavailable | Job completes but download URL generation fails; artifact stored but inaccessible |
| Content too large | Return CONTENT_TOO_LARGE error before queuing |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new PDF job status enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
