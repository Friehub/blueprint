import type { DocumentKind } from "./parser.js";
import type { SourceRef } from "./catalog.js";

export type DocumentEnvelope = {
  kind: DocumentKind;
  name: string;
  title: string;
  titleLine: number;
  source: SourceRef;
};

export type EnvelopeIssueCode =
  | "MISSING_TITLE"
  | "MISSING_MODULE_NAME"
  | "KIND_MISMATCH"
  | "INVALID_SEPARATOR"
  | "INVALID_HEADING";

export type EnvelopeIssue = {
  code: EnvelopeIssueCode;
  file: string;
  startLine: number;
  endLine: number;
  message: string;
  severity: "error" | "warning";
};
