import { db } from "../db";
import { ulid } from "ulid";

export interface SpecRunCreateOpts {
  userId: string;
  prompt: string;
  domain: string;
  options: Record<string, unknown>;
  parentSpecId?: string;
  changeSummary?: string;
}

export async function create(opts: SpecRunCreateOpts): Promise<string> {
  const id = `spec_${ulid()}`;
  await db.query(
    `INSERT INTO spec_runs 
       (id, user_id, prompt, domain, status, options, parent_spec_id, change_summary)
     VALUES ($1, $2, $3, $4, 'running', $5, $6, $7)`,
    [
      id, 
      opts.userId, 
      opts.prompt, 
      opts.domain, 
      JSON.stringify(opts.options), 
      opts.parentSpecId || null, 
      opts.changeSummary || null
    ],
  );
  return id;
}

export async function setCompleted(specRunId: string, totalMs?: number): Promise<void> {
  await db.query(
    `UPDATE spec_runs 
     SET status = 'completed', completed_at = now(), total_ms = $2
     WHERE id = $1`,
    [specRunId, totalMs || null],
  );
}

export async function setFailed(specRunId: string, reason: string): Promise<void> {
  await db.query(
    `UPDATE spec_runs 
     SET status = 'failed', completed_at = now(), change_summary = $2
     WHERE id = $1`,
    [specRunId, reason],
  );
}

export async function get(id: string) {
  const { rows } = await db.query(`SELECT * FROM spec_runs WHERE id = $1`, [id]);
  return rows[0];
}

export async function list(userId: string, filters: { status?: string; limit?: number }) {
  const { rows } = await db.query(
    `SELECT * FROM spec_runs 
     WHERE user_id = $1 
     ${filters.status ? "AND status = $2" : ""}
     ORDER BY created_at DESC 
     LIMIT $3`,
    [userId, ...(filters.status ? [filters.status] : []), filters.limit || 20],
  );
  return rows;
}
