import { db } from "../db";

export interface FormalModelSaveOpts {
  specRunId: string;
  modelId: string;
  tlaSource: string;
  cfgSource: string;
  status: "verified" | "violated" | "error";
  verificationBounds: Record<string, number>;
  counterexample?: string;
  durationMs: number;
}

export async function save(opts: FormalModelSaveOpts): Promise<void> {
  await db.query(
    `INSERT INTO formal_models
       (spec_run_id, model_id, tla_source, cfg_source, status, verification_bounds, counterexample, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      opts.specRunId,
      opts.modelId,
      opts.tlaSource,
      opts.cfgSource,
      opts.status,
      JSON.stringify(opts.verificationBounds),
      opts.counterexample || null,
      opts.durationMs,
    ],
  );
}

export async function listForSpec(specRunId: string) {
  const { rows } = await db.query(
    `SELECT * FROM formal_models WHERE spec_run_id = $1`,
    [specRunId],
  );
  return rows;
}
