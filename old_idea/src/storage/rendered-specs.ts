import { db } from "../db";

export async function save(specRunId: string, markdown: string): Promise<void> {
  await db.query(
    `INSERT INTO rendered_specs (spec_run_id, markdown)
     VALUES ($1, $2)
     ON CONFLICT (spec_run_id) DO UPDATE SET markdown = $2, updated_at = now()`,
    [specRunId, markdown],
  );
}
