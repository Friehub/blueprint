import { db } from "../db";

export async function save(
  specRunId: string,
  passNumber: number,
  output: any,
): Promise<void> {
  await db.query(
    `INSERT INTO pass_outputs (spec_run_id, pass_number, status, output, duration_ms)
     VALUES ($1, $2, 'completed', $3, 0)
     ON CONFLICT (spec_run_id, pass_number, attempt_number) DO UPDATE SET output = $3`,
    [specRunId, passNumber, JSON.stringify(output)],
  );
}
