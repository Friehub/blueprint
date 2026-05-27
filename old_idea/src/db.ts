import { Pool } from "pg";
import { loadConfig } from "./config";

const config = loadConfig();

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
};

// Ensure pool is closed on process exit
process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});
