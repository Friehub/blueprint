import { ClarificationQuestion, ExtractionOutput } from "./schemas";
import { db } from "../db";
import { ulid } from "ulid";

export type GateStatus = "no_questions" | "non_blocking" | "blocking";

export function evaluateGate(output: ExtractionOutput): GateStatus {
  const questions = output.clarification_questions;
  if (questions.length === 0) return "no_questions";
  if (questions.some((q) => q.blocking)) return "blocking";
  return "non_blocking";
}

function generateId() {
  return `clar_${ulid()}`;
}

/**
 * Pauses the pipeline and stores clarification state.
 * Returns the questions to surface to the user.
 * The pipeline resumes only after POST /specs/:id/clarifications.
 */
export async function pauseForClarification(
  specRunId: string,
  questions: ClarificationQuestion[],
): Promise<void> {
  const timeoutAt = new Date(Date.now() + 300_000); // 300 seconds
  await db.query(
    `INSERT INTO clarification_events
       (id, spec_run_id, questions, status, timeout_at)
     VALUES ($1, $2, $3, 'pending', $4)`,
    [
      generateId(),
      specRunId,
      JSON.stringify(questions),
      "pending",
      timeoutAt.toISOString(),
    ],
  );
  await db.query(
    `UPDATE spec_runs SET status = 'awaiting_clarification' WHERE id = $1`,
    [specRunId],
  );
}

/**
 * Called when the user submits answers via POST /specs/:id/clarifications.
 * Updates the extraction output with the new information and resumes.
 */
export async function recordAnswers(
  specRunId: string,
  answers: Array<{ question_id: string; answer: string }>,
): Promise<void> {
  const answeredAt = new Date().toISOString();
  await db.query(
    `UPDATE clarification_events
     SET answers = $1, status = 'answered', answered_at = $2
     WHERE spec_run_id = $3 AND status = 'pending'`,
    [JSON.stringify(answers), answeredAt, specRunId],
  );
  await db.query(
    `UPDATE spec_runs SET status = 'running' WHERE id = $1`,
    [specRunId],
  );
}

/**
 * Non-blocking questions: auto-apply defaults after 60 seconds.
 * Called by a background job that scans for timed-out non-blocking gates.
 */
export async function applyDefaultsAndResume(specRunId: string): Promise<void> {
  await db.query(
    `UPDATE clarification_events
     SET status = 'timed_out'
     WHERE spec_run_id = $1 AND status = 'pending' AND timeout_at < now()`,
    [specRunId],
  );
  await db.query(
    `UPDATE spec_runs SET status = 'running' WHERE id = $1`,
    [specRunId],
  );
}
